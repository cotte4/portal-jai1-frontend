import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, lastValueFrom, interval, Subscription } from 'rxjs';
import {
  IrsMonitorService,
  IrsClient,
  IrsCheck,
} from '../../core/services/irs-monitor.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';

interface ClientRow extends IrsClient {
  isChecking: boolean;
  checkStatusLabel: string;
  lastCheckResult: IrsCheck | null;
  hasLoaded: boolean;
}

@Component({
  selector: 'app-admin-irs-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-irs-monitor.html',
  styleUrls: ['./admin-irs-monitor.css'],
})
export class AdminIrsMonitor implements OnInit, OnDestroy {
  private irsMonitorService = inject(IrsMonitorService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  themeService = inject(ThemeService);

  clients: ClientRow[] = [];
  isLoading = true;
  hasLoaded = false;
  error: string | null = null;
  sidebarCollapsed = false;

  // Batch state
  selectedIds = new Set<string>();
  isRunningBatch = false;
  isRunningAll = false;
  private cancelBatchFlag = false;
  batchProgress: { current: number; total: number } | null = null;

  // Scheduler state
  schedulerActive = false;
  isTogglingScheduler = false;
  private schedulerPollSub: Subscription | null = null;

  // Stats badge
  changesLast24h = 0;

  // History drawer
  historyClient: ClientRow | null = null;
  historyChecks: IrsCheck[] = [];
  isLoadingHistory = false;

  // Screenshot loading state per checkId (history drawer)
  screenshotUrls: Record<string, string | 'loading' | 'error'> = {};

  // Screenshot loading state for main table rows
  mainScreenshotUrls: Record<string, string | 'loading' | 'error'> = {};

  // Hover screenshot tooltip
  tooltipCheckId: string | null = null;
  tooltipVisible = false;
  tooltipX = 0;
  tooltipY = 0;

  // Approve modal state
  approveModalCheck: IrsCheck | null = null;
  approveModalClient: ClientRow | null = null;
  approveClientComment = '';
  approveInternalComment = '';

  isExportingCsv = false;
  hideCompleted = true;

  private readonly COMPLETED_STATUSES = ['taxes_completados', 'deposito_directo', 'cheque_en_camino'];

  get filteredClients(): ClientRow[] {
    if (!this.hideCompleted) return this.clients;
    return this.clients.filter(c => !this.COMPLETED_STATUSES.includes(c.federalStatusNew ?? ''));
  }

  get darkMode() {
    return this.themeService.darkMode();
  }

  get selectedCount() {
    return this.selectedIds.size;
  }

  private destroyed = false;

  ngOnInit() {
    this.loadClients();
    this.loadStats();
    this.loadSchedulerStatus();
    this.schedulerPollSub = interval(30_000).subscribe(() => this.loadSchedulerStatus());
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.schedulerPollSub?.unsubscribe();
  }

  loadSchedulerStatus() {
    this.irsMonitorService.getSchedulerStatus().subscribe({
      next: (s) => {
        this.schedulerActive = s.active;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  toggleScheduler() {
    if (this.isTogglingScheduler) return;
    this.isTogglingScheduler = true;
    const action = this.schedulerActive
      ? this.irsMonitorService.stopScheduler()
      : this.irsMonitorService.startScheduler();
    action
      .pipe(finalize(() => {
        this.isTogglingScheduler = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => {
          this.schedulerActive = res.active;
          this.toastService.show(
            res.active ? 'Monitoreo automático iniciado' : 'Monitoreo automático detenido',
            res.active ? 'success' : 'info',
          );
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show(`Error: ${err.message}`, 'error');
        },
      });
  }

  loadStats() {
    this.irsMonitorService.getStats().subscribe({
      next: (s) => {
        this.changesLast24h = s.changesLast24h;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadClients() {
    this.isLoading = true;
    this.error = null;
    this.selectedIds.clear();

    this.irsMonitorService
      .getFiledClients()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (clients) => {
          this.clients = clients.map((c) => ({
            ...c,
            isChecking: false,
            checkStatusLabel: '',
            lastCheckResult: null,
            hasLoaded: true,
          }));
        },
        error: (err) => {
          this.error = err.message ?? 'Error loading clients';
        },
      });
  }

  // ---- Selection ----

  toggleSelect(client: ClientRow) {
    if (client.isChecking || this.isRunningBatch) return;
    if (this.selectedIds.has(client.taxCaseId)) {
      this.selectedIds.delete(client.taxCaseId);
    } else {
      if (this.selectedIds.size >= 10) {
        this.toastService.show('Máximo 10 clientes por batch', 'info');
        return;
      }
      this.selectedIds.add(client.taxCaseId);
    }
  }

  isSelected(client: ClientRow) {
    return this.selectedIds.has(client.taxCaseId);
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  // ---- Batch run ----

  cancelBatch() {
    this.cancelBatchFlag = true;
  }

  async runSelected() {
    const selected = this.clients.filter(
      (c) => this.selectedIds.has(c.taxCaseId) && !c.isChecking,
    );
    if (selected.length === 0) return;

    this.isRunningBatch = true;
    this.cancelBatchFlag = false;
    this.batchProgress = { current: 0, total: selected.length };
    this.cdr.detectChanges();

    for (const client of selected) {
      if (this.cancelBatchFlag) break;

      client.isChecking = true;
      this.batchProgress = { current: this.batchProgress!.current + 1, total: selected.length };
      this.cdr.detectChanges();

      try {
        client.checkStatusLabel = 'Iniciando...';
        this.cdr.detectChanges();
        const since = new Date();
        await lastValueFrom(this.irsMonitorService.runCheck(client.taxCaseId));
        client.checkStatusLabel = 'Abriendo navegador...';
        this.cdr.detectChanges();
        const check = await this.pollForResult(
          client.taxCaseId, since, label => {
            client.checkStatusLabel = label;
            this.cdr.detectChanges();
          },
        );
        this.handleCheckResult(client, check);
      } catch {
        client.isChecking = false;
        client.checkStatusLabel = '';
        this.toastService.show(`❌ ${client.clientName}: error`, 'error');
        this.cdr.detectChanges();
      }
    }

    const wasCancelled = this.cancelBatchFlag;
    this.isRunningBatch = false;
    this.batchProgress = null;
    this.cancelBatchFlag = false;
    this.cdr.detectChanges();

    if (!wasCancelled) {
      this.selectedIds.clear();
      const n = selected.length;
      this.toastService.show(`Batch completado: ${n} cliente${n !== 1 ? 's' : ''} verificado${n !== 1 ? 's' : ''}`, 'success');
    }
  }

  // ---- Run all ----

  runCheckAll() {
    if (this.isRunningAll || this.isRunningBatch) return;
    this.isRunningAll = true;
    this.irsMonitorService.runCheckAll()
      .pipe(finalize(() => {
        this.isRunningAll = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.toastService.show(
            '🔍 Verificación de todos los clientes iniciada en segundo plano',
            'info',
          );
        },
        error: (err) => {
          this.toastService.show(`Error al iniciar verificación: ${err.message}`, 'error');
        },
      });
  }

  // ---- History drawer ----

  openHistory(client: ClientRow) {
    this.historyClient = client;
    this.historyChecks = [];
    this.isLoadingHistory = true;
    this.cdr.detectChanges();
    this.irsMonitorService
      .getChecksForClient(client.taxCaseId)
      .pipe(finalize(() => {
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (checks) => { this.historyChecks = checks; },
        error: () => { this.historyChecks = []; },
      });
  }

  closeHistory() {
    this.historyClient = null;
    this.historyChecks = [];
    this.screenshotUrls = {};
  }

  onCheckHover(event: MouseEvent, check: IrsCheck) {
    if (!check.screenshotPath) return;
    this.tooltipCheckId = check.id;
    this.tooltipVisible = true;
    this.updateTooltipPos(event);
    if (!this.mainScreenshotUrls[check.id]) {
      this.loadMainScreenshot(check);
    }
    this.cdr.detectChanges();
  }

  onCheckMove(event: MouseEvent) {
    if (!this.tooltipVisible) return;
    this.updateTooltipPos(event);
  }

  onCheckLeave() {
    this.tooltipVisible = false;
    this.tooltipCheckId = null;
    this.cdr.detectChanges();
  }

  private updateTooltipPos(event: MouseEvent) {
    const tooltipW = 820;
    const margin = 16;
    const x = event.clientX + margin + tooltipW > window.innerWidth
      ? event.clientX - tooltipW - margin
      : event.clientX + margin;
    this.tooltipX = x;
    this.tooltipY = Math.min(event.clientY - 20, window.innerHeight - 500);
  }

  loadMainScreenshot(check: IrsCheck) {
    if (!check.screenshotPath || this.mainScreenshotUrls[check.id]) return;
    this.mainScreenshotUrls[check.id] = 'loading';
    this.cdr.detectChanges();
    this.irsMonitorService.getScreenshotUrl(check.id).subscribe({
      next: ({ url }) => {
        this.mainScreenshotUrls[check.id] = url;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mainScreenshotUrls[check.id] = 'error';
        this.cdr.detectChanges();
      },
    });
  }

  loadScreenshot(check: IrsCheck) {
    if (!check.screenshotPath || this.screenshotUrls[check.id]) return;
    this.screenshotUrls[check.id] = 'loading';
    this.cdr.detectChanges();
    this.irsMonitorService.getScreenshotUrl(check.id).subscribe({
      next: ({ url }) => {
        this.screenshotUrls[check.id] = url;
        this.cdr.detectChanges();
      },
      error: () => {
        this.screenshotUrls[check.id] = 'error';
        this.cdr.detectChanges();
      },
    });
  }

  getHistoryCheckIcon(check: IrsCheck): string {
    if (check.statusChanged) return '🔄';
    if (check.checkResult === 'not_found') return '🔍';
    if (check.checkResult === 'error' || check.checkResult === 'timeout') return '❌';
    if (!check.mappedStatus) return '❓';
    return '✅';
  }

  // ---- Poll helper ----

  private async pollForResult(
    taxCaseId: string,
    since: Date,
    onStatus: (label: string) => void,
  ): Promise<IrsCheck | null> {
    const deadline = Date.now() + 90 * 1000;
    let attempt = 0;
    while (Date.now() < deadline && !this.destroyed && !this.cancelBatchFlag) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      attempt++;
      if (attempt === 1) onStatus('Consultando IRS...');
      else if (attempt === 6) onStatus('Esperando respuesta IRS...');
      else if (attempt === 12) onStatus('Reintentando...');
      else if (attempt === 20) onStatus('Tomando más tiempo del usual...');
      try {
        const checks = await lastValueFrom(
          this.irsMonitorService.getChecksForClient(taxCaseId),
        );
        const found = checks.find(c => new Date(c.createdAt) > since);
        if (found) return found;
      } catch { /* keep trying */ }
    }
    return null;
  }

  private handleCheckResult(client: ClientRow, check: IrsCheck | null) {
    client.isChecking = false;
    client.checkStatusLabel = '';
    if (!check) {
      this.toastService.show(`⏱ ${client.clientName}: sin respuesta (timeout 90s)`, 'error');
      this.cdr.detectChanges();
      return;
    }
    client.lastCheckResult = check;
    if (check.statusChanged && check.mappedStatus) {
      this.toastService.show(
        `🔔 ${client.clientName}: recomendación → ${check.mappedStatus.replace(/_/g, ' ')} (pendiente de aprobación)`,
        'info',
      );
    } else if (check.checkResult === 'success' || check.checkResult === 'not_found') {
      this.toastService.show(`${client.clientName}: sin cambios (${check.irsRawStatus})`, 'info');
    } else {
      this.toastService.show(
        `❌ ${client.clientName}: ${check.errorMessage ?? check.irsRawStatus}`,
        'error',
      );
    }
    this.cdr.detectChanges();
  }

  // ---- Monitor toggle ----

  toggleMonitor(client: ClientRow) {
    const newValue = !client.irsMonitorEnabled;
    this.irsMonitorService.toggleMonitor(client.taxCaseId, newValue, client.irsMonitorIntervalHours).subscribe({
      next: (res) => {
        client.irsMonitorEnabled = res.irsMonitorEnabled;
        client.irsMonitorIntervalHours = res.irsMonitorIntervalHours;
        this.toastService.show(
          newValue
            ? `${client.clientName}: auto-monitoreo activado (cada ${res.irsMonitorIntervalHours}h)`
            : `${client.clientName}: auto-monitoreo desactivado`,
          'info',
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show(`Error: ${err.message}`, 'error');
      },
    });
  }

  updateInterval(client: ClientRow, hours: number) {
    if (!hours || hours < 1) return;
    this.irsMonitorService.toggleMonitor(client.taxCaseId, client.irsMonitorEnabled, hours).subscribe({
      next: (res) => {
        client.irsMonitorIntervalHours = res.irsMonitorIntervalHours;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show(`Error: ${err.message}`, 'error');
      },
    });
  }

  get monitoredCount(): number {
    return this.clients.filter(c => c.irsMonitorEnabled).length;
  }

  // ---- Single run ----

  runCheck(client: ClientRow) {
    if (client.isChecking) return;
    client.isChecking = true;
    client.checkStatusLabel = 'Iniciando...';
    this.cdr.detectChanges();
    const since = new Date();

    this.irsMonitorService.runCheck(client.taxCaseId).subscribe({
      next: () => {
        client.checkStatusLabel = 'Abriendo navegador...';
        this.cdr.detectChanges();
        this.pollForResult(client.taxCaseId, since, label => {
          client.checkStatusLabel = label;
          this.cdr.detectChanges();
        }).then(check => this.handleCheckResult(client, check));
      },
      error: (err) => {
        client.isChecking = false;
        client.checkStatusLabel = '';
        this.toastService.show(`Error: ${err.message}`, 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ---- Approve / Dismiss recommendation ----

  hasPendingRecommendation(client: ClientRow): boolean {
    const check = client.lastCheckResult ?? client.lastCheck;
    if (!check) return false;
    return check.statusChanged && !!check.mappedStatus && check.mappedStatus !== client.federalStatusNew;
  }

  getPendingCheck(client: ClientRow): IrsCheck | null {
    const check = client.lastCheckResult ?? client.lastCheck;
    if (!check) return null;
    if (check.statusChanged && check.mappedStatus && check.mappedStatus !== client.federalStatusNew) return check;
    return null;
  }

  approveRecommendation(client: ClientRow) {
    const check = this.getPendingCheck(client);
    if (!check) return;
    this.approveModalCheck = check;
    this.approveModalClient = client;
    this.approveClientComment = '';
    this.approveInternalComment = '';
    this.cdr.detectChanges();
  }

  confirmApprove() {
    const check = this.approveModalCheck;
    const client = this.approveModalClient;
    if (!check || !client) return;
    this.irsMonitorService.approveCheck(check.id, this.approveClientComment || undefined, this.approveInternalComment || undefined).subscribe({
      next: (res) => {
        if (res.applied) {
          client.federalStatusNew = check.mappedStatus;
          this.toastService.show(`${client.clientName}: estado actualizado a ${this.getStatusLabel(check.mappedStatus)}`, 'success');
        } else {
          this.toastService.show(`${client.clientName}: no se aplicó el cambio`, 'info');
        }
        this.cancelApprove();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show(`Error: ${err.message}`, 'error');
        this.cancelApprove();
      },
    });
  }

  cancelApprove() {
    this.approveModalCheck = null;
    this.approveModalClient = null;
    this.approveClientComment = '';
    this.approveInternalComment = '';
    this.cdr.detectChanges();
  }

  dismissRecommendation(client: ClientRow) {
    const check = this.getPendingCheck(client);
    if (!check) return;
    this.irsMonitorService.dismissCheck(check.id).subscribe({
      next: () => {
        check.statusChanged = false;
        this.toastService.show(`${client.clientName}: recomendación descartada`, 'info');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show(`Error: ${err.message}`, 'error');
      },
    });
  }

  // ---- CSV export ----

  exportCsv() {
    this.isExportingCsv = true;
    this.irsMonitorService.exportCsv();
    setTimeout(() => {
      this.isExportingCsv = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  // ---- Display helpers ----

  getStatusLabel(status: string | null): string {
    const labels: Record<string, string> = {
      taxes_en_proceso: 'En Proceso',
      en_verificacion: 'En Verificación',
      verificacion_en_progreso: 'Verificación en Progreso',
      problemas: 'Problemas',
      verificacion_rechazada: 'Verificación Rechazada',
      deposito_directo: 'Depósito Directo',
      cheque_en_camino: 'Cheque en Camino',
      comision_pendiente: 'Comisión Pendiente',
      taxes_completados: 'Completado',
    };
    return status ? (labels[status] ?? status) : '—';
  }

  getStatusClass(status: string | null): string {
    if (!status) return 'status-none';
    const classes: Record<string, string> = {
      taxes_en_proceso: 'status-pending',
      en_verificacion: 'status-review',
      verificacion_en_progreso: 'status-review',
      problemas: 'status-error',
      verificacion_rechazada: 'status-error',
      deposito_directo: 'status-success',
      cheque_en_camino: 'status-success',
      comision_pendiente: 'status-warning',
      taxes_completados: 'status-done',
    };
    return classes[status] ?? 'status-none';
  }

  getCheckResultIcon(result: IrsCheck | null): string {
    if (!result) return '';
    if (result.statusChanged) return '🔄';
    if (result.checkResult === 'error' || result.checkResult === 'timeout') return '❌';
    if (!result.mappedStatus) return '❓';
    return '✅';
  }

getIrsDetailExcerpt(rawStatus: string | null | undefined, details: string | null | undefined): string {
    if (!details) return '';
    return details.replace(rawStatus ?? '', '').replace(/\s+/g, ' ').trim();
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  goToDashboard() { this.router.navigate(['/admin/dashboard']); }
  goToDelays() { this.router.navigate(['/admin/delays']); }
  goToAlarms() { this.router.navigate(['/admin/alarms']); }
  goToTickets() { this.router.navigate(['/admin/tickets']); }
  goToPayments() { this.router.navigate(['/admin/payments']); }
  goToReferrals() { this.router.navigate(['/admin/referrals']); }
  goToAccounts() { this.router.navigate(['/admin/accounts']); }
  goToJai1gents() { this.router.navigate(['/admin/jai1gents']); }
  goToColoradoMonitor() { this.router.navigate(['/admin/colorado-monitor']); }
}
