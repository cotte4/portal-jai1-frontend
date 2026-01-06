import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReferralService, ReferralData, RewardTier } from '../../core/services/referral.service';
import { AuthService } from '../../core/services/auth.service';

type ViewState = 'loading' | 'not-eligible' | 'dashboard' | 'error';
type OnboardingStep = 'benefit1' | 'benefit2' | 'benefit3';

// DEMO MODE: Set to false when backend is ready
const DEMO_MODE = true;
const REFERRAL_ONBOARDING_KEY = 'referral_onboarding_completed';

@Component({
  selector: 'app-referral-program',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral-program.html',
  styleUrl: './referral-program.css'
})
export class ReferralProgram implements OnInit {
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  viewState: ViewState = 'dashboard';
  referralData: ReferralData | null = null;
  rewardTiers: RewardTier[] = [];

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

  // User info
  userName = '';
  userFirstName = '';

  ngOnInit() {
    this.rewardTiers = this.referralService.rewardTiers;
    this.loadUserData();

    if (DEMO_MODE) {
      // DEMO MODE: Load directly without backend
      this.initializeDemoMode();
    } else {
      // PRODUCTION: Check eligibility via backend
      this.checkEligibility();
    }

    // Check onboarding after data is loaded
    this.checkOnboardingStatus();

    // Hide transition after animation
    setTimeout(() => {
      this.showTransition = false;
      this.cdr.detectChanges();
    }, 800);
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
    return this.referralData !== null && this.referralData.referralCount > 0;
  }

  loadUserData() {
    try {
      const user = this.authService.currentUser;
      if (user) {
        this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        this.userFirstName = user.firstName || 'Usuario';
      } else {
        this.userFirstName = 'Usuario';
      }
    } catch (e) {
      this.userFirstName = 'Usuario';
    }
  }

  // DEMO MODE: Initialize with demo data immediately
  initializeDemoMode() {
    // Create demo referral code with referrals to show State #2
    const code = this.generateDemoCode();
    this.referralData = {
      code: code,
      referralCount: 4, // Demo with referrals to show State #2
      totalEarnings: 65,
      referrals: [
        {
          id: 'demo_1',
          name: 'María García',
          date: new Date(Date.now() - 86400000 * 7).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_2',
          name: 'Carlos López',
          date: new Date(Date.now() - 86400000 * 5).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_3',
          name: 'Ana Martínez',
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_4',
          name: 'Pedro Sánchez',
          date: new Date(Date.now() - 86400000).toISOString(),
          status: 'pending',
          reward: 15
        }
      ],
      createdAt: new Date().toISOString()
    };
    this.viewState = 'dashboard';
    this.subscribeToUpdates();
  }

  generateDemoCode(): string {
    const prefix = this.userFirstName.substring(0, 3).toUpperCase() || 'JAI';
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${random}`;
  }

  subscribeToUpdates() {
    this.referralService.referralData$.subscribe(updatedData => {
      if (updatedData) {
        this.referralData = updatedData;
      }
    });
  }

  // PRODUCTION MODE: Check eligibility (for when backend is ready)
  checkEligibility() {
    // This will be implemented when backend is ready
    this.initializeDemoMode();
  }

  refresh() {
    this.isRefreshing = true;
    setTimeout(() => {
      this.initializeDemoMode();
      this.isRefreshing = false;
    }, 500);
  }

  skipToDemo() {
    this.initializeDemoMode();
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
    const subject = '¡Obtén $11 de descuento en tus taxes con JAI1!';
    const body = this.referralService.getShareMessage();
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url);
    this.showShareOptions = false;
  }

  // Stats getters
  get currentTier(): RewardTier | null {
    if (!this.referralData) return null;
    return this.referralService.getCurrentTier(this.referralData.referralCount);
  }

  get nextTier(): RewardTier | null {
    if (!this.referralData) return null;
    return this.referralService.getNextTier(this.referralData.referralCount);
  }

  get progressToNextTier(): number {
    if (!this.referralData) return 0;
    return this.referralService.getProgressToNextTier(this.referralData.referralCount);
  }

  get referralsToNextTier(): number {
    if (!this.referralData || !this.nextTier) return 0;
    return this.nextTier.referralsRequired - this.referralData.referralCount;
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

  isTierUnlocked(tier: RewardTier): boolean {
    if (!this.referralData) return false;
    return this.referralData.referralCount >= tier.referralsRequired;
  }

  isTierCurrent(tier: RewardTier): boolean {
    return this.currentTier?.tier === tier.tier;
  }

  isTierNext(tier: RewardTier): boolean {
    return this.nextTier?.tier === tier.tier;
  }

  // Demo function (for testing)
  addDemoReferral() {
    this.referralService.addDemoReferral();
  }
}
