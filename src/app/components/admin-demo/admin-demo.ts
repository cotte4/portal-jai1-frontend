import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { CaseStatus, FederalStatusNew, StateStatusNew, UpdateStatusRequest } from '../../core/models';

interface DemoStatus {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  clientProfileId: string | null;
  taxCase: {
    id: string;
    caseStatus: string | null;
    federalStatusNew: string | null;
    stateStatusNew: string | null;
    estimatedRefund: number | null;
    federalActualRefund: number | null;
    stateActualRefund: number | null;
  } | null;
}

@Component({
  selector: 'app-admin-demo',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-demo.html',
  styleUrl: './admin-demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDemo implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  themeService = inject(ThemeService);

  get darkMode() { return this.themeService.darkMode(); }

  isLoading = true;
  errorMessage = '';
  successMessage = '';
  demoStatus: DemoStatus | null = null;

  // Status controls
  selectedCaseStatus: string = '';
  selectedFederalStatus: string = '';
  selectedStateStatus: string = '';
  isUpdatingStatus = false;

  // Notification
  notifTitle = '';
  notifMessage = '';
  isSendingNotif = false;

  // Actions
  isResetting = false;
  isOpeningDemo = false;

  caseStatusOptions = [
    { value: '', label: '— no cambiar —' },
    { value: CaseStatus.AWAITING_FORM, label: 'Esperando Formulario' },
    { value: CaseStatus.AWAITING_DOCS, label: 'Esperando Documentos' },
    { value: CaseStatus.PREPARING, label: 'Preparando' },
    { value: CaseStatus.TAXES_FILED, label: 'Taxes Presentados' },
    { value: CaseStatus.CASE_ISSUES, label: 'Con Problemas' },
  ];

  federalStatusOptions = [
    { value: '', label: '— no cambiar —' },
    { value: FederalStatusNew.TAXES_EN_PROCESO, label: 'En Proceso' },
    { value: FederalStatusNew.EN_VERIFICACION, label: 'En Verificación' },
    { value: FederalStatusNew.VERIFICACION_EN_PROGRESO, label: 'Verificación en Progreso' },
    { value: FederalStatusNew.CHEQUE_EN_CAMINO, label: 'Cheque en Camino' },
    { value: FederalStatusNew.DEPOSITO_DIRECTO, label: 'Depósito Directo' },
    { value: FederalStatusNew.COMISION_PENDIENTE, label: 'Comisión Pendiente' },
    { value: FederalStatusNew.TAXES_COMPLETADOS, label: 'Taxes Completados' },
    { value: FederalStatusNew.PROBLEMAS, label: 'Problemas' },
  ];

  stateStatusOptions = [
    { value: '', label: '— no cambiar —' },
    { value: StateStatusNew.TAXES_EN_PROCESO, label: 'En Proceso' },
    { value: StateStatusNew.EN_VERIFICACION, label: 'En Verificación' },
    { value: StateStatusNew.VERIFICACION_EN_PROGRESO, label: 'Verificación en Progreso' },
    { value: StateStatusNew.CHEQUE_EN_CAMINO, label: 'Cheque en Camino' },
    { value: StateStatusNew.DEPOSITO_DIRECTO, label: 'Depósito Directo' },
    { value: StateStatusNew.COMISION_PENDIENTE, label: 'Comisión Pendiente' },
    { value: StateStatusNew.TAXES_COMPLETADOS, label: 'Taxes Completados' },
    { value: StateStatusNew.PROBLEMAS, label: 'Problemas' },
  ];

  ngOnInit() {
    this.loadDemoStatus();
  }

  loadDemoStatus() {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminService.getDemoStatus().subscribe({
      next: (status) => {
        this.demoStatus = status;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No se pudo cargar el estado de la cuenta demo.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyStatus() {
    if (!this.demoStatus?.clientProfileId) {
      this.errorMessage = 'La cuenta demo no tiene perfil de cliente aún.';
      this.cdr.markForCheck();
      return;
    }

    const update: UpdateStatusRequest = {};
    if (this.selectedCaseStatus) update.caseStatus = this.selectedCaseStatus as CaseStatus;
    if (this.selectedFederalStatus) update.federalStatusNew = this.selectedFederalStatus as FederalStatusNew;
    if (this.selectedStateStatus) update.stateStatusNew = this.selectedStateStatus as StateStatusNew;

    if (!update.caseStatus && !update.federalStatusNew && !update.stateStatusNew) {
      this.errorMessage = 'Seleccioná al menos un estado para cambiar.';
      this.cdr.markForCheck();
      return;
    }

    this.isUpdatingStatus = true;
    this.errorMessage = '';
    this.adminService.updateStatus(this.demoStatus.clientProfileId, update).subscribe({
      next: () => {
        this.successMessage = 'Estado actualizado correctamente.';
        this.isUpdatingStatus = false;
        this.selectedCaseStatus = '';
        this.selectedFederalStatus = '';
        this.selectedStateStatus = '';
        this.loadDemoStatus();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al actualizar el estado.';
        this.isUpdatingStatus = false;
        this.cdr.markForCheck();
      }
    });
  }

  sendNotification() {
    if (!this.demoStatus?.clientProfileId || !this.notifTitle || !this.notifMessage) {
      this.errorMessage = 'Completá el título y mensaje de la notificación.';
      this.cdr.markForCheck();
      return;
    }

    this.isSendingNotif = true;
    this.errorMessage = '';
    this.adminService.sendClientNotification(this.demoStatus.clientProfileId, {
      title: this.notifTitle,
      message: this.notifMessage,
    }).subscribe({
      next: () => {
        this.successMessage = 'Notificación enviada al demo.';
        this.notifTitle = '';
        this.notifMessage = '';
        this.isSendingNotif = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al enviar la notificación.';
        this.isSendingNotif = false;
        this.cdr.markForCheck();
      }
    });
  }

  resetDemo() {
    if (!confirm('¿Resetear la cuenta demo? Se borrarán todos los datos del cliente demo.')) return;
    this.isResetting = true;
    this.errorMessage = '';
    this.adminService.resetDemo().subscribe({
      next: () => {
        this.successMessage = 'Cuenta demo reseteada correctamente.';
        this.isResetting = false;
        this.loadDemoStatus();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al resetear la cuenta demo.';
        this.isResetting = false;
        this.cdr.markForCheck();
      }
    });
  }

  openDemo() {
    this.isOpeningDemo = true;
    this.adminService.startDemoSession().subscribe({
      next: (auth) => {
        // Store tokens and open portal in new tab
        localStorage.setItem('access_token', auth.access_token);
        localStorage.setItem('refresh_token', auth.refresh_token);
        this.isOpeningDemo = false;
        window.open('/dashboard', '_blank');
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'No se pudo iniciar la sesión demo.';
        this.isOpeningDemo = false;
        this.cdr.markForCheck();
      }
    });
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    const map: Record<string, string> = {
      awaiting_form: 'Esperando Formulario',
      awaiting_docs: 'Esperando Documentos',
      preparing: 'Preparando',
      taxes_filed: 'Taxes Presentados',
      case_issues: 'Con Problemas',
      taxes_en_proceso: 'En Proceso',
      en_verificacion: 'En Verificación',
      verificacion_en_progreso: 'Verificación en Progreso',
      cheque_en_camino: 'Cheque en Camino',
      deposito_directo: 'Depósito Directo',
      comision_pendiente: 'Comisión Pendiente',
      taxes_completados: 'Taxes Completados',
      problemas: 'Problemas',
    };
    return map[status] || status;
  }
}
