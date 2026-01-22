import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ProfileResponse, TaxStatus, NotificationType, PreFilingStatus } from '../../core/models';
import { interval, Subscription, filter, skip, finalize } from 'rxjs';

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
  styleUrl: './tax-tracking.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxTracking implements OnInit, OnDestroy {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);

  profileData: ProfileResponse | null = null;
  isLoading = true;
  hasLoaded = false;
  lastRefresh: Date = new Date();
  isRefreshing = false;

  private subscriptions = new Subscription();
  private previousPreFilingStatus?: PreFilingStatus;
  private previousTaxesFiled?: boolean;
  private previousFederalStatus?: TaxStatus;
  private previousStateStatus?: TaxStatus;
  private isLoadingInProgress = false;
  private safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Shared initial steps (before split)
  sharedSteps: TrackingStep[] = [];

  // Federal track steps
  federalSteps: TrackingStep[] = [];

  // Estatal track steps
  estatalSteps: TrackingStep[] = [];

  ngOnInit() {
    this.loadTrackingData();

    this.subscriptions.add(
      interval(30000).subscribe(() => {
        this.silentRefresh();
      })
    );

    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.includes('/tax-tracking')),
        skip(1)
      ).subscribe(() => {
        if (this.hasLoaded) {
          this.loadTrackingData();
        }
      })
    );

    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-tracking').subscribe(() => {
        if (this.hasLoaded) {
          this.loadTrackingData();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    // Clear safety timeout to prevent memory leaks and errors after component destroy
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
  }

  loadTrackingData() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;

    // Build default steps (all pending) for initial state
    this.buildSteps();

    // Keep isLoading = true until API completes to show spinner
    // This ensures user sees complete, up-to-date data

    this.profileService.getProfile().pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoading = false;
        this.isLoadingInProgress = false;
        this.lastRefresh = new Date();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        if (data) {
          this.profileData = data;
          this.previousPreFilingStatus = data.taxCase?.preFilingStatus;
          this.previousTaxesFiled = data.taxCase?.taxesFiled;
          this.previousFederalStatus = data.taxCase?.federalStatus;
          this.previousStateStatus = data.taxCase?.stateStatus;
          this.buildSteps();
        }
      },
      error: () => {}
    });

    // Safety timeout - ensure content shows after 5 seconds
    // Clear any existing timeout before setting a new one
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
    }
    this.safetyTimeoutId = setTimeout(() => {
      if (!this.hasLoaded) {
        this.hasLoaded = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
      this.safetyTimeoutId = null;
    }, 5000);
  }

  silentRefresh() {
    this.profileService.getProfile().subscribe({
      next: (data) => {
        // Check for taxesFiled change (new filing)
        if (this.previousTaxesFiled === false && data.taxCase?.taxesFiled === true) {
          this.onTaxesFiled();
        }

        // Check for Federal status changes
        this.checkFederalStatusChange(data.taxCase?.federalStatus);

        // Check for State status changes
        this.checkStateStatusChange(data.taxCase?.stateStatus);

        this.previousPreFilingStatus = data.taxCase?.preFilingStatus;
        this.previousTaxesFiled = data.taxCase?.taxesFiled;
        this.previousFederalStatus = data.taxCase?.federalStatus;
        this.previousStateStatus = data.taxCase?.stateStatus;
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
        // Check for taxesFiled change (new filing)
        if (this.previousTaxesFiled === false && data.taxCase?.taxesFiled === true) {
          this.onTaxesFiled();
        }

        // Check for Federal status changes
        this.checkFederalStatusChange(data.taxCase?.federalStatus);

        // Check for State status changes
        this.checkStateStatusChange(data.taxCase?.stateStatus);

        this.previousPreFilingStatus = data.taxCase?.preFilingStatus;
        this.previousTaxesFiled = data.taxCase?.taxesFiled;
        this.previousFederalStatus = data.taxCase?.federalStatus;
        this.previousStateStatus = data.taxCase?.stateStatus;
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

  private onTaxesFiled() {
    // Taxes have been filed - declaration submitted to IRS
    // This hook can be used for analytics or other side effects in the future
  }

  private checkFederalStatusChange(newStatus?: TaxStatus): void {
    if (!this.previousFederalStatus || this.previousFederalStatus === newStatus) return;

    if (newStatus === TaxStatus.APPROVED) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Federal Aprobada!',
        'Tu declaración federal ha sido aprobada por el IRS. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (newStatus === TaxStatus.REJECTED) {
      this.notificationService.emitLocalNotification(
        'Declaración Federal Rechazada',
        'Tu declaración federal fue rechazada por el IRS. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (newStatus === TaxStatus.DEPOSITED) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Federal Depositado!',
        'Tu reembolso federal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
    }
  }

  private checkStateStatusChange(newStatus?: TaxStatus): void {
    if (!this.previousStateStatus || this.previousStateStatus === newStatus) return;

    if (newStatus === TaxStatus.APPROVED) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Estatal Aprobada!',
        'Tu declaración estatal ha sido aprobada. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (newStatus === TaxStatus.REJECTED) {
      this.notificationService.emitLocalNotification(
        'Declaración Estatal Rechazada',
        'Tu declaración estatal fue rechazada. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (newStatus === TaxStatus.DEPOSITED) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Estatal Depositado!',
        'Tu reembolso estatal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
    }
  }

  private buildSteps() {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const taxesFiled = taxCase?.taxesFiled || false;
    const preFilingStatus = taxCase?.preFilingStatus;
    const federalStatus = taxCase?.federalStatus;
    const stateStatus = taxCase?.stateStatus;

    // SHARED STEPS (Steps 1-2)
    this.sharedSteps = [
      {
        id: 'received',
        title: 'Información Recibida',
        description: 'Recibimos tus datos y documentos',
        icon: '📋',
        status: this.getStepStatusNew('received', taxesFiled, preFilingStatus, profile?.profileComplete),
        date: profile?.updatedAt ? this.formatDate(profile.updatedAt) : undefined,
        detail: profile?.profileComplete ? 'Perfil completo' : 'Pendiente de completar'
      },
      {
        id: 'submitted',
        title: 'Presentado al IRS',
        description: 'Tu declaración fue enviada al IRS',
        icon: '🏛️',
        status: this.getStepStatusNew('submitted', taxesFiled, preFilingStatus),
        date: taxesFiled ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: taxesFiled ? 'Declaración enviada' : 'Esperando envío'
      }
    ];

    // FEDERAL TRACK (3 steps)
    this.federalSteps = [
      {
        id: 'federal-decision',
        title: 'Decisión Federal',
        description: 'Resultado del IRS Federal',
        icon: this.getFederalDecisionIcon(federalStatus),
        status: this.getFederalDecisionStatusNew(federalStatus, taxesFiled),
        date: this.isFederalProcessed(federalStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getFederalDecisionDetail(federalStatus)
      },
      {
        id: 'federal-estimate',
        title: 'Fecha Estimada',
        description: 'Reembolso federal',
        icon: '📅',
        status: this.getFederalEstimateStatusNew(federalStatus, taxesFiled),
        date: taxCase?.federalEstimatedDate ? this.formatDate(taxCase.federalEstimatedDate) : undefined,
        detail: this.getFederalEstimateDetailNew(federalStatus, taxCase?.federalEstimatedDate)
      },
      {
        id: 'federal-sent',
        title: 'Reembolso Enviado',
        description: 'Federal depositado',
        icon: '💵',
        status: this.getFederalRefundStatusNew(federalStatus, taxesFiled),
        date: taxCase?.federalDepositDate ? this.formatDate(taxCase.federalDepositDate) : undefined,
        detail: this.getFederalRefundDetail(federalStatus, taxCase?.federalActualRefund)
      }
    ];

    // ESTATAL TRACK (3 steps)
    this.estatalSteps = [
      {
        id: 'state-decision',
        title: 'Decisión Estatal',
        description: 'Resultado del IRS Estatal',
        icon: this.getStateDecisionIcon(stateStatus),
        status: this.getStateDecisionStatusNew(stateStatus, taxesFiled),
        date: this.isStateProcessed(stateStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getStateDecisionDetail(stateStatus)
      },
      {
        id: 'state-estimate',
        title: 'Fecha Estimada',
        description: 'Reembolso estatal',
        icon: '📅',
        status: this.getStateEstimateStatusNew(stateStatus, taxesFiled),
        date: taxCase?.stateEstimatedDate ? this.formatDate(taxCase.stateEstimatedDate) : undefined,
        detail: this.getStateEstimateDetailNew(stateStatus, taxCase?.stateEstimatedDate)
      },
      {
        id: 'state-sent',
        title: 'Reembolso Enviado',
        description: 'Estatal depositado',
        icon: '💵',
        status: this.getStateRefundStatusNew(stateStatus, taxesFiled),
        date: taxCase?.stateDepositDate ? this.formatDate(taxCase.stateDepositDate) : undefined,
        detail: this.getStateRefundDetail(stateStatus, taxCase?.stateActualRefund)
      }
    ];
  }

  // ============ SHARED STEP HELPERS ============
  private getStepStatusNew(step: string, taxesFiled: boolean, preFilingStatus?: PreFilingStatus, profileComplete?: boolean): TrackingStep['status'] {
    if (step === 'received') {
      if (profileComplete) return 'completed';
      return 'active';
    }

    if (step === 'submitted') {
      if (taxesFiled) return 'completed';
      if (preFilingStatus === PreFilingStatus.DOCUMENTATION_COMPLETE) return 'active';
      return 'pending';
    }

    return 'pending';
  }

  // ============ FEDERAL HELPERS ============
  private getFederalDecisionIcon(federalStatus?: TaxStatus): string {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return '✅';
    if (federalStatus === TaxStatus.REJECTED) return '❌';
    return '🦅';
  }

  private getFederalDecisionStatusNew(federalStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    if (federalStatus === TaxStatus.PROCESSING) return 'active';
    if (taxesFiled) return 'active';
    return 'pending';
  }

  private getFederalDecisionDetail(federalStatus?: TaxStatus): string {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'Aprobado';
    if (federalStatus === TaxStatus.REJECTED) return 'Rechazado';
    if (federalStatus === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private isFederalProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getFederalEstimateStatusNew(federalStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    return 'pending';
  }

  private getFederalEstimateDetailNew(federalStatus?: TaxStatus, estimatedDate?: string): string {
    if (federalStatus === TaxStatus.REJECTED) return 'No aplica';
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getFederalRefundStatusNew(federalStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    if (federalStatus === TaxStatus.APPROVED) return 'active';
    return 'pending';
  }

  private getFederalRefundDetail(federalStatus?: TaxStatus, actualRefund?: number): string {
    if (federalStatus === TaxStatus.DEPOSITED) {
      return actualRefund ? `$${actualRefund.toLocaleString()}` : 'Depositado';
    }
    if (federalStatus === TaxStatus.REJECTED) return 'No aplica';
    if (federalStatus === TaxStatus.APPROVED) return 'En proceso';
    return 'Pendiente';
  }

  // ============ ESTATAL HELPERS ============
  private getStateDecisionIcon(stateStatus?: TaxStatus): string {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return '✅';
    if (stateStatus === TaxStatus.REJECTED) return '❌';
    return '🗽';
  }

  private getStateDecisionStatusNew(stateStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    if (stateStatus === TaxStatus.PROCESSING) return 'active';
    if (taxesFiled) return 'active';
    return 'pending';
  }

  private getStateDecisionDetail(stateStatus?: TaxStatus): string {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'Aprobado';
    if (stateStatus === TaxStatus.REJECTED) return 'Rechazado';
    if (stateStatus === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private isStateProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getStateEstimateStatusNew(stateStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    return 'pending';
  }

  private getStateEstimateDetailNew(stateStatus?: TaxStatus, estimatedDate?: string): string {
    if (stateStatus === TaxStatus.REJECTED) return 'No aplica';
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getStateRefundStatusNew(stateStatus?: TaxStatus, taxesFiled?: boolean): TrackingStep['status'] {
    if (stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    if (stateStatus === TaxStatus.APPROVED) return 'active';
    return 'pending';
  }

  private getStateRefundDetail(stateStatus?: TaxStatus, stateRefund?: number): string {
    if (stateStatus === TaxStatus.DEPOSITED) {
      return stateRefund ? `$${stateRefund.toLocaleString()}` : 'Depositado';
    }
    if (stateStatus === TaxStatus.REJECTED) return 'No aplica';
    if (stateStatus === TaxStatus.APPROVED) return 'En proceso';
    return 'Pendiente';
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

  // ============ COMPUTED PROPERTIES ============
  get federalProgressPercent(): number {
    const completed = this.federalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.federalSteps.length) * 100);
  }

  get estatalProgressPercent(): number {
    const completed = this.estatalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.estatalSteps.length) * 100);
  }

  get sharedProgressPercent(): number {
    const completed = this.sharedSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.sharedSteps.length) * 100);
  }

  get overallProgressPercent(): number {
    const totalSteps = this.sharedSteps.length + this.federalSteps.length + this.estatalSteps.length;
    const completedSteps =
      this.sharedSteps.filter(s => s.status === 'completed').length +
      this.federalSteps.filter(s => s.status === 'completed').length +
      this.estatalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / totalSteps) * 100);
  }

  get estimatedRefund(): number | null {
    return this.profileData?.taxCase?.estimatedRefund || null;
  }

  get hasProblem(): boolean {
    return this.profileData?.taxCase?.hasProblem || false;
  }

  get actualRefund(): number | null {
    // Compute from federal + state (source of truth)
    const federal = this.profileData?.taxCase?.federalActualRefund || 0;
    const state = this.profileData?.taxCase?.stateActualRefund || 0;
    const total = federal + state;
    return total > 0 ? total : null;
  }

  get lastRefreshFormatted(): string {
    return this.lastRefresh.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Returns true when client has completed their info but taxes haven't been filed yet.
   * This is the "Preparando declaracion" / "Informacion recibida" state.
   */
  get isPreparingDeclaration(): boolean {
    const profile = this.profileData?.profile;
    const taxCase = this.profileData?.taxCase;

    // Profile is complete and taxes haven't been filed yet
    return profile?.profileComplete === true && taxCase?.taxesFiled !== true;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
