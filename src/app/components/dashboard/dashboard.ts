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
      }
    });
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

  // ============ NAVIGATION ============
  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
