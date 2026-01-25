import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef, ViewChild, QueryList, ViewChildren } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter, forkJoin, finalize, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService, CalculatorResult } from '../../core/services/calculator-result.service';
import { CalculatorApiService } from '../../core/services/calculator-api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { ConfettiService } from '../../core/services/confetti.service';
import {
  ProfileResponse,
  Document,
  DocumentType,
  CaseStatus,
  FederalStatusNew,
  StateStatusNew
} from '../../core/models';
import {
  isFederalApproved,
  isFederalDeposited,
  isFederalRejected,
  isStateApproved,
  isStateDeposited,
  isStateRejected
} from '../../core/utils/status-display-mapper';

const DASHBOARD_CACHE_KEY = 'jai1_dashboard_cache';

// Step info interface matching tax-tracking component
interface CurrentStepInfo {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  icon: string;
  track: 'shared' | 'federal' | 'estatal' | 'both';
  status: 'pending' | 'active' | 'completed' | 'rejected';
}

interface DashboardCacheData {
  profileData: ProfileResponse | null;
  documents: Document[];
  calculatorResult: CalculatorResult | null;
  cachedAt: number;
  userId: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private animationService = inject(AnimationService);
  private confettiService = inject(ConfettiService);
  private subscriptions = new Subscription();

  @ViewChild('welcomeSection') welcomeSection!: ElementRef<HTMLElement>;
  @ViewChild('refundValue') refundValue!: ElementRef<HTMLElement>;
  @ViewChildren('bentoCard') bentoCards!: QueryList<ElementRef<HTMLElement>>;
  private hasAnimated: boolean = false;

  profileData: ProfileResponse | null = null;
  documents: Document[] = [];
  calculatorResult: CalculatorResult | null = null;
  hasLoaded: boolean = false; // True after first load completes
  errorMessage: string = '';
  private isLoadingInProgress: boolean = false; // Prevent concurrent API calls
  private safetyTimeoutId: ReturnType<typeof setTimeout> | null = null; // Track timeout for cleanup

  // User info from auth service (available immediately)
  userName: string = '';
  userEmail: string = '';

