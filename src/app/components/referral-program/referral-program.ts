import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

type ViewState = 'loading' | 'not-eligible' | 'dashboard' | 'error';
type OnboardingStep = 'benefit1' | 'benefit2' | 'benefit3';

const REFERRAL_ONBOARDING_KEY = 'referral_onboarding_completed';

@Component({
  selector: 'app-referral-program',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral-program.html',
  styleUrl: './referral-program.css'
})
export class ReferralProgram implements OnInit, OnDestroy {
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private transitionTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.transitionTimeoutId) {
      clearTimeout(this.transitionTimeoutId);
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
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.codeData = data.code;
        this.referrals = data.referrals;
        this.discountInfo = data.discount;
        this.leaderboard = data.leaderboard;
        this.hasLoaded = true;

        // Determine view state based on code eligibility
        if (data.code.code) {
          this.viewState = 'dashboard';
        } else {
          this.viewState = 'not-eligible';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load referral data:', err);
        this.errorMessage = 'No se pudo cargar el programa de referidos. Intenta de nuevo.';
        this.viewState = 'error';
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  // Onboarding methods
  checkOnboardingStatus() {
    const completed = localStorage.getItem(REFERRAL_ONBOARDING_KEY);
    this.showOnboarding = !completed;
  }

  nextOnboardingStep() {
    if (this.onboardingStep === 'benefit1') {
      this.onboardingStep = 'benefit2';
    } else if (this.onboardingStep === 'benefit2') {
      this.onboardingStep = 'benefit3';
    } else {
      this.completeOnboarding();
    }
  }

  previousOnboardingStep() {
    if (this.onboardingStep === 'benefit3') {
      this.onboardingStep = 'benefit2';
    } else if (this.onboardingStep === 'benefit2') {
      this.onboardingStep = 'benefit1';
    }
  }

  completeOnboarding() {
    localStorage.setItem(REFERRAL_ONBOARDING_KEY, 'true');
    this.showOnboarding = false;
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

  // Referral code actions
  copyCode() {
    this.referralService.copyCodeToClipboard().then(success => {
      if (success) {
        this.codeCopied = true;
        setTimeout(() => {
          this.codeCopied = false;
          this.cdr.detectChanges();
        }, 2000);
      }
    });
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

  // Stats getters
  get currentTier(): RewardTier | null {
    return this.referralService.getCurrentTier(this.successfulReferralCount);
  }

  get nextTier(): RewardTier | null {
    return this.referralService.getNextTier(this.successfulReferralCount);
  }

  get progressToNextTier(): number {
    return this.referralService.getProgressToNextTier(this.successfulReferralCount);
  }

  get referralsToNextTier(): number {
    if (!this.nextTier) return 0;
    return this.nextTier.referralsRequired - this.successfulReferralCount;
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
    return this.successfulReferralCount >= tier.referralsRequired;
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
}
