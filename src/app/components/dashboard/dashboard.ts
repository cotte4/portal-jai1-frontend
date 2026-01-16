import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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
import {
  ProfileResponse,
  Document,
  DocumentType,
  TaxStatus,
  PreFilingStatus,
  CaseStatus,
  FederalStatusNew,
  StateStatusNew
} from '../../core/models';

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
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  profileData: ProfileResponse | null = null;
  documents: Document[] = [];
  calculatorResult: CalculatorResult | null = null;
  hasLoaded: boolean = false; // True after first load completes
  errorMessage: string = '';
  private isLoadingInProgress: boolean = false; // Prevent concurrent API calls

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

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
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
        catchError(error => {
          console.warn('Profile load error or timeout:', error);
          return of(null);
        })
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
        if (results.profile) {
          this.profileData = results.profile;
        }
        this.documents = results.documents || [];

        // Sync calculator result from backend (for cross-device support)
        if (results.calculatorResult && results.calculatorResult.estimatedRefund) {
          // Save to localStorage for consistency and update local state
          this.calculatorResultService.saveResult(
            results.calculatorResult.estimatedRefund,
            results.calculatorResult.w2FileName
          );
        }

        // Cache dashboard data for faster loads on refresh
        this.cacheDashboardData();
      }
    });

    // Safety timeout - ensure content shows after 5 seconds even if APIs are slow
    setTimeout(() => {
      if (!this.hasLoaded) {
        this.hasLoaded = true;
        this.cdr.detectChanges();
        console.log('Dashboard: Safety timeout triggered');
      }
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

  get userProgressPercent(): number {
    let completed = 0;
    if (this.isProfileComplete) completed++;
    if (this.isFormSent) completed++;
    if (this.hasW2Document) completed++;
    if (this.hasPaymentProof) completed++;
    return Math.round((completed / 4) * 100);
  }

  get userProgressComplete(): boolean {
    return this.userProgressPercent === 100;
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
    // Taxes are sent to IRS when taxesFiled = true
    return this.taxCase.taxesFiled === true;
  }

  get isAcceptedByIRS(): boolean {
    if (!this.taxCase) return false;
    return this.taxCase.federalStatus === TaxStatus.APPROVED ||
           this.taxCase.federalStatus === TaxStatus.DEPOSITED;
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
    return this.taxCase.federalStatus === TaxStatus.DEPOSITED ||
           this.taxCase.stateStatus === TaxStatus.DEPOSITED;
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
    // Only show IRS progress if user has completed their part
    return this.userProgressComplete || this.isSentToIRS;
  }

  // ============ CURRENT STEP (Matching tax-tracking logic) ============
  get currentStepInfo(): CurrentStepInfo {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const taxesFiled = taxCase?.taxesFiled || false;
    const preFilingStatus = taxCase?.preFilingStatus;
    const federalStatus = taxCase?.federalStatus;
    const stateStatus = taxCase?.stateStatus;
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
      if (preFilingStatus === PreFilingStatus.DOCUMENTATION_COMPLETE) {
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
    if (federalStatus === TaxStatus.REJECTED) {
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

    if (stateStatus === TaxStatus.REJECTED) {
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
    if (federalStatus === TaxStatus.DEPOSITED && stateStatus === TaxStatus.DEPOSITED) {
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
    if (federalStatus === TaxStatus.DEPOSITED) {
      // Federal done, check state
      if (stateStatus === TaxStatus.APPROVED) {
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
      if (stateStatus === TaxStatus.PROCESSING || !stateStatus) {
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

    if (stateStatus === TaxStatus.DEPOSITED) {
      // State done, check federal
      if (federalStatus === TaxStatus.APPROVED) {
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
      if (federalStatus === TaxStatus.PROCESSING || !federalStatus) {
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
    if (federalStatus === TaxStatus.APPROVED && stateStatus === TaxStatus.APPROVED) {
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

    if (federalStatus === TaxStatus.APPROVED) {
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

    if (stateStatus === TaxStatus.APPROVED) {
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

    // Default: waiting for IRS decisions
    if (federalStatus === TaxStatus.PROCESSING || stateStatus === TaxStatus.PROCESSING) {
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

  // ============ NAVIGATION ============
  navigateTo(route: string) {
    this.router.navigate([route]);
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
    } catch (e) {
      console.warn('Failed to load dashboard cache:', e);
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
    } catch (e) {
      console.warn('Failed to cache dashboard data:', e);
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
    if (caseStatus === CaseStatus.TAXES_FILED || taxCase.taxesFiled) {
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