  ngOnInit() {
    this.loadData();
    this.subscriptions.add(
      this.calculatorResultService.result$.subscribe(result => {
        this.calculatorResult = result;
      })
    );

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/dashboard')
      ).subscribe(() => {
        this.loadData();
      })
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/dashboard').subscribe(() => {
        this.loadData();
      })
    );
  }

  ngAfterViewInit() {
    // Trigger entrance animations after data loads
    this.runEntranceAnimations();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
    // Clear safety timeout to prevent memory leaks and errors after component destroy
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
  }

  private runEntranceAnimations() {
    if (this.hasAnimated) return;

    // Wait for hasLoaded to be true, then animate
    const checkAndAnimate = () => {
      if (!this.hasLoaded) {
        setTimeout(checkAndAnimate, 100);
        return;
      }

      this.hasAnimated = true;

      // Animate welcome section
      if (this.welcomeSection?.nativeElement) {
        this.animationService.slideIn(this.welcomeSection.nativeElement, 'up', { delay: 0.1 });
      }

      // Stagger animate bento cards
      if (this.bentoCards?.length) {
        const cards = this.bentoCards.map(c => c.nativeElement);
        this.animationService.staggerIn(cards, { direction: 'up', stagger: 0.08, delay: 0.2 });
      }

      // Animate refund counter if available
      if (this.refundValue?.nativeElement && this.calculatorResult?.estimatedRefund) {
        this.animationService.counterUp(
          this.refundValue.nativeElement,
          this.calculatorResult.estimatedRefund,
          { prefix: '$', decimals: 0, duration: 1 }
        );
      }
    };

    checkAndAnimate();
  }

  loadData() {
    // Prevent concurrent API calls
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;

    // Load cached dashboard data FIRST (instant, from localStorage)
    // This shows last-known state instead of empty defaults
    const hasCachedData = this.loadCachedData();

    // Immediately load user data from auth service (instant, no API call)
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
      this.userEmail = user.email || '';
      // Only show content immediately if we have cached data
      // Otherwise, show loading spinner until API completes
      if (hasCachedData) {
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
    }

    // Load profile, documents, and calculator result in parallel with timeout protection
    forkJoin({
      profile: this.profileService.getProfile().pipe(
        timeout(8000),
        catchError(() => of(null))
      ),
      documents: this.documentService.getDocuments().pipe(
        timeout(8000),
        catchError(() => of([] as Document[]))
      ),
      calculatorResult: this.calculatorApiService.getLatestEstimate().pipe(
        timeout(5000),
        catchError(() => of(null))
      )
    }).pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (results) => {
        // Track previous state for confetti logic
        const wasAllComplete = this.allStepsComplete;

        if (results.profile) {
          this.profileData = results.profile;
        }
        this.documents = results.documents || [];

        // Sync calculator result from backend (for cross-device support)
        // Backend returns { hasEstimate: boolean, estimate: {...} | null }
        const backendData = results.calculatorResult as any;
        if (backendData?.hasEstimate && backendData?.estimate) {
          const estimate = backendData.estimate;
          // Use syncFromBackend to properly populate all fields and update BehaviorSubject
          this.calculatorResultService.syncFromBackend({
            estimatedRefund: estimate.estimatedRefund,
            w2FileName: estimate.w2FileName,
            box2Federal: estimate.box2Federal,
            box17State: estimate.box17State,
            ocrConfidence: estimate.ocrConfidence,
            createdAt: estimate.createdAt
          });
        }

        // Cache dashboard data for faster loads on refresh
        this.cacheDashboardData();

        // Trigger confetti when all steps become complete (first time only per session)
        this.checkAndTriggerConfetti(wasAllComplete);
      }
    });

    // Safety timeout - ensure content shows after 5 seconds even if APIs are slow
    // Clear any existing timeout before setting a new one
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
    }
    this.safetyTimeoutId = setTimeout(() => {
      if (!this.hasLoaded) {
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
      this.safetyTimeoutId = null;
    }, 5000);
  }

  // ============ CALCULATOR RESULT ============
  get hasCalculatorResult(): boolean {
    return this.calculatorResult !== null;
  }

  get estimatedRefundDisplay(): string {
    if (this.calculatorResult) {
      return `$${this.calculatorResult.estimatedRefund.toLocaleString()}`;
    }
    return '---';
  }

  // ============ ACTUAL REFUND (from IRS) ============
  get actualRefund(): number | null {
    const federal = Number(this.profileData?.taxCase?.federalActualRefund || 0);
    const state = Number(this.profileData?.taxCase?.stateActualRefund || 0);
    const total = federal + state;
    return total > 0 ? total : null;
  }

  get actualRefundDisplay(): string {
    if (this.actualRefund) {
      return `$${this.actualRefund.toLocaleString()}`;
    }
    return '---';
  }

  // ============ USER PROGRESS ============
  get isProfileComplete(): boolean {
    return this.profileData?.profile?.profileComplete || false;
  }

  get isFormSent(): boolean {
    // Form is sent if profile is complete and not a draft
    return this.profileData?.profile?.profileComplete === true &&
           this.profileData?.profile?.isDraft === false;
  }

  get hasW2Document(): boolean {
    return this.documents.some(d => d.type === DocumentType.W2);
  }

  get hasPaymentProof(): boolean {
    return this.documents.some(d => d.type === DocumentType.PAYMENT_PROOF);
  }

  // ============ BENTO GRID STEP STATES ============
  get isStep1Complete(): boolean {
    // Step 1 complete = form is filled and sent
    return this.isFormSent;
  }

  get isStep2Complete(): boolean {
    // Step 2 complete = W2 document uploaded
    return this.hasW2Document;
  }

  get isStep3Complete(): boolean {
    // Step 3 complete = Payment proof uploaded
    return this.hasPaymentProof;
  }

  get allStepsComplete(): boolean {
    return this.isStep1Complete && this.isStep2Complete && this.isStep3Complete;
  }

  get stepsCompletedCount(): number {
    let count = 0;
    if (this.isStep1Complete) count++;
    if (this.isStep2Complete) count++;
    if (this.isStep3Complete) count++;
    return count;
  }

  // ============ IRS PROGRESS ============
  get taxCase() {
    return this.profileData?.taxCase;
  }

  // ============ PROBLEM ALERT ============
  get hasProblem(): boolean {
    return this.taxCase?.hasProblem || false;
  }

  get isSentToIRS(): boolean {
    if (!this.taxCase) return false;
    // Taxes are sent to IRS when caseStatus = TAXES_FILED
    return this.taxCase.caseStatus === CaseStatus.TAXES_FILED;
  }

  get isAcceptedByIRS(): boolean {
    if (!this.taxCase) return false;
    return isFederalApproved(this.taxCase.federalStatusNew);
  }

  get estimatedReturnDate(): string | null {
    // Use the earliest deposit date (federal or state)
    const federalDate = this.taxCase?.federalDepositDate;
    const stateDate = this.taxCase?.stateDepositDate;

    // Get the earliest available date
    let depositDate: string | undefined;
    if (federalDate && stateDate) {
      depositDate = new Date(federalDate) < new Date(stateDate) ? federalDate : stateDate;
    } else {
      depositDate = federalDate || stateDate;
    }

    if (!depositDate) return null;
    return new Date(depositDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  get isRefundDeposited(): boolean {
    if (!this.taxCase) return false;
    return isFederalDeposited(this.taxCase.federalStatusNew) || isStateDeposited(this.taxCase.stateStatusNew);
  }

  get irsProgressPercent(): number {
    let completed = 0;
    if (this.isSentToIRS) completed++;
    if (this.isAcceptedByIRS) completed++;
    if (this.estimatedReturnDate) completed++;
    if (this.isRefundDeposited) completed++;
    return Math.round((completed / 4) * 100);
  }

  get showIRSProgress(): boolean {
    // Only show IRS progress if user has completed all 3 steps or taxes are already filed
    return this.allStepsComplete || this.isSentToIRS;
  }

  // ============ CURRENT STEP (Matching tax-tracking logic) ============
  get currentStepInfo(): CurrentStepInfo {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const caseStatus = taxCase?.caseStatus;
    const taxesFiled = caseStatus === CaseStatus.TAXES_FILED;
    const federalStatus = taxCase?.federalStatusNew;
    const stateStatus = taxCase?.stateStatusNew;
    const profileComplete = profile?.profileComplete || false;

    // Total of 8 steps: 2 shared + 3 federal + 3 estatal
    // We show the most relevant current step

    // Step 1: Información Recibida
    if (!profileComplete) {
      return {
        stepNumber: 1,
        totalSteps: 8,
        title: 'Información Recibida',
        description: 'Completa tu perfil para continuar',
        icon: '📋',
        track: 'shared',
        status: 'active'
      };
    }

    // Step 2: Presentado al IRS
    const isSubmitted = taxesFiled === true;

    if (!isSubmitted) {
      if (caseStatus === CaseStatus.PREPARING) {
        return {
          stepNumber: 2,
          totalSteps: 8,
          title: 'Presentando al IRS',
          description: 'Tu cuenta está siendo revisada',
          icon: '🏛️',
          track: 'shared',
          status: 'active'
        };
      }
      return {
        stepNumber: 2,
        totalSteps: 8,
        title: 'Presentado al IRS',
        description: 'Pendiente de envío al IRS',
        icon: '🏛️',
        track: 'shared',
        status: 'pending'
      };
    }

    // After submission, check Federal and State tracks
    // Determine most relevant step based on status

    // Check for rejections first
    if (isFederalRejected(federalStatus)) {
      return {
        stepNumber: 3,
        totalSteps: 8,
        title: 'Decisión Federal',
        description: 'Declaración rechazada - contacta soporte',
        icon: '❌',
        track: 'federal',
        status: 'rejected'
      };
    }

    if (isStateRejected(stateStatus)) {
      return {
        stepNumber: 3,
        totalSteps: 8,
        title: 'Decisión Estatal',
        description: 'Declaración rechazada - contacta soporte',
        icon: '❌',
        track: 'estatal',
        status: 'rejected'
      };
    }

    // Check if both are deposited (completed)
    if (isFederalDeposited(federalStatus) && isStateDeposited(stateStatus)) {
      return {
        stepNumber: 8,
        totalSteps: 8,
        title: 'Reembolsos Depositados',
        description: '¡Federal y Estatal depositados!',
        icon: '🎉',
        track: 'both',
        status: 'completed'
      };
    }

    // Check individual deposit status
    if (isFederalDeposited(federalStatus)) {
      // Federal done, check state
      if (isStateApproved(stateStatus) && !isStateDeposited(stateStatus)) {
        return {
          stepNumber: 7,
          totalSteps: 8,
          title: 'Reembolso Estatal en Camino',
          description: 'Federal depositado, esperando estatal',
          icon: '💵',
          track: 'estatal',
          status: 'active'
        };
      }
      if (!isStateApproved(stateStatus)) {
        return {
          stepNumber: 6,
          totalSteps: 8,
          title: 'Decisión Estatal Pendiente',
          description: 'Federal depositado, estatal en revisión',
          icon: '🗽',
          track: 'estatal',
          status: 'active'
        };
      }
    }

    if (isStateDeposited(stateStatus)) {
      // State done, check federal
      if (isFederalApproved(federalStatus) && !isFederalDeposited(federalStatus)) {
        return {
          stepNumber: 5,
          totalSteps: 8,
          title: 'Reembolso Federal en Camino',
          description: 'Estatal depositado, esperando federal',
          icon: '💵',
          track: 'federal',
          status: 'active'
        };
      }
      if (!isFederalApproved(federalStatus)) {
        return {
          stepNumber: 4,
          totalSteps: 8,
          title: 'Decisión Federal Pendiente',
          description: 'Estatal depositado, federal en revisión',
          icon: '🦅',
          track: 'federal',
          status: 'active'
        };
      }
    }

    // Check approved but not deposited
    if (isFederalApproved(federalStatus) && !isFederalDeposited(federalStatus) &&
        isStateApproved(stateStatus) && !isStateDeposited(stateStatus)) {
      return {
        stepNumber: 6,
        totalSteps: 8,
        title: 'Reembolsos en Camino',
        description: 'Ambos aprobados, esperando depósitos',
        icon: '💵',
        track: 'both',
        status: 'active'
      };
    }

    if (isFederalApproved(federalStatus) && !isFederalDeposited(federalStatus)) {
      return {
        stepNumber: 5,
        totalSteps: 8,
        title: 'Federal Aprobado',
        description: 'Reembolso federal en proceso',
        icon: '✅',
        track: 'federal',
        status: 'active'
      };
    }

    if (isStateApproved(stateStatus) && !isStateDeposited(stateStatus)) {
      return {
        stepNumber: 5,
        totalSteps: 8,
        title: 'Estatal Aprobado',
        description: 'Reembolso estatal en proceso',
        icon: '✅',
        track: 'estatal',
        status: 'active'
      };
    }

    // Default: waiting for IRS decisions - active processing
    const federalIsActive = federalStatus && !isFederalApproved(federalStatus) && !isFederalRejected(federalStatus);
    const stateIsActive = stateStatus && !isStateApproved(stateStatus) && !isStateRejected(stateStatus);

    if (federalIsActive || stateIsActive) {
      return {
        stepNumber: 3,
        totalSteps: 8,
        title: 'En Revisión del IRS',
        description: 'Tu declaración está siendo procesada',
        icon: '🏛️',
        track: 'both',
        status: 'active'
      };
    }

    // Submitted but no status yet
    return {
      stepNumber: 3,
      totalSteps: 8,
      title: 'Decisión Pendiente',
      description: 'Esperando respuesta del IRS',
      icon: '⏳',
      track: 'both',
      status: 'active'
    };
  }

  get overallProgressPercent(): number {
    const step = this.currentStepInfo;
    // Calculate percentage based on current step
    return Math.round((step.stepNumber / step.totalSteps) * 100);
  }

  get isTrackingComplete(): boolean {
    return this.currentStepInfo.status === 'completed' &&
           this.currentStepInfo.stepNumber === 8;
  }

  // ============ IRS SUMMARY HELPERS ============
  getCurrentStatusMessage(): string {
    if (this.isRefundDeposited) {
      return '¡Tu reembolso ha sido depositado!';
    }
    if (this.isAcceptedByIRS) {
      return 'Tu declaración fue aprobada';
    }
    if (this.isSentToIRS) {
      return 'Tu declaración está en proceso';
    }
    return 'Pendiente de enviar al IRS';
  }

  getFederalPercent(): number {
    // No progress until submitted to IRS
    if (!this.isSentToIRS) return 0;
    if (!this.taxCase) return 0;

    const status = this.taxCase.federalStatusNew;
    // Progress based on federal status
    if (status === FederalStatusNew.TAXES_COMPLETED) return 100;
    if (status === FederalStatusNew.TAXES_SENT || status === FederalStatusNew.DEPOSIT_PENDING || status === FederalStatusNew.CHECK_IN_TRANSIT) return 80;
    if (status === FederalStatusNew.IN_VERIFICATION || status === FederalStatusNew.VERIFICATION_IN_PROGRESS || status === FederalStatusNew.VERIFICATION_LETTER_SENT) return 50;
    if (status === FederalStatusNew.IN_PROCESS) return 33;
    if (status === FederalStatusNew.ISSUES) return 33;
    return 0;
  }

  getEstatalPercent(): number {
    // No progress until submitted to IRS
    if (!this.isSentToIRS) return 0;
    if (!this.taxCase) return 0;

    const status = this.taxCase.stateStatusNew;
    // Progress based on state status
    if (status === StateStatusNew.TAXES_COMPLETED) return 100;
    if (status === StateStatusNew.TAXES_SENT || status === StateStatusNew.DEPOSIT_PENDING || status === StateStatusNew.CHECK_IN_TRANSIT) return 80;
    if (status === StateStatusNew.IN_VERIFICATION || status === StateStatusNew.VERIFICATION_IN_PROGRESS || status === StateStatusNew.VERIFICATION_LETTER_SENT) return 50;
    if (status === StateStatusNew.IN_PROCESS) return 33;
    if (status === StateStatusNew.ISSUES) return 33;
    return 0;
  }

  getFederalStatusText(): string {
    if (!this.isSentToIRS) return 'No enviado';
    if (!this.taxCase) return 'Pendiente';
    const status = this.taxCase.federalStatusNew;
    if (status === FederalStatusNew.TAXES_COMPLETED) return 'Completado';
    if (status === FederalStatusNew.TAXES_SENT) return 'Enviado';
    if (status === FederalStatusNew.DEPOSIT_PENDING || status === FederalStatusNew.CHECK_IN_TRANSIT) return 'Depósito pendiente';
    if (status === FederalStatusNew.IN_VERIFICATION || status === FederalStatusNew.VERIFICATION_IN_PROGRESS || status === FederalStatusNew.VERIFICATION_LETTER_SENT) return 'En verificación';
    if (status === FederalStatusNew.IN_PROCESS) return 'En proceso';
    if (status === FederalStatusNew.ISSUES) return 'Con problemas';
    return 'Pendiente';
  }

  getEstatalStatusText(): string {
    if (!this.isSentToIRS) return 'No enviado';
    if (!this.taxCase) return 'Pendiente';
    const status = this.taxCase.stateStatusNew;
    if (status === StateStatusNew.TAXES_COMPLETED) return 'Completado';
    if (status === StateStatusNew.TAXES_SENT) return 'Enviado';
    if (status === StateStatusNew.DEPOSIT_PENDING || status === StateStatusNew.CHECK_IN_TRANSIT) return 'Depósito pendiente';
    if (status === StateStatusNew.IN_VERIFICATION || status === StateStatusNew.VERIFICATION_IN_PROGRESS || status === StateStatusNew.VERIFICATION_LETTER_SENT) return 'En verificación';
    if (status === StateStatusNew.IN_PROCESS) return 'En proceso';
    if (status === StateStatusNew.ISSUES) return 'Con problemas';
    return 'Pendiente';
  }

  // ============ NAVIGATION ============
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  // ============ CONFETTI CELEBRATIONS ============
  private checkAndTriggerConfetti(wasAllComplete: boolean): void {
    // Check if all steps JUST became complete (transition from incomplete to complete)
    // Only show confetti once ever, persisted in localStorage
    if (this.allStepsComplete && !wasAllComplete && !this.hasShownCompletionConfetti()) {
      this.markCompletionConfettiShown();
      // Delay slightly to let the UI update first
      setTimeout(() => {
        this.confettiService.bigCelebration();
      }, 500);
    }

    // Check if refund was just deposited
    if (this.isRefundDeposited && !this.hasShownDepositConfetti()) {
      this.markDepositConfettiShown();
      setTimeout(() => {
        this.confettiService.fireworks();
      }, 300);
    }
  }

  private hasShownCompletionConfetti(): boolean {
    const key = `jai1_completion_confetti_${this.authService.currentUser?.id}`;
    return localStorage.getItem(key) === 'true';
  }

  private markCompletionConfettiShown(): void {
    const key = `jai1_completion_confetti_${this.authService.currentUser?.id}`;
    localStorage.setItem(key, 'true');
  }

  private hasShownDepositConfetti(): boolean {
    const key = `jai1_deposit_confetti_${this.authService.currentUser?.id}`;
    return localStorage.getItem(key) === 'true';
  }

  private markDepositConfettiShown(): void {
    const key = `jai1_deposit_confetti_${this.authService.currentUser?.id}`;
    localStorage.setItem(key, 'true');
  }

  // ============ CACHING ============
  private loadCachedData(): boolean {
    const userId = this.authService.currentUser?.id;
    if (!userId) return false;

    try {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!cached) return false;

      const cacheData: DashboardCacheData = JSON.parse(cached);

      // Verify cache belongs to current user
      if (cacheData.userId !== userId) {
        localStorage.removeItem(DASHBOARD_CACHE_KEY);
        return false;
      }

      // Check staleness (5 minutes max - short to ensure fresh data)
      const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
      if (Date.now() - cacheData.cachedAt > CACHE_MAX_AGE_MS) {
        localStorage.removeItem(DASHBOARD_CACHE_KEY);
        return false;
      }

      // Apply cached data
      if (cacheData.profileData) {
        this.profileData = cacheData.profileData;
      }
      if (cacheData.documents) {
        this.documents = cacheData.documents;
      }
      if (cacheData.calculatorResult) {
        this.calculatorResult = cacheData.calculatorResult;
      }
      return true; // Cache was successfully loaded
    } catch {
      return false;
    }
  }

  private cacheDashboardData(): void {
    const userId = this.authService.currentUser?.id;
    if (!userId) return;

    const cacheData: DashboardCacheData = {
      profileData: this.profileData,
      documents: this.documents,
      calculatorResult: this.calculatorResult,
      cachedAt: Date.now(),
      userId: userId
    };

    try {
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Silently ignore cache write failures
    }
  }

  // ============= NEW STATUS SYSTEM (v2) CLIENT DISPLAY HELPERS =============

  /**
   * Maps CaseStatus to client-friendly display (Spanish)
   */
  mapCaseStatusToClientDisplay(status: CaseStatus | null | undefined): string {
    if (!status) return 'Sin estado';

    const mapping: Record<CaseStatus, string> = {
      [CaseStatus.AWAITING_FORM]: 'Esperando formulario y documentos',
      [CaseStatus.AWAITING_DOCS]: 'Esperando formulario y documentos',
      [CaseStatus.DOCUMENTOS_ENVIADOS]: 'Documentos enviados',
      [CaseStatus.PREPARING]: 'Información recibida',
      [CaseStatus.TAXES_FILED]: 'Taxes presentados',
      [CaseStatus.CASE_ISSUES]: 'Problemas - contactar soporte',
    };

    return mapping[status] || status;
  }

  /**
   * Maps FederalStatusNew to client-friendly display (Spanish)
   */
  mapFederalStatusToClientDisplay(status: FederalStatusNew | null | undefined): string {
    if (!status) return 'Sin estado';

    const mapping: Record<FederalStatusNew, string> = {
      [FederalStatusNew.IN_PROCESS]: 'Taxes en proceso',
      [FederalStatusNew.IN_VERIFICATION]: 'En verificación',
      [FederalStatusNew.VERIFICATION_IN_PROGRESS]: 'En verificación',
      [FederalStatusNew.VERIFICATION_LETTER_SENT]: 'En verificación',
      [FederalStatusNew.CHECK_IN_TRANSIT]: 'Cheque en camino',
      [FederalStatusNew.DEPOSIT_PENDING]: 'Depósito pendiente',
      [FederalStatusNew.ISSUES]: 'Problemas - contactar soporte',
      [FederalStatusNew.TAXES_SENT]: 'Reembolso enviado',
      [FederalStatusNew.TAXES_COMPLETED]: 'Taxes finalizados',
    };

    return mapping[status] || status;
  }

  /**
   * Maps StateStatusNew to client-friendly display (Spanish)
   */
  mapStateStatusToClientDisplay(status: StateStatusNew | null | undefined): string {
    if (!status) return 'Sin estado';

    const mapping: Record<StateStatusNew, string> = {
      [StateStatusNew.IN_PROCESS]: 'Taxes en proceso',
      [StateStatusNew.IN_VERIFICATION]: 'En verificación',
      [StateStatusNew.VERIFICATION_IN_PROGRESS]: 'En verificación',
      [StateStatusNew.VERIFICATION_LETTER_SENT]: 'En verificación',
      [StateStatusNew.CHECK_IN_TRANSIT]: 'Cheque en camino',
      [StateStatusNew.DEPOSIT_PENDING]: 'Depósito pendiente',
      [StateStatusNew.ISSUES]: 'Problemas - contactar soporte',
      [StateStatusNew.TAXES_SENT]: 'Reembolso enviado',
      [StateStatusNew.TAXES_COMPLETED]: 'Taxes finalizados',
    };

    return mapping[status] || status;
  }

  /**
   * Get overall client-facing status display using new status system (v2)
   * Falls back to old system if new fields not populated
   */
  get clientStatusDisplay(): string {
    const taxCase = this.profileData?.taxCase;
    if (!taxCase) return 'Sin información';

    // Try new status system first (v2)
    const caseStatus = taxCase.caseStatus as CaseStatus | undefined;
    const federalStatusNew = taxCase.federalStatusNew as FederalStatusNew | undefined;
    const stateStatusNew = taxCase.stateStatusNew as StateStatusNew | undefined;

    // If case has issues, show that
    if (caseStatus === CaseStatus.CASE_ISSUES) {
      return 'Problemas - contactar soporte';
    }

    // If taxes are filed, show federal/state status
    if (caseStatus === CaseStatus.TAXES_FILED) {
      // Prioritize showing the most advanced status
      if (federalStatusNew === FederalStatusNew.TAXES_COMPLETED ||
          stateStatusNew === StateStatusNew.TAXES_COMPLETED) {
        return 'Taxes finalizados';
      }
      if (federalStatusNew === FederalStatusNew.TAXES_SENT ||
          stateStatusNew === StateStatusNew.TAXES_SENT) {
        return 'Reembolso enviado';
      }
      if (federalStatusNew === FederalStatusNew.CHECK_IN_TRANSIT ||
          stateStatusNew === StateStatusNew.CHECK_IN_TRANSIT) {
        return 'Cheque en camino';
      }
      if (federalStatusNew === FederalStatusNew.IN_VERIFICATION ||
          federalStatusNew === FederalStatusNew.VERIFICATION_IN_PROGRESS ||
          federalStatusNew === FederalStatusNew.VERIFICATION_LETTER_SENT ||
          stateStatusNew === StateStatusNew.IN_VERIFICATION ||
          stateStatusNew === StateStatusNew.VERIFICATION_IN_PROGRESS ||
          stateStatusNew === StateStatusNew.VERIFICATION_LETTER_SENT) {
        return 'En verificación';
      }
      if (federalStatusNew || stateStatusNew) {
        return 'Taxes en proceso';
      }

      // Fall back to display based on old system
      return 'Taxes presentados';
    }

    // Pre-filing states
    if (caseStatus === CaseStatus.PREPARING) {
      return 'Información recibida';
    }

    return 'Esperando formulario y documentos';
  }
}
