import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  ReferralService,
  ReferralCodeResponse,
  ReferralRecord,
  DiscountInfo,
  LeaderboardEntry,
  RewardTier
} from '../../core/services/referral.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { AnimationService } from '../../core/services/animation.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { REFERRAL_TERMS_TITLE, REFERRAL_TERMS_CONTENT } from './referral-terms-content';

type ViewState = 'loading' | 'not-eligible' | 'dashboard' | 'error';
type OnboardingStep = 'benefit1' | 'benefit2' | 'benefit3';

const REFERRAL_ONBOARDING_KEY = 'referral_onboarding_completed';

@Component({
  selector: 'app-referral-program',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral-program.html',
  styleUrl: './referral-program.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferralProgram implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private authService = inject(AuthService);
  private confettiService = inject(ConfettiService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private transitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private previousTier: number = 0;
  private hasAnimated = false;

  // Animation references
  @ViewChild('welcomeCard') welcomeCard!: ElementRef<HTMLElement>;
  @ViewChild('codeCard') codeCard!: ElementRef<HTMLElement>;
  @ViewChildren('statCard') statCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('tierCard') tierCards!: QueryList<ElementRef<HTMLElement>>;

  viewState: ViewState = 'loading';
  rewardTiers: RewardTier[] = [];

  // API Data
  codeData: ReferralCodeResponse | null = null;
  referrals: ReferralRecord[] = [];
  discountInfo: DiscountInfo | null = null;
  leaderboard: LeaderboardEntry[] = [];

  // Onboarding
  showOnboarding = false;
  onboardingStep: OnboardingStep = 'benefit1';

  // Page transition
  showTransition = true;

  // UI States
  codeCopied = false;
  showShareOptions = false;
  isRefreshing = false;
  errorMessage = '';
  hasLoaded = false;

  // Terms & Conditions Modal
  showTermsModal = false;
  termsTitle = REFERRAL_TERMS_TITLE;
  termsContent = REFERRAL_TERMS_CONTENT;

  // User info
  userName = '';
  userFirstName = '';
  currentUserId = '';

  ngOnInit() {
    this.rewardTiers = this.referralService.rewardTiers;
    this.loadUserData();
    this.loadReferralData();
    this.checkOnboardingStatus();

    // Hide transition after animation
    this.transitionTimeoutId = setTimeout(() => {
      this.showTransition = false;
      this.cdr.detectChanges();
    }, 800);
  }

  ngAfterViewInit() {
    // Animations will be triggered when data loads
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.animationService.killAnimations();
    if (this.transitionTimeoutId) {
      clearTimeout(this.transitionTimeoutId);
    }
  }

  private runEntranceAnimations(): void {
    if (this.hasAnimated) return;
    this.hasAnimated = true;

    // Animate welcome card
    if (this.welcomeCard?.nativeElement) {
      this.animationService.slideIn(this.welcomeCard.nativeElement, 'up', { delay: 0.1 });
    }

    // Animate code card with scale effect
    if (this.codeCard?.nativeElement) {
      this.animationService.scaleIn(this.codeCard.nativeElement, { delay: 0.2 });
    }

    // Stagger animate stat cards
    if (this.statCards?.length) {
      const cards = this.statCards.map(c => c.nativeElement);
      this.animationService.staggerIn(cards, { direction: 'up', stagger: 0.08, delay: 0.3 });
    }

    // Stagger animate tier cards
    if (this.tierCards?.length) {
      const tiers = this.tierCards.map(c => c.nativeElement);
      this.animationService.staggerIn(tiers, { direction: 'up', stagger: 0.1, delay: 0.5 });
    }
  }

  // Load data from API
  loadReferralData() {
    this.viewState = 'loading';

    forkJoin({
      code: this.referralService.getMyCode(),
      referrals: this.referralService.getMyReferrals(),
      discount: this.referralService.getMyDiscount(),
      leaderboard: this.referralService.getLeaderboard(10)
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.hasLoaded = true;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.codeData = data.code;
        this.referrals = data.referrals;
        this.discountInfo = data.discount;
        this.leaderboard = data.leaderboard;

        // Determine view state based on code eligibility
        if (data.code.code) {
          this.viewState = 'dashboard';

          // Check for tier upgrade celebration
          this.checkTierUpgrade();

          // Run entrance animations after data loads
          setTimeout(() => this.runEntranceAnimations(), 100);
        } else {
          this.viewState = 'not-eligible';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el programa de referidos. Intenta de nuevo.';
        this.viewState = 'error';
        this.cdr.detectChanges();
      }
    });
  }

  // Onboarding methods
  checkOnboardingStatus() {
    // Check backend for onboarding status (backend is source of truth)
    this.referralService.getReferralOnboardingStatus().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.completed) {
          this.showOnboarding = false;
          localStorage.setItem(REFERRAL_ONBOARDING_KEY, 'true');
        } else {
          // Backend says not completed — always show onboarding
          // Clear stale localStorage to prevent desync
          localStorage.removeItem(REFERRAL_ONBOARDING_KEY);
          this.showOnboarding = true;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        // On network error, fallback to localStorage check
        const localCompleted = localStorage.getItem(REFERRAL_ONBOARDING_KEY);
        this.showOnboarding = !localCompleted;
        this.cdr.detectChanges();
      }
    });
  }

  nextOnboardingStep() {
    if (this.onboardingStep === 'benefit1') {
      this.onboardingStep = 'benefit2';
    } else if (this.onboardingStep === 'benefit2') {
      this.onboardingStep = 'benefit3';
    } else {
      this.completeOnboarding();
    }
    this.cdr.detectChanges();
  }

  previousOnboardingStep() {
    if (this.onboardingStep === 'benefit3') {
      this.onboardingStep = 'benefit2';
    } else if (this.onboardingStep === 'benefit2') {
      this.onboardingStep = 'benefit1';
    }
    this.cdr.detectChanges();
  }

  completeOnboarding() {
    // Set localStorage immediately for fast UI response
    localStorage.setItem(REFERRAL_ONBOARDING_KEY, 'true');
    this.showOnboarding = false;
    this.cdr.detectChanges();

    // Save to backend for persistence across devices and logins
    this.referralService.markReferralOnboardingComplete().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        console.log('Referral onboarding marked as complete in backend');
      },
      error: (error) => {
        console.error('Failed to mark referral onboarding complete in backend:', error);
        // Don't show error to user - localStorage is set, so they won't see it again this session
      }
    });
  }

  skipOnboarding() {
    this.completeOnboarding();
  }

  getCurrentOnboardingIndex(): number {
    const steps: OnboardingStep[] = ['benefit1', 'benefit2', 'benefit3'];
    return steps.indexOf(this.onboardingStep);
  }

  // Check if user has any referrals
  get hasReferrals(): boolean {
    return this.referrals.length > 0;
  }

  // Total referrals used for discount, progress, and tier calculations
  get totalReferralCount(): number {
    return this.discountInfo?.totalReferrals || 0;
  }

  // Kept for backwards compatibility - actual successful referrals
  get successfulReferralCount(): number {
    return this.discountInfo?.successfulReferrals || 0;
  }

  loadUserData() {
    try {
      const user = this.authService.currentUser;
      if (user) {
        this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        this.userFirstName = user.firstName || 'Usuario';
        this.currentUserId = user.id;
      } else {
        this.userFirstName = 'Usuario';
      }
    } catch (e) {
      this.userFirstName = 'Usuario';
    }
  }

  refresh() {
    this.isRefreshing = true;
    this.loadReferralData();
    setTimeout(() => {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }, 500);
  }

  // Navigation
  goToTaxMode() {
    this.router.navigate(['/dashboard']);
  }

  goToTaxForm() {
    this.router.navigate(['/tax-form']);
  }

  goToLeaderboard() {
    this.router.navigate(['/leaderboard']);
  }

  // Referral code actions
  copyCode() {
    this.referralService.copyCodeToClipboard().then(success => {
      if (success) {
        this.codeCopied = true;
        // Quick confetti burst for copy success
        this.confettiService.quickBurst();
        setTimeout(() => {
          this.codeCopied = false;
          this.cdr.detectChanges();
        }, 2000);
      }
    });
  }

  // Check if user reached a new tier and celebrate
  private checkTierUpgrade(): void {
    const currentTierNum = this.currentTier?.tier || 0;
    const storedTierKey = `jai1_referral_tier_${this.currentUserId}`;
    const storedTier = parseInt(localStorage.getItem(storedTierKey) || '0', 10);

    // If current tier is higher than stored, celebrate!
    if (currentTierNum > storedTier && storedTier > 0) {
      setTimeout(() => {
        this.confettiService.stars();
        setTimeout(() => this.confettiService.sideCannons(), 300);
      }, 500);
    }

    // Update stored tier
    if (currentTierNum > 0) {
      localStorage.setItem(storedTierKey, currentTierNum.toString());
    }
  }

  toggleShareOptions() {
    this.showShareOptions = !this.showShareOptions;
  }

  shareViaWhatsApp() {
    const message = this.referralService.getShareMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    this.showShareOptions = false;
  }

  shareViaTwitter() {
    const message = this.referralService.getShareMessage();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    this.showShareOptions = false;
  }

  shareViaEmail() {
    const subject = 'Obtén $11 de descuento en tus taxes con JAI1!';
    const body = this.referralService.getShareMessage();
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url);
    this.showShareOptions = false;
  }

  // Stats getters - all use totalReferralCount for calculations
  get currentTier(): RewardTier | null {
    return this.referralService.getCurrentTier(this.totalReferralCount);
  }

  get nextTier(): RewardTier | null {
    return this.referralService.getNextTier(this.totalReferralCount);
  }

  get progressToNextTier(): number {
    return this.referralService.getProgressToNextTier(this.totalReferralCount);
  }

  get referralsToNextTier(): number {
    if (!this.nextTier) return 0;
    return this.nextTier.referralsRequired - this.totalReferralCount;
  }

  get currentDiscountPercent(): number {
    return this.discountInfo?.currentDiscountPercent || 0;
  }

  // Format helpers
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusLabel(status: ReferralRecord['status']): string {
    return this.referralService.getStatusLabel(status);
  }

  isTierUnlocked(tier: RewardTier): boolean {
    return this.totalReferralCount >= tier.referralsRequired;
  }

  isTierCurrent(tier: RewardTier): boolean {
    return this.currentTier?.tier === tier.tier;
  }

  isTierNext(tier: RewardTier): boolean {
    return this.nextTier?.tier === tier.tier;
  }

  // Leaderboard helpers
  isCurrentUser(entry: LeaderboardEntry): boolean {
    return entry.userId === this.currentUserId;
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return '1';
    if (rank === 2) return '2';
    if (rank === 3) return '3';
    return rank.toString();
  }

  // Terms & Conditions Modal methods
  openTermsModal() {
    this.showTermsModal = true;
    this.cdr.detectChanges();
  }

  closeTermsModal() {
    this.showTermsModal = false;
    this.cdr.detectChanges();
  }

  onTermsModalBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('terms-modal-overlay')) {
      this.closeTermsModal();
    }
  }
}
