import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter, forkJoin, finalize, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService, CalculatorResult } from '../../core/services/calculator-result.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { ProfileResponse, ClientStatus, Document, DocumentType, TaxStatus } from '../../core/models';
import { CardAnimateDirective, HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, CardAnimateDirective, HoverScaleDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);
  private subscriptions = new Subscription();

  @ViewChild('welcomeSection') welcomeSection!: ElementRef<HTMLElement>;
  @ViewChild('refundValue') refundValue!: ElementRef<HTMLElement>;

  profileData: ProfileResponse | null = null;
  documents: Document[] = [];
  calculatorResult: CalculatorResult | null = null;
  hasLoaded: boolean = false; // True after first load completes
  errorMessage: string = '';
  private isLoadingInProgress: boolean = false; // Prevent concurrent API calls
  private animationsInitialized: boolean = false;

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
    // Animations will be initialized after data loads
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  private initAnimations() {
    if (this.animationsInitialized) return;
    this.animationsInitialized = true;

    // Wait for next tick to ensure DOM is ready
    setTimeout(() => {
      // Animate welcome section
      const welcomeEl = this.elementRef.nativeElement.querySelector('.welcome-section');
      if (welcomeEl) {
        this.animationService.slideIn(welcomeEl, 'up', { duration: 0.5 });
      }

      // Animate steps card
      const stepsCard = this.elementRef.nativeElement.querySelector('.steps-card');
      if (stepsCard) {
        this.animationService.slideIn(stepsCard, 'up', { duration: 0.5, delay: 0.1 });
      }

      // Stagger animate step items
      const stepItems = this.elementRef.nativeElement.querySelectorAll('.step-item');
      if (stepItems.length > 0) {
        this.animationService.staggerIn(stepItems, {
          direction: 'left',
          stagger: 0.08,
          delay: 0.3
        });
      }

      // Animate action cards with stagger
      const actionCards = this.elementRef.nativeElement.querySelectorAll('.action-card');
      if (actionCards.length > 0) {
        this.animationService.staggerIn(actionCards, {
          direction: 'up',
          stagger: 0.1,
          delay: 0.4
        });
      }

      // Animate refund counter if there's a result
      if (this.hasCalculatorResult && this.calculatorResult) {
        const refundEl = this.elementRef.nativeElement.querySelector('.refund-value');
        if (refundEl) {
          this.animationService.counterUp(refundEl, this.calculatorResult.estimatedRefund, {
            prefix: '$',
            duration: 1,
            decimals: 0
          });
        }
      }

      // Animate IRS section if visible
      const irsSection = this.elementRef.nativeElement.querySelector('.irs-section');
      if (irsSection) {
        this.animationService.slideIn(irsSection, 'up', { duration: 0.5, delay: 0.5 });

        // Stagger IRS steps
        const irsSteps = irsSection.querySelectorAll('.irs-step');
        if (irsSteps.length > 0) {
          this.animationService.staggerIn(irsSteps, {
            direction: 'left',
            stagger: 0.08,
            delay: 0.6
          });
        }
      }

      // Animate help footer
      const helpFooter = this.elementRef.nativeElement.querySelector('.help-footer');
      if (helpFooter) {
        this.animationService.fadeIn(helpFooter, { delay: 0.7 });
      }

      // Animate progress circle
      this.animateProgressCircle();
    });
  }

  private animateProgressCircle() {
    const circleFill = this.elementRef.nativeElement.querySelector('.circle-fill') as SVGPathElement;
    if (circleFill && !this.animationService.prefersReducedMotion()) {
      // Animate stroke-dasharray from 0 to actual value
      const targetPercent = this.userProgressPercent;
      circleFill.style.strokeDasharray = '0, 100';

      const obj = { value: 0 };
      const gsap = (window as any).gsap;
      if (gsap) {
        gsap.to(obj, {
          value: targetPercent,
          duration: 0.8,
          delay: 0.5,
          ease: 'power2.out',
          onUpdate: () => {
            circleFill.style.strokeDasharray = `${obj.value}, 100`;
          }
        });
      }
    }
  }

  loadData() {
    // Prevent concurrent API calls
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;

    // Load both profile and documents in parallel, wait for both to complete
    forkJoin({
      profile: this.profileService.getProfile().pipe(
        catchError(error => {
          this.errorMessage = error.message || 'Error al cargar perfil';
          return of(null);
        })
      ),
      documents: this.documentService.getDocuments().pipe(
        catchError(() => of([] as Document[]))
      )
    }).pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
        // Initialize animations after data loads
        setTimeout(() => this.initAnimations());
      })
    ).subscribe({
      next: (results) => {
        if (results.profile) {
          this.profileData = results.profile;
        }
        this.documents = results.documents || [];
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
