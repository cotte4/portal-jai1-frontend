import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, lastValueFrom } from 'rxjs';
import {
  ColoradoMonitorService,
  ColoradoClient,
  ColoradoCheck,
} from '../../core/services/colorado-monitor.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';

interface ClientRow extends ColoradoClient {
  isChecking: boolean;
  checkStatusLabel: string;
  lastCheckResult: ColoradoCheck | null;
  hasLoaded: boolean;
}

@Component({
  selector: 'app-admin-colorado-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-colorado-monitor.html',
  styleUrls: ['./admin-colorado-monitor.css'],
})
export class AdminColoradoMonitor implements OnInit, OnDestroy {
  private coloradoMonitorService = inject(ColoradoMonitorService);
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

  // Stats badge
  changesLast24h = 0;
  coloradoFiledCount = 0;
  totalFiledCount = 0;

  // History drawer
  historyClient: ClientRow | null = null;
  historyChecks: ColoradoCheck[] = [];
  isLoadingHistory = false;

  // Screenshot loading state per checkId
  screenshotUrls: Record<string, string | 'loading' | 'error'> = {};

  isExportingCsv = false;
  hideCompleted = true;

  private readonly COMPLETED_STATUSES = ['taxes_completados', 'deposito_directo', 'cheque_en_camino'];

  get filteredClients(): ClientRow[] {
    if (!this.hideCompleted) return this.clients;
    return this.clients.filter(c => !this.COMPLETED_STATUSES.includes(c.stateStatusNew ?? ''));
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
  }

  ngOnDestroy() {
    this.destroyed = true;
  }

