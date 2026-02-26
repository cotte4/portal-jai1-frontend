import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, lastValueFrom } from 'rxjs';
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
  imports: [CommonModule],
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

  // Stats badge
  changesLast24h = 0;

  // History drawer
  historyClient: ClientRow | null = null;
  historyChecks: IrsCheck[] = [];
  isLoadingHistory = false;

  // Screenshot loading state per checkId
  screenshotUrls: Record<string, string | 'loading' | 'error'> = {};

  isExportingCsv = false;

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
    while (Date.now() < deadline && !this.destroyed) {
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
      client.federalStatusNew = check.mappedStatus;
      this.toastService.show(
        `✅ ${client.clientName}: estado → ${check.mappedStatus.replace(/_/g, ' ')}`,
        'success',
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

  getFilingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      single:            'Single',
      married_joint:     'Married Joint',
      married_separate:  'Married Sep.',
      head_of_household: 'Head of HH',
    };
    return labels[status] ?? status;
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
}
