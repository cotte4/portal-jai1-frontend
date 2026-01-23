import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { ProfileResponse, NotificationType, CaseStatus, FederalStatusNew, StateStatusNew } from '../../core/models';
import { interval, Subscription, filter, skip, finalize } from 'rxjs';
import {
  mapFederalStatusToDisplay,
  mapStateStatusToDisplay,
  isFederalApproved,
  isFederalRejected,
  isFederalDeposited,
  isStateApproved,
  isStateRejected,
  isStateDeposited
} from '../../core/utils/status-display-mapper';

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
  private confettiService = inject(ConfettiService);
  private cdr = inject(ChangeDetectorRef);

  profileData: ProfileResponse | null = null;
  isLoading = true;
  hasLoaded = false;
  lastRefresh: Date = new Date();
  isRefreshing = false;

  private subscriptions = new Subscription();
  private previousCaseStatus?: CaseStatus;
  private previousTaxesFiled?: boolean;
  private previousFederalStatus?: FederalStatusNew; // V2 status only
  private previousStateStatus?: StateStatusNew; // V2 status only
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
          this.previousCaseStatus = data.taxCase?.caseStatus;
          this.previousTaxesFiled = data.taxCase?.caseStatus === CaseStatus.TAXES_FILED;
          // Track v2 status fields only
          this.previousFederalStatus = data.taxCase?.federalStatusNew;
          this.previousStateStatus = data.taxCase?.stateStatusNew;
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
        // Check for taxes filed change (new filing)
        const currentTaxesFiled = data.taxCase?.caseStatus === CaseStatus.TAXES_FILED;
        if (this.previousTaxesFiled === false && currentTaxesFiled === true) {
          this.onTaxesFiled();
        }

        // Get v2 status fields only
        const currentFederalStatus = data.taxCase?.federalStatusNew;
        const currentStateStatus = data.taxCase?.stateStatusNew;

        // Check for Federal status changes
        this.checkFederalStatusChange(currentFederalStatus);

        // Check for State status changes
        this.checkStateStatusChange(currentStateStatus);

        this.previousCaseStatus = data.taxCase?.caseStatus;
        this.previousTaxesFiled = currentTaxesFiled;
        this.previousFederalStatus = currentFederalStatus;
        this.previousStateStatus = currentStateStatus;
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
        // Check for taxes filed change (new filing)
        const currentTaxesFiled = data.taxCase?.caseStatus === CaseStatus.TAXES_FILED;
        if (this.previousTaxesFiled === false && currentTaxesFiled === true) {
          this.onTaxesFiled();
        }

        // Get v2 status fields only
        const currentFederalStatus = data.taxCase?.federalStatusNew;
        const currentStateStatus = data.taxCase?.stateStatusNew;

        // Check for Federal status changes
        this.checkFederalStatusChange(currentFederalStatus);

        // Check for State status changes
        this.checkStateStatusChange(currentStateStatus);

        this.previousCaseStatus = data.taxCase?.caseStatus;
        this.previousTaxesFiled = currentTaxesFiled;
        this.previousFederalStatus = currentFederalStatus;
        this.previousStateStatus = currentStateStatus;
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

  private checkFederalStatusChange(newStatus?: any): void {
    if (!this.previousFederalStatus || this.previousFederalStatus === newStatus) return;

    // Handle V2 FederalStatusNew values
    if (isFederalApproved(newStatus) && !isFederalDeposited(newStatus)) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Federal Aprobada!',
        'Tu declaración federal ha sido aprobada por el IRS. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (isFederalRejected(newStatus)) {
      this.notificationService.emitLocalNotification(
        'Declaración Federal Rechazada',
        'Tu declaración federal fue rechazada por el IRS. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (isFederalDeposited(newStatus)) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Federal Depositado!',
        'Tu reembolso federal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
      // Celebrate the deposit with fireworks!
      setTimeout(() => this.confettiService.fireworks(), 500);
    }
  }

  private checkStateStatusChange(newStatus?: any): void {
    if (!this.previousStateStatus || this.previousStateStatus === newStatus) return;

    // Handle V2 StateStatusNew values
    if (isStateApproved(newStatus) && !isStateDeposited(newStatus)) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Estatal Aprobada!',
        'Tu declaración estatal ha sido aprobada. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (isStateRejected(newStatus)) {
      this.notificationService.emitLocalNotification(
        'Declaración Estatal Rechazada',
        'Tu declaración estatal fue rechazada. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (isStateDeposited(newStatus)) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Estatal Depositado!',
        'Tu reembolso estatal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
      // Celebrate the deposit with money rain!
      setTimeout(() => this.confettiService.moneyRain(), 500);
    }
  }

  private buildSteps() {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const caseStatus = taxCase?.caseStatus;
    const taxesFiled = caseStatus === CaseStatus.TAXES_FILED;

    // Read from v2 status fields only
    const federalStatus = taxCase?.federalStatusNew;
    const stateStatus = taxCase?.stateStatusNew;

    // SHARED STEPS (Steps 1-2)
    this.sharedSteps = [
      {
        id: 'received',
        title: 'Información Recibida',
        description: 'Recibimos tus datos y documentos',
        icon: '📋',
        status: this.getStepStatusNew('received', taxesFiled, caseStatus, profile?.profileComplete),
        date: profile?.updatedAt ? this.formatDate(profile.updatedAt) : undefined,
        detail: profile?.profileComplete ? 'Perfil completo' : 'Pendiente de completar'
      },
      {
        id: 'submitted',
        title: 'Presentado al IRS',
        description: 'Tu declaración fue enviada al IRS',
        icon: '🏛️',
        status: this.getStepStatusNew('submitted', taxesFiled, caseStatus),
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
  private getStepStatusNew(step: string, taxesFiled: boolean, caseStatus?: CaseStatus, profileComplete?: boolean): TrackingStep['status'] {
    if (step === 'received') {
      if (profileComplete) return 'completed';
      return 'active';
    }

    if (step === 'submitted') {
      if (taxesFiled) return 'completed';
      if (caseStatus === CaseStatus.PREPARING) return 'active';
      return 'pending';
    }

    return 'pending';
  }

  // ============ FEDERAL HELPERS ============
  private getFederalDecisionIcon(federalStatus?: any): string {
    if (isFederalApproved(federalStatus)) return '✅';
    if (isFederalRejected(federalStatus)) return '❌';
    return '🦅';
  }

  private getFederalDecisionStatusNew(federalStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    const displayStatus = mapFederalStatusToDisplay(federalStatus);
    if (displayStatus === 'completed') return 'completed';
    if (displayStatus === 'rejected') return 'rejected';
    if (displayStatus === 'active') return 'active';
    if (taxesFiled) return 'active';
    return 'pending';
  }

  private getFederalDecisionDetail(federalStatus?: any): string {
    if (isFederalApproved(federalStatus)) return 'Aprobado';
    if (isFederalRejected(federalStatus)) return 'Rechazado';
    const displayStatus = mapFederalStatusToDisplay(federalStatus);
    if (displayStatus === 'active') return 'En revisión...';
    return 'Pendiente';
  }

  private isFederalProcessed(status?: any): boolean {
    return isFederalApproved(status) || isFederalRejected(status);
  }

  private getFederalEstimateStatusNew(federalStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    if (isFederalApproved(federalStatus)) return 'completed';
    if (isFederalRejected(federalStatus)) return 'rejected';
    return 'pending';
  }

  private getFederalEstimateDetailNew(federalStatus?: any, estimatedDate?: string): string {
    if (isFederalRejected(federalStatus)) return 'No aplica';
    if (isFederalApproved(federalStatus)) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getFederalRefundStatusNew(federalStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    if (isFederalDeposited(federalStatus)) return 'completed';
    if (isFederalRejected(federalStatus)) return 'rejected';
    if (isFederalApproved(federalStatus)) return 'active';
    return 'pending';
  }

  private getFederalRefundDetail(federalStatus?: any, actualRefund?: number): string {
    if (isFederalDeposited(federalStatus)) {
      return actualRefund ? `$${actualRefund.toLocaleString()}` : 'Depositado';
    }
    if (isFederalRejected(federalStatus)) return 'No aplica';
    if (isFederalApproved(federalStatus)) return 'En proceso';
    return 'Pendiente';
  }

  // ============ ESTATAL HELPERS ============
  private getStateDecisionIcon(stateStatus?: any): string {
    if (isStateApproved(stateStatus)) return '✅';
    if (isStateRejected(stateStatus)) return '❌';
    return '🗽';
  }

  private getStateDecisionStatusNew(stateStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    const displayStatus = mapStateStatusToDisplay(stateStatus);
    if (displayStatus === 'completed') return 'completed';
    if (displayStatus === 'rejected') return 'rejected';
    if (displayStatus === 'active') return 'active';
    if (taxesFiled) return 'active';
    return 'pending';
  }

  private getStateDecisionDetail(stateStatus?: any): string {
    if (isStateApproved(stateStatus)) return 'Aprobado';
    if (isStateRejected(stateStatus)) return 'Rechazado';
    const displayStatus = mapStateStatusToDisplay(stateStatus);
    if (displayStatus === 'active') return 'En revisión...';
    return 'Pendiente';
  }

  private isStateProcessed(status?: any): boolean {
    return isStateApproved(status) || isStateRejected(status);
  }

  private getStateEstimateStatusNew(stateStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    if (isStateApproved(stateStatus)) return 'completed';
    if (isStateRejected(stateStatus)) return 'rejected';
    return 'pending';
  }

  private getStateEstimateDetailNew(stateStatus?: any, estimatedDate?: string): string {
    if (isStateRejected(stateStatus)) return 'No aplica';
    if (isStateApproved(stateStatus)) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getStateRefundStatusNew(stateStatus?: any, taxesFiled?: boolean): TrackingStep['status'] {
    if (isStateDeposited(stateStatus)) return 'completed';
    if (isStateRejected(stateStatus)) return 'rejected';
    if (isStateApproved(stateStatus)) return 'active';
    return 'pending';
  }

  private getStateRefundDetail(stateStatus?: any, stateRefund?: number): string {
    if (isStateDeposited(stateStatus)) {
      return stateRefund ? `$${stateRefund.toLocaleString()}` : 'Depositado';
    }
    if (isStateRejected(stateStatus)) return 'No aplica';
    if (isStateApproved(stateStatus)) return 'En proceso';
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
    // Explicitly convert to numbers to prevent string concatenation
    const federal = Number(this.profileData?.taxCase?.federalActualRefund || 0);
    const state = Number(this.profileData?.taxCase?.stateActualRefund || 0);
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
    return profile?.profileComplete === true && taxCase?.caseStatus !== CaseStatus.TAXES_FILED;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