  loadStats() {
    this.coloradoMonitorService.getStats().subscribe({
      next: (s) => {
        this.changesLast24h = s.changesLast24h;
        this.coloradoFiledCount = s.coloradoFiledCount;
        this.totalFiledCount = s.totalFiledCount;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadClients() {
    this.isLoading = true;
    this.error = null;
    this.selectedIds.clear();

    this.coloradoMonitorService
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
        this.toastService.show('Maximo 10 clientes por batch', 'info');
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
        await lastValueFrom(this.coloradoMonitorService.runCheck(client.taxCaseId));
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
        this.toastService.show(`${client.clientName}: error`, 'error');
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
    this.coloradoMonitorService.runCheckAll()
      .pipe(finalize(() => {
        this.isRunningAll = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.toastService.show(
            'Verificacion de todos los clientes CO iniciada en segundo plano',
            'info',
          );
        },
        error: (err) => {
          this.toastService.show(`Error al iniciar verificacion: ${err.message}`, 'error');
        },
      });
  }

  // ---- History drawer ----

  openHistory(client: ClientRow) {
    this.historyClient = client;
    this.historyChecks = [];
    this.isLoadingHistory = true;
    this.cdr.detectChanges();
    this.coloradoMonitorService
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

  loadScreenshot(check: ColoradoCheck) {
    if (!check.screenshotPath || this.screenshotUrls[check.id]) return;
    this.screenshotUrls[check.id] = 'loading';
    this.cdr.detectChanges();
    this.coloradoMonitorService.getScreenshotUrl(check.id).subscribe({
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

  getHistoryCheckIcon(check: ColoradoCheck): string {
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
  ): Promise<ColoradoCheck | null> {
    const deadline = Date.now() + 90 * 1000;
    let attempt = 0;
    while (Date.now() < deadline && !this.destroyed) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      attempt++;
      if (attempt === 1) onStatus('Consultando Colorado...');
      else if (attempt === 6) onStatus('Esperando respuesta...');
      else if (attempt === 12) onStatus('Reintentando...');
      else if (attempt === 20) onStatus('Tomando mas tiempo del usual...');
      try {
        const checks = await lastValueFrom(
          this.coloradoMonitorService.getChecksForClient(taxCaseId),
        );
        const found = checks.find(c => new Date(c.createdAt) > since);
        if (found) return found;
      } catch { /* keep trying */ }
    }
    return null;
  }

  private handleCheckResult(client: ClientRow, check: ColoradoCheck | null) {
    client.isChecking = false;
    client.checkStatusLabel = '';
    if (!check) {
      this.toastService.show(`${client.clientName}: sin respuesta (timeout 90s)`, 'error');
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
      this.toastService.show(`${client.clientName}: sin cambios (${check.coRawStatus})`, 'info');
    } else {
      this.toastService.show(
        `${client.clientName}: ${check.errorMessage ?? check.coRawStatus}`,
        'error',
      );
    }
    this.cdr.detectChanges();
  }

  // ---- Single run ----

  runCheck(client: ClientRow) {
    if (client.isChecking) return;
    client.isChecking = true;
    client.checkStatusLabel = 'Iniciando...';
    this.cdr.detectChanges();
    const since = new Date();

    this.coloradoMonitorService.runCheck(client.taxCaseId).subscribe({
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
    return check.statusChanged && !!check.mappedStatus && check.mappedStatus !== client.stateStatusNew;
  }

  getPendingCheck(client: ClientRow): ColoradoCheck | null {
    const check = client.lastCheckResult ?? client.lastCheck;
    if (!check) return null;
    if (check.statusChanged && check.mappedStatus && check.mappedStatus !== client.stateStatusNew) return check;
    return null;
  }

  approveRecommendation(client: ClientRow) {
    const check = this.getPendingCheck(client);
    if (!check) return;
    this.coloradoMonitorService.approveCheck(check.id).subscribe({
      next: (res) => {
        if (res.applied) {
          client.stateStatusNew = check.mappedStatus;
          this.toastService.show(`${client.clientName}: estado actualizado a ${this.getStatusLabel(check.mappedStatus)}`, 'success');
        } else {
          this.toastService.show(`${client.clientName}: no se aplico el cambio`, 'info');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show(`Error: ${err.message}`, 'error');
      },
    });
  }

  dismissRecommendation(client: ClientRow) {
    const check = this.getPendingCheck(client);
    if (!check) return;
    this.coloradoMonitorService.dismissCheck(check.id).subscribe({
      next: () => {
        check.statusChanged = false;
        this.toastService.show(`${client.clientName}: recomendacion descartada`, 'info');
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
    this.coloradoMonitorService.exportCsv();
    setTimeout(() => {
      this.isExportingCsv = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  // ---- Display helpers ----

  getStatusLabel(status: string | null): string {
    const labels: Record<string, string> = {
      taxes_en_proceso: 'En Proceso',
      en_verificacion: 'En Verificacion',
      verificacion_en_progreso: 'Verificacion en Progreso',
      problemas: 'Problemas',
      verificacion_rechazada: 'Verificacion Rechazada',
      deposito_directo: 'Deposito Directo',
      cheque_en_camino: 'Cheque en Camino',
      comision_pendiente: 'Comision Pendiente',
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

  getCheckResultIcon(result: ColoradoCheck | null): string {
    if (!result) return '';
    if (result.statusChanged) return '🔄';
    if (result.checkResult === 'error' || result.checkResult === 'timeout') return '❌';
    if (!result.mappedStatus) return '❓';
    return '✅';
  }

  getCoDetailExcerpt(rawStatus: string | null | undefined, details: string | null | undefined): string {
    if (!details) return '';

    let text = details;
    if (rawStatus) text = text.replace(rawStatus, '');

    const noisePatterns = [
      /Go\s*back\s*to\s*Home/gi,
      /Check\s*Refund\s*Status/gi,
      /Where'?s\s*My\s*Refund/gi,
      /Colorado\s*Revenue\s*Online/gi,
      /Colorado\s*Department\s*of\s*Revenue/gi,
      /Skip\s*to\s*main\s*content/gi,
      /Log\s*[Ii]n/gi,
      /Sign\s*[Oo]ut/gi,
      /Privacy\s*Policy/gi,
      /Terms\s*of\s*Use/gi,
      /Contact\s*Us/gi,
      /©\s*\d{4}/gi,
      /All\s*Rights\s*Reserved/gi,
      // Form field labels (scraped from input page on old checks)
      /TypeId\s*Type\s*SSN/gi,
      /Refund\s*Amount[:\s-]*/gi,
      /OR\s*-?\s*PIN\/?/gi,
      /Let.*$/gi,
      /Return Not Received or Not Yet Processed/gi,
      /Return Received\s*&?\s*Being Processed/gi,
      /Refund Reviewed/gi,
      /Refund Approved and Sent/gi,
      /Your refund status will be updated daily[^.]*\./gi,
      /Please feel free to check back periodically[^.]*\./gi,
    ];
    for (const pattern of noisePatterns) {
      text = text.replace(pattern, '');
    }

    text = text.replace(/\s*\|\s*$/, '').replace(/^\s*\|\s*/, '').replace(/\s+/g, ' ').trim();

    if (text.length > 160) text = text.slice(0, 160).replace(/\s\S*$/, '…');

    return text;
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
  goToIrsMonitor() { this.router.navigate(['/admin/irs-monitor']); }
}
