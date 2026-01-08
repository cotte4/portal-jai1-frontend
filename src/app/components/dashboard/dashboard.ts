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
import { ProfileResponse, ClientStatus, Document, DocumentType, TaxStatus } from '../../core/models';

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
    this.loadCachedData();

    // Immediately load user data from auth service (instant, no API call)
    // This allows us to show the dashboard shell right away
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
      this.userEmail = user.email || '';
      // We have basic user info - show content immediately while API loads
      this.hasLoaded = true;
      this.cdr.detectChanges();
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
    return '--';
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

  get isSentToIRS(): boolean {
    if (!this.taxCase) return false;
    const sentStatuses = [
      ClientStatus.TAXES_EN_PROCESO,
      ClientStatus.TAXES_EN_CAMINO,
      ClientStatus.EN_VERIFICACION,
      ClientStatus.TAXES_DEPOSITADOS,
      ClientStatus.TAXES_FINALIZADOS
    ];
    return sentStatuses.includes(this.taxCase.clientStatus);
  }

  get isAcceptedByIRS(): boolean {
    if (!this.taxCase) return false;
    return this.taxCase.federalStatus === TaxStatus.APPROVED ||
           this.taxCase.federalStatus === TaxStatus.DEPOSITED;
  }

  get estimatedReturnDate(): string | null {
    if (!this.taxCase?.refundDepositDate) return null;
    return new Date(this.taxCase.refundDepositDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  get isRefundDeposited(): boolean {
    if (!this.taxCase) return false;
    return this.taxCase.clientStatus === ClientStatus.TAXES_DEPOSITADOS ||
           this.taxCase.clientStatus === ClientStatus.TAXES_FINALIZADOS;
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

    const clientStatus = taxCase?.clientStatus || ClientStatus.ESPERANDO_DATOS;
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
    const submittedStatuses = [
      ClientStatus.TAXES_EN_PROCESO,
      ClientStatus.TAXES_EN_CAMINO,
      ClientStatus.EN_VERIFICACION,
      ClientStatus.TAXES_DEPOSITADOS,
      ClientStatus.TAXES_FINALIZADOS
    ];
    const isSubmitted = submittedStatuses.includes(clientStatus);

    if (!isSubmitted) {
      if (clientStatus === ClientStatus.CUENTA_EN_REVISION) {
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
  private loadCachedData(): void {
    const userId = this.authService.currentUser?.id;
    if (!userId) return;

    try {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!cached) return;

      const cacheData: DashboardCacheData = JSON.parse(cached);

      // Verify cache belongs to current user
      if (cacheData.userId !== userId) {
        localStorage.removeItem(DASHBOARD_CACHE_KEY);
        return;
      }

      // Check staleness (24 hours max)
      const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
      if (Date.now() - cacheData.cachedAt > CACHE_MAX_AGE_MS) {
        return;
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
    } catch (e) {
      console.warn('Failed to load dashboard cache:', e);
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
}
