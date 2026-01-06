import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ProfileResponse, ClientStatus, TaxStatus } from '../../core/models';
import { interval, Subscription, filter, skip } from 'rxjs';

interface TrackingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'rejected';
  date?: string;
  detail?: string;
}

@Component({
  selector: 'app-tax-tracking',
  imports: [CommonModule],
  templateUrl: './tax-tracking.html',
  styleUrl: './tax-tracking.css'
})
export class TaxTracking implements OnInit, OnDestroy {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);

  profileData: ProfileResponse | null = null;
  isLoading = true;
  lastRefresh: Date = new Date();
  isRefreshing = false;

  private subscriptions = new Subscription();
  private previousStatus?: ClientStatus;

  steps: TrackingStep[] = [];

  private isInitialized = false;

  ngOnInit() {
    console.log('[TaxTracking] ngOnInit - loading data');

    // Load initial data - isInitialized will be set after load completes
    this.loadTrackingData(true);

    // Auto-refresh every 30 seconds
    this.subscriptions.add(
      interval(30000).subscribe(() => {
        this.silentRefresh();
      })
    );

    // Auto-refresh on navigation - skip(1) to ignore the initial navigation that created this component
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.includes('/tax-tracking')),
        skip(1)
      ).subscribe(() => {
        if (!this.isLoading) {
          console.log('[TaxTracking] NavigationEnd detected, refreshing');
          this.loadTrackingData();
        }
      })
    );

    // Allow other components to trigger refresh - only after initial load is complete
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-tracking').subscribe(() => {
        if (this.isInitialized && !this.isLoading) {
          console.log('[TaxTracking] DataRefreshService triggered, refreshing');
          this.loadTrackingData();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadTrackingData(isInitialLoad = false) {
    console.log('[TaxTracking] loadTrackingData called, isInitialLoad:', isInitialLoad);
    this.isLoading = true;
    // Build default steps first
    this.buildSteps();

    // Safety timeout - stop loading after 20 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        console.warn('[TaxTracking] Safety timeout triggered');
        if (isInitialLoad) {
          this.isInitialized = true;
        }
      }
    }, 20000);

    this.profileService.getProfile().subscribe({
      next: (data) => {
        clearTimeout(safetyTimeout);
        if (data) {
          this.profileData = data;
          this.previousStatus = data.taxCase?.clientStatus;
          this.buildSteps();
        }
        this.isLoading = false;
        this.lastRefresh = new Date();
        console.log('[TaxTracking] Data loaded successfully');
        // Mark as initialized AFTER the load completes
        if (isInitialLoad) {
          console.log('[TaxTracking] Initial load complete, setting isInitialized = true');
          this.isInitialized = true;
        }
        this.cdr.detectChanges(); // Force Angular to update the view
      },
      error: () => {
        clearTimeout(safetyTimeout);
        this.isLoading = false;
        // Keep default steps even on error
        if (isInitialLoad) {
          this.isInitialized = true;
        }
        this.cdr.detectChanges(); // Force Angular to update the view
      }
    });
  }

  silentRefresh() {
    this.profileService.getProfile().subscribe({
      next: (data) => {
        // Check if status changed
        if (this.previousStatus && data.taxCase?.clientStatus !== this.previousStatus) {
          this.onStatusChanged(data.taxCase?.clientStatus);
        }

        this.previousStatus = data.taxCase?.clientStatus;
        this.profileData = data;
        this.buildSteps();
        this.lastRefresh = new Date();
        this.cdr.detectChanges();
      }
    });
  }

  manualRefresh() {
    this.isRefreshing = true;
    this.profileService.getProfile().subscribe({
      next: (data) => {
        // Check if status changed
        if (this.previousStatus && data.taxCase?.clientStatus !== this.previousStatus) {
          this.onStatusChanged(data.taxCase?.clientStatus);
        }

        this.previousStatus = data.taxCase?.clientStatus;
        this.profileData = data;
        this.buildSteps();
        this.lastRefresh = new Date();
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    });
  }

  private onStatusChanged(newStatus?: ClientStatus) {
    if (!newStatus) return;

    // Trigger notification for status change
    const statusMessages: Record<ClientStatus, string> = {
      [ClientStatus.ESPERANDO_DATOS]: 'Estamos esperando tus datos',
      [ClientStatus.CUENTA_EN_REVISION]: '¡Tu cuenta está siendo revisada!',
      [ClientStatus.TAXES_EN_PROCESO]: '¡Tu declaración está siendo procesada!',
      [ClientStatus.TAXES_EN_CAMINO]: '¡Tu reembolso está en camino!',
      [ClientStatus.TAXES_DEPOSITADOS]: '¡Tu reembolso fue depositado!',
      [ClientStatus.PAGO_REALIZADO]: 'Pago recibido, gracias!',
      [ClientStatus.EN_VERIFICACION]: 'El IRS está verificando tu declaración',
      [ClientStatus.TAXES_FINALIZADOS]: '¡Proceso completado exitosamente!'
    };

    // The notification will appear in the bell icon
    console.log('Status changed:', statusMessages[newStatus]);
  }

  private buildSteps() {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    // Determine current status
    const clientStatus = taxCase?.clientStatus || ClientStatus.ESPERANDO_DATOS;
    const federalStatus = taxCase?.federalStatus;
    const stateStatus = taxCase?.stateStatus;

    this.steps = [
      {
        id: 'received',
        title: 'Información Recibida',
        description: 'Recibimos tus datos y documentos',
        icon: '📋',
        status: this.getStepStatus('received', clientStatus, profile?.profileComplete),
        date: profile?.updatedAt ? this.formatDate(profile.updatedAt) : undefined,
        detail: profile?.profileComplete ? 'Perfil completo' : 'Pendiente de completar'
      },
      {
        id: 'submitted',
        title: 'Presentado al IRS',
        description: 'Tu declaración fue enviada al IRS',
        icon: '🏛️',
        status: this.getStepStatus('submitted', clientStatus),
        date: this.isSubmitted(clientStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.isSubmitted(clientStatus) ? 'Declaración enviada' : 'Esperando envío'
      },
      {
        id: 'federal',
        title: 'IRS Federal',
        description: 'Revisión de tu declaración federal',
        icon: '🦅',
        status: this.getFederalStatus(federalStatus, clientStatus),
        date: this.isFederalProcessed(federalStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getFederalDetail(federalStatus)
      },
      {
        id: 'state',
        title: 'Impuestos Estatales',
        description: 'Revisión de tu declaración estatal',
        icon: '🗽',
        status: this.getStateStatus(stateStatus, clientStatus),
        date: this.isStateProcessed(stateStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getStateDetail(stateStatus)
      },
      {
        id: 'refund',
        title: 'Reembolso Enviado',
        description: 'Tu dinero está en camino',
        icon: '💰',
        status: this.getRefundStatus(clientStatus),
        date: taxCase?.refundDepositDate ? this.formatDate(taxCase.refundDepositDate) : undefined,
        detail: this.getRefundDetail(clientStatus, taxCase?.actualRefund)
      }
    ];
  }

  private getStepStatus(step: string, clientStatus: ClientStatus, profileComplete?: boolean): TrackingStep['status'] {
    if (step === 'received') {
      if (profileComplete) return 'completed';
      return 'active';
    }
    
    if (step === 'submitted') {
      const submittedStatuses = [
        ClientStatus.TAXES_EN_PROCESO,
        ClientStatus.TAXES_EN_CAMINO,
        ClientStatus.EN_VERIFICACION,
        ClientStatus.TAXES_DEPOSITADOS,
        ClientStatus.TAXES_FINALIZADOS
      ];
      if (submittedStatuses.includes(clientStatus)) return 'completed';
      if (clientStatus === ClientStatus.CUENTA_EN_REVISION) return 'active';
      return 'pending';
    }

    return 'pending';
  }

  private isSubmitted(status: ClientStatus): boolean {
    const submittedStatuses = [
      ClientStatus.TAXES_EN_PROCESO,
      ClientStatus.TAXES_EN_CAMINO,
      ClientStatus.EN_VERIFICACION,
      ClientStatus.TAXES_DEPOSITADOS,
      ClientStatus.TAXES_FINALIZADOS
    ];
    return submittedStatuses.includes(status);
  }

  private getFederalStatus(federalStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    if (federalStatus === TaxStatus.PROCESSING) return 'active';
    if (this.isSubmitted(clientStatus || ClientStatus.ESPERANDO_DATOS)) return 'active';
    return 'pending';
  }

  private isFederalProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getFederalDetail(status?: TaxStatus): string {
    if (status === TaxStatus.APPROVED) return '✓ Aprobado por el IRS';
    if (status === TaxStatus.REJECTED) return '✗ Requiere revisión';
    if (status === TaxStatus.DEPOSITED) return '✓ Procesado y depositado';
    if (status === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private getStateStatus(stateStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    if (stateStatus === TaxStatus.PROCESSING) return 'active';
    return 'pending';
  }

  private isStateProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getStateDetail(status?: TaxStatus): string {
    if (status === TaxStatus.APPROVED) return '✓ Aprobado';
    if (status === TaxStatus.REJECTED) return '✗ Requiere revisión';
    if (status === TaxStatus.DEPOSITED) return '✓ Procesado';
    if (status === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private getRefundStatus(clientStatus: ClientStatus): TrackingStep['status'] {
    if (clientStatus === ClientStatus.TAXES_DEPOSITADOS || clientStatus === ClientStatus.TAXES_FINALIZADOS) {
      return 'completed';
    }
    if (clientStatus === ClientStatus.TAXES_EN_CAMINO) return 'active';
    return 'pending';
  }

  private getRefundDetail(clientStatus: ClientStatus, actualRefund?: number): string {
    if (clientStatus === ClientStatus.TAXES_DEPOSITADOS || clientStatus === ClientStatus.TAXES_FINALIZADOS) {
      return actualRefund ? `$${actualRefund.toLocaleString()} depositados` : '¡Depositado!';
    }
    if (clientStatus === ClientStatus.TAXES_EN_CAMINO) {
      return 'En proceso de transferencia';
    }
    return 'Esperando aprobación';
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  get currentStepIndex(): number {
    if (!this.steps || this.steps.length === 0) return 0;
    
    const activeIndex = this.steps.findIndex(s => s.status === 'active');
    if (activeIndex >= 0) return activeIndex;
    
    const lastCompleted = this.steps.map((s, i) => s.status === 'completed' ? i : -1)
      .filter(i => i >= 0)
      .pop();
    
    return lastCompleted !== undefined ? lastCompleted : 0;
  }

  get progressPercent(): number {
    if (!this.steps || this.steps.length === 0) return 0;
    const completed = this.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.steps.length) * 100);
  }

  get estimatedRefund(): number | null {
    return this.profileData?.taxCase?.estimatedRefund || null;
  }

  get actualRefund(): number | null {
    return this.profileData?.taxCase?.actualRefund || null;
  }

  get lastRefreshFormatted(): string {
    return this.lastRefresh.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}

