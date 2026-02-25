import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, lastValueFrom } from 'rxjs';
import {
  IrsMonitorService,
  IrsClient,
  RunCheckResponse,
} from '../../core/services/irs-monitor.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';

interface ClientRow extends IrsClient {
  isChecking: boolean;
  lastCheckResult: RunCheckResponse | null;
  hasLoaded: boolean;
}

@Component({
  selector: 'app-admin-irs-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-irs-monitor.html',
  styleUrls: ['./admin-irs-monitor.css'],
})
export class AdminIrsMonitor implements OnInit {
  private irsMonitorService = inject(IrsMonitorService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  themeService = inject(ThemeService);

  clients: ClientRow[] = [];
  isLoading = true;
  hasLoaded = false;
  error: string | null = null;
  sidebarCollapsed = false;

  // Batch state
  selectedIds = new Set<string>();
  isRunningBatch = false;
  private cancelBatchFlag = false;
  batchProgress: { current: number; total: number } | null = null;

  get darkMode() {
    return this.themeService.darkMode();
  }

  get selectedCount() {
    return this.selectedIds.size;
  }

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.isLoading = true;
    this.error = null;
    this.selectedIds.clear();

    this.irsMonitorService
      .getFiledClients()
      .pipe(finalize(() => { this.isLoading = false; this.hasLoaded = true; }))
      .subscribe({
        next: (clients) => {
          this.clients = clients.map((c) => ({
            ...c,
            isChecking: false,
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

    for (const client of selected) {
      if (this.cancelBatchFlag) break;

      client.isChecking = true;
      this.batchProgress = { current: this.batchProgress!.current + 1, total: selected.length };

      try {
        const result = await lastValueFrom(this.irsMonitorService.runCheck(client.taxCaseId));
        client.lastCheckResult = result;
        if (result.statusChanged) {
          client.federalStatusNew = result.newStatus;
          this.toastService.show(
            `✅ ${client.clientName}: ${result.newStatus?.replace(/_/g, ' ')}`,
            'success',
          );
        }
      } catch {
        this.toastService.show(`❌ ${client.clientName}: error`, 'error');
      } finally {
        client.isChecking = false;
      }
    }

    const wasCancelled = this.cancelBatchFlag;
    this.isRunningBatch = false;
    this.batchProgress = null;
    this.cancelBatchFlag = false;

    if (!wasCancelled) {
      this.selectedIds.clear();
      const n = selected.length;
      this.toastService.show(`Batch completado: ${n} cliente${n !== 1 ? 's' : ''} verificado${n !== 1 ? 's' : ''}`, 'success');
    }
  }

  // ---- Single run ----

  runCheck(client: ClientRow) {
    if (client.isChecking) return;
    client.isChecking = true;

    this.irsMonitorService
      .runCheck(client.taxCaseId)
      .pipe(finalize(() => { client.isChecking = false; }))
      .subscribe({
        next: (result) => {
          client.lastCheckResult = result;
          if (result.statusChanged) {
            client.federalStatusNew = result.newStatus;
            this.toastService.show(
              `✅ ${client.clientName}: estado actualizado a ${result.newStatus?.replace(/_/g, ' ')}`,
              'success',
            );
          } else if (result.success) {
            this.toastService.show(
              `${client.clientName}: sin cambios (${result.rawStatus})`,
              'info',
            );
          } else {
            this.toastService.show(
              `❌ ${client.clientName}: ${result.error ?? result.rawStatus}`,
              'error',
            );
          }
        },
        error: (err) => {
          this.toastService.show(`Error: ${err.message}`, 'error');
        },
      });
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

  getCheckResultIcon(result: ClientRow['lastCheckResult']): string {
    if (!result) return '';
    if (result.statusChanged) return '🔄';
    if (!result.success) return '❌';
    // Scraper worked but mapper didn't recognize the IRS text — admin should read the detail
    if (result.newStatus === null) return '❓';
    return '✅';
  }

  /**
   * Returns the meaningful content from irsDetails — strips the heading from
   * the front (since it's already shown), collapses whitespace, and truncates.
   * Used as the subtitle line under the IRS heading in the table.
   */
  getIrsDetailExcerpt(rawStatus: string | null | undefined, details: string | null | undefined): string {
    if (!details) return '';
    // Remove the heading (already shown above), collapse whitespace — CSS clips the rest
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
