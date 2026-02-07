import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatUSDAmount } from '../../core/utils/currency-format';
import { UsdAmountPipe } from '../../shared/pipes/usd-amount.pipe';
import { Router, NavigationEnd } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { DocumentService } from '../../core/services/document.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { AnimationService } from '../../core/services/animation.service';
import { ProfileResponse, NotificationType, CaseStatus, FederalStatusNew, StateStatusNew, DocumentType } from '../../core/models';
import { interval, Subscription, filter, skip, finalize } from 'rxjs';
import {
  isFederalApproved,
  isFederalRejected,
  isFederalDeposited,
  isStateApproved,
  isStateRejected,
  isStateDeposited,
  mapFederalStatusToSpanishLabel,
  mapStateStatusToSpanishLabel,
  getStatusCategory,
  ObservationCategory
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
  imports: [CommonModule, UsdAmountPipe],
  templateUrl: './tax-tracking.html',
  styleUrl: './tax-tracking.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxTracking implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);
  private documentService = inject(DocumentService);
  private dataRefreshService = inject(DataRefreshService);
  private confettiService = inject(ConfettiService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);

  // Animation references
  @ViewChild('sharedTrack') sharedTrack!: ElementRef<HTMLElement>;
  @ViewChild('observacionesSection') observacionesSection!: ElementRef<HTMLElement>;
  @ViewChild('completadoSection') completadoSection!: ElementRef<HTMLElement>;
  @ViewChildren('trackingStep') trackingSteps!: QueryList<ElementRef<HTMLElement>>;
  private hasAnimated = false;

  profileData: ProfileResponse | null = null;
  isLoading = true;
  hasLoaded = false;
  lastRefresh: Date = new Date();
  isRefreshing = false;

  private subscriptions = new Subscription();
  private previousCaseStatus?: CaseStatus;
  private previousTaxesFiled?: boolean;
  private previousFederalStatus?: FederalStatusNew;
  private previousStateStatus?: StateStatusNew;
  private isLoadingInProgress = false;
  private safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Shared initial steps (before split)
  sharedSteps: TrackingStep[] = [];

  // 3-stage status labels and categories
  federalStatusLabel = 'Pendiente';
  stateStatusLabel = 'Pendiente';
  federalCategory: ObservationCategory = 'pending';
  stateCategory: ObservationCategory = 'pending';

  // Refund confirmation state
  isConfirmingFederal = false;
  isConfirmingState = false;
  federalFee: number | null = null;
  stateFee: number | null = null;
  copiedToClipboard = false;
  showPaymentSection = false;

  // Commission proof upload state
  isUploadingFederalProof = false;
  isUploadingStateProof = false;
  federalProofUploaded = false;
  stateProofUploaded = false;
  federalProofError = '';
  stateProofError = '';

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

  ngAfterViewInit() {
    // Animations will be triggered when data loads
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
  }

  private runEntranceAnimations(): void {
    if (this.hasAnimated) return;
    this.hasAnimated = true;

    if (this.sharedTrack?.nativeElement) {
      this.animationService.slideIn(this.sharedTrack.nativeElement, 'up', { delay: 0.1 });
    }

    if (this.observacionesSection?.nativeElement) {
      this.animationService.slideIn(this.observacionesSection.nativeElement, 'up', { delay: 0.2 });
    }

    if (this.completadoSection?.nativeElement) {
      this.animationService.slideIn(this.completadoSection.nativeElement, 'up', { delay: 0.3 });
    }

    if (this.trackingSteps?.length) {
      const steps = this.trackingSteps.map(s => s.nativeElement);
      this.animationService.staggerIn(steps, { direction: 'up', stagger: 0.08, delay: 0.4 });
    }
  }

  loadTrackingData() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;

    this.buildSteps();

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
          this.previousFederalStatus = data.taxCase?.federalStatusNew;
          this.previousStateStatus = data.taxCase?.stateStatusNew;
          this.buildSteps();

          setTimeout(() => this.runEntranceAnimations(), 100);
        }
      },
      error: () => {}
    });

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
    this.subscriptions.add(
      this.profileService.getProfile().subscribe({
        next: (data) => {
          const currentTaxesFiled = data.taxCase?.caseStatus === CaseStatus.TAXES_FILED;
          if (this.previousTaxesFiled === false && currentTaxesFiled === true) {
            this.onTaxesFiled();
          }

          const currentFederalStatus = data.taxCase?.federalStatusNew;
          const currentStateStatus = data.taxCase?.stateStatusNew;

          this.checkFederalStatusChange(currentFederalStatus);
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
      })
    );
  }

  manualRefresh() {
    this.isRefreshing = true;
    this.subscriptions.add(
      this.profileService.getProfile().subscribe({
        next: (data) => {
          const currentTaxesFiled = data.taxCase?.caseStatus === CaseStatus.TAXES_FILED;
          if (this.previousTaxesFiled === false && currentTaxesFiled === true) {
            this.onTaxesFiled();
          }

          const currentFederalStatus = data.taxCase?.federalStatusNew;
          const currentStateStatus = data.taxCase?.stateStatusNew;

          this.checkFederalStatusChange(currentFederalStatus);
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
      })
    );
  }

  private onTaxesFiled() {
    // Hook for analytics or side effects
  }

  private checkFederalStatusChange(newStatus?: any): void {
    if (!this.previousFederalStatus || this.previousFederalStatus === newStatus) return;

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
      setTimeout(() => this.confettiService.fireworks(), 500);
    }
  }

  private checkStateStatusChange(newStatus?: any): void {
    if (!this.previousStateStatus || this.previousStateStatus === newStatus) return;

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
      setTimeout(() => this.confettiService.moneyRain(), 500);
    }
  }

  private buildSteps() {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const caseStatus = taxCase?.caseStatus;
    const taxesFiled = caseStatus === CaseStatus.TAXES_FILED;

    const federalStatus = taxCase?.federalStatusNew;
    const stateStatus = taxCase?.stateStatusNew;

    // SHARED STEPS (Step 1: Etapa Inicial)
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

    // Compute 3-stage labels and categories
    this.federalStatusLabel = mapFederalStatusToSpanishLabel(federalStatus);
    this.stateStatusLabel = mapStateStatusToSpanishLabel(stateStatus);
    this.federalCategory = getStatusCategory(federalStatus);
    this.stateCategory = getStatusCategory(stateStatus);
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

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  // ============ COMPUTED PROPERTIES (3-STAGE) ============

  /**
   * Current major step: 1 = Etapa Inicial, 2 = Observaciones, 3 = Completado
   */
  get showTaxCards(): boolean {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return false;
    const isFiled = taxCase.caseStatus === CaseStatus.TAXES_FILED;
    return isFiled && (!!taxCase.federalStatusNew || !!taxCase.stateStatusNew);
  }

  get currentMajorStep(): number {
    if (this.isFullyCompleted) return 3;
    if (this.showTaxCards) return 2;
    return 1;
  }

  get isFullyCompleted(): boolean {
    const taxCase = this.profileData?.taxCase;
    return isFederalDeposited(taxCase?.federalStatusNew) && isStateDeposited(taxCase?.stateStatusNew);
  }

  get hasFederalStatus(): boolean {
    return !!this.profileData?.taxCase?.federalStatusNew;
  }

  get hasStateStatus(): boolean {
    return !!this.profileData?.taxCase?.stateStatusNew;
  }

  get federalLastComment(): string {
    return this.profileData?.taxCase?.federalLastComment || '';
  }

  get stateLastComment(): string {
    return this.profileData?.taxCase?.stateLastComment || '';
  }

  get overallProgressPercent(): number {
    return Math.round((this.currentMajorStep / 3) * 100);
  }

  get estimatedRefund(): number | null {
    return this.profileData?.taxCase?.estimatedRefund || null;
  }

  get hasProblem(): boolean {
    return this.profileData?.taxCase?.hasProblem || false;
  }

  get actualRefund(): number | null {
    const federal = Number(this.profileData?.taxCase?.federalActualRefund || 0);
    const state = Number(this.profileData?.taxCase?.stateActualRefund || 0);
    const total = federal + state;
    return total > 0 ? total : null;
  }

  get lastRefreshFormatted(): string {
    return this.lastRefresh.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get isPreparingDeclaration(): boolean {
    const profile = this.profileData?.profile;
    const taxCase = this.profileData?.taxCase;
    return profile?.profileComplete === true && taxCase?.caseStatus !== CaseStatus.TAXES_FILED;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  // ============ REFUND CONFIRMATION ============

  get canConfirmFederal(): boolean {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return false;
    return !!(
      isFederalApproved(taxCase.federalStatusNew) &&
      taxCase.federalActualRefund &&
      Number(taxCase.federalActualRefund) > 0 &&
      !taxCase.federalRefundReceived
    );
  }

  get canConfirmState(): boolean {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return false;
    return !!(
      isStateApproved(taxCase.stateStatusNew) &&
      taxCase.stateActualRefund &&
      Number(taxCase.stateActualRefund) > 0 &&
      !taxCase.stateRefundReceived
    );
  }

  get federalConfirmed(): boolean {
    return this.profileData?.taxCase?.federalRefundReceived || false;
  }

  get stateConfirmed(): boolean {
    return this.profileData?.taxCase?.stateRefundReceived || false;
  }

  get hasUnpaidFee(): boolean {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return false;
    const hasConfirmedRefund = !!(taxCase.federalRefundReceived || taxCase.stateRefundReceived);
    return hasConfirmedRefund && !taxCase.commissionPaid;
  }

  get referralDiscountAmount(): number {
    const discount = this.profileData?.taxCase?.referralDiscount;
    if (!discount || discount.status === 'expired') return 0;
    // Discount already consumed if any commission has been paid
    const taxCase = this.profileData?.taxCase;
    if (taxCase?.federalCommissionPaid || taxCase?.stateCommissionPaid) return 0;
    return discount.amount;
  }

  get totalFeeBeforeDiscount(): number {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return 0;

    const fedRate = taxCase.federalCommissionRate || 0.11;
    const stateRate = taxCase.stateCommissionRate || 0.11;

    let total = 0;
    if (taxCase.federalRefundReceived && taxCase.federalActualRefund && !taxCase.federalCommissionPaid) {
      total += Number(taxCase.federalActualRefund) * fedRate;
    }
    if (taxCase.stateRefundReceived && taxCase.stateActualRefund && !taxCase.stateCommissionPaid) {
      total += Number(taxCase.stateActualRefund) * stateRate;
    }
    return Math.round(total * 100) / 100;
  }

  get totalFeeOwed(): number {
    const total = this.totalFeeBeforeDiscount - this.referralDiscountAmount;
    return Math.max(0, Math.round(total * 100) / 100);
  }

  get federalRefundAmount(): number {
    return Number(this.profileData?.taxCase?.federalActualRefund || 0);
  }

  get stateRefundAmount(): number {
    return Number(this.profileData?.taxCase?.stateActualRefund || 0);
  }

  get federalFeeAmount(): number {
    const rate = this.profileData?.taxCase?.federalCommissionRate || 0.11;
    return Math.round(this.federalRefundAmount * rate * 100) / 100;
  }

  get stateFeeAmount(): number {
    const rate = this.profileData?.taxCase?.stateCommissionRate || 0.11;
    return Math.round(this.stateRefundAmount * rate * 100) / 100;
  }

  get isFederalCommissionPaid(): boolean {
    return this.profileData?.taxCase?.federalCommissionPaid || false;
  }

  get isStateCommissionPaid(): boolean {
    return this.profileData?.taxCase?.stateCommissionPaid || false;
  }

  get rawReferralDiscount(): number {
    const discount = this.profileData?.taxCase?.referralDiscount;
    if (!discount || discount.status === 'expired') return 0;
    return discount.amount;
  }

  get federalDiscountApplied(): boolean {
    return this.isFederalCommissionPaid && this.rawReferralDiscount > 0;
  }

  get stateDiscountApplied(): boolean {
    return this.isStateCommissionPaid && !this.isFederalCommissionPaid && this.rawReferralDiscount > 0;
  }

  get federalDisplayFee(): number {
    if (this.federalDiscountApplied) {
      return Math.max(0, Math.round((this.federalFeeAmount - this.rawReferralDiscount) * 100) / 100);
    }
    return this.federalFeeAmount;
  }

  get stateDisplayFee(): number {
    if (this.stateDiscountApplied) {
      return Math.max(0, Math.round((this.stateFeeAmount - this.rawReferralDiscount) * 100) / 100);
    }
    return this.stateFeeAmount;
  }

  // Commission status badges (3-state system)
  get federalCommissionStatus(): 'pending' | 'proof_submitted' | 'verified' | null {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return null;

    if (taxCase.federalCommissionPaid) return 'verified';
    if (taxCase.federalCommissionProofSubmitted) return 'proof_submitted';
    if (taxCase.federalRefundReceived && !taxCase.federalCommissionPaid) return 'pending';
    return null;
  }

  get stateCommissionStatus(): 'pending' | 'proof_submitted' | 'verified' | null {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return null;

    if (taxCase.stateCommissionPaid) return 'verified';
    if (taxCase.stateCommissionProofSubmitted) return 'proof_submitted';
    if (taxCase.stateRefundReceived && !taxCase.stateCommissionPaid) return 'pending';
    return null;
  }

  get federalCommissionStatusLabel(): string {
    switch (this.federalCommissionStatus) {
      case 'pending': return '💰 Comisión pendiente de pago';
      case 'proof_submitted': return '📄 Comprobante enviado - En revisión';
      case 'verified': return '✅ Comisión verificada';
      default: return '';
    }
  }

  get stateCommissionStatusLabel(): string {
    switch (this.stateCommissionStatus) {
      case 'pending': return '💰 Comisión pendiente de pago';
      case 'proof_submitted': return '📄 Comprobante enviado - En revisión';
      case 'verified': return '✅ Comisión verificada';
      default: return '';
    }
  }

  confirmFederalRefund(): void {
    if (this.isConfirmingFederal || !this.canConfirmFederal) return;

    this.isConfirmingFederal = true;
    this.cdr.detectChanges();

    this.profileService.confirmRefundReceived('federal').pipe(
      finalize(() => {
        this.isConfirmingFederal = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.federalFee = response.fee;
        this.showPaymentSection = true;

        if (this.profileData?.taxCase) {
          this.profileData.taxCase.federalRefundReceived = true;
          this.profileData.taxCase.federalRefundReceivedAt = response.confirmedAt;
        }

        this.notificationService.emitLocalNotification(
          '¡Recibo Confirmado!',
          `Has confirmado recibir tu reembolso federal. Comisión: $${formatUSDAmount(response.fee)}`,
          NotificationType.STATUS_CHANGE
        );

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.notificationService.emitLocalNotification(
          'Error',
          err.message || 'No se pudo confirmar el reembolso',
          NotificationType.PROBLEM_ALERT
        );
      }
    });
  }

  confirmStateRefund(): void {
    if (this.isConfirmingState || !this.canConfirmState) return;

    this.isConfirmingState = true;
    this.cdr.detectChanges();

    this.profileService.confirmRefundReceived('state').pipe(
      finalize(() => {
        this.isConfirmingState = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.stateFee = response.fee;
        this.showPaymentSection = true;

        if (this.profileData?.taxCase) {
          this.profileData.taxCase.stateRefundReceived = true;
          this.profileData.taxCase.stateRefundReceivedAt = response.confirmedAt;
        }

        this.notificationService.emitLocalNotification(
          '¡Recibo Confirmado!',
          `Has confirmado recibir tu reembolso estatal. Comisión: $${formatUSDAmount(response.fee)}`,
          NotificationType.STATUS_CHANGE
        );

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.notificationService.emitLocalNotification(
          'Error',
          err.message || 'No se pudo confirmar el reembolso',
          NotificationType.PROBLEM_ALERT
        );
      }
    });
  }

  copyZelleEmail(): void {
    const email = 'jai1@memas.agency';
    navigator.clipboard.writeText(email).then(() => {
      this.copiedToClipboard = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.copiedToClipboard = false;
        this.cdr.detectChanges();
      }, 2000);
    });
  }

  // ============ COMMISSION PROOF UPLOAD ============

  onCommissionProofSelected(event: Event, track: 'federal' | 'state'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'Formato no valido. Solo PDF, JPG o PNG.';
      if (track === 'federal') this.federalProofError = errorMsg;
      else this.stateProofError = errorMsg;
      this.cdr.detectChanges();
      input.value = '';
      return;
    }

    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = 'El archivo supera el limite de 25MB.';
      if (track === 'federal') this.federalProofError = errorMsg;
      else this.stateProofError = errorMsg;
      this.cdr.detectChanges();
      input.value = '';
      return;
    }

    // Clear errors and set uploading state
    if (track === 'federal') {
      this.federalProofError = '';
      this.isUploadingFederalProof = true;
    } else {
      this.stateProofError = '';
      this.isUploadingStateProof = true;
    }
    this.cdr.detectChanges();

    const docType = track === 'federal'
      ? DocumentType.COMMISSION_PROOF_FEDERAL
      : DocumentType.COMMISSION_PROOF_STATE;
    const taxYear = this.profileData?.taxCase?.taxYear;

    this.documentService.upload(file, docType, taxYear).pipe(
      finalize(() => {
        if (track === 'federal') this.isUploadingFederalProof = false;
        else this.isUploadingStateProof = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        // Mark proof as uploaded locally (optimistic update)
        if (track === 'federal') {
          this.federalProofUploaded = true;
          // Optimistically update backend status
          if (this.profileData?.taxCase) {
            this.profileData.taxCase.federalCommissionProofSubmitted = true;
            this.profileData.taxCase.federalCommissionProofSubmittedAt = new Date().toISOString();
          }
        } else {
          this.stateProofUploaded = true;
          if (this.profileData?.taxCase) {
            this.profileData.taxCase.stateCommissionProofSubmitted = true;
            this.profileData.taxCase.stateCommissionProofSubmittedAt = new Date().toISOString();
          }
        }

        this.notificationService.emitLocalNotification(
          'Comprobante Enviado',
          `Tu comprobante de comision ${track === 'federal' ? 'federal' : 'estatal'} fue enviado correctamente.`,
          NotificationType.STATUS_CHANGE
        );
        this.cdr.detectChanges();
      },
      error: () => {
        const errorMsg = 'Error al subir el comprobante. Intenta de nuevo.';
        if (track === 'federal') this.federalProofError = errorMsg;
        else this.stateProofError = errorMsg;
      }
    });

    input.value = '';
  }
}
