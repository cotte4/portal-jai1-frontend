import { Component, OnInit, AfterViewInit, OnDestroy, inject, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReferralService, ReferralData, RewardTier } from '../../core/services/referral.service';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective, CardAnimateDirective } from '../../shared/directives';
import { gsap } from 'gsap';

type ViewState = 'loading' | 'not-eligible' | 'dashboard' | 'error';
type OnboardingStep = 'benefit1' | 'benefit2' | 'benefit3';

// DEMO MODE: Set to false when backend is ready
const DEMO_MODE = true;
const REFERRAL_ONBOARDING_KEY = 'referral_onboarding_completed';

@Component({
  selector: 'app-referral-program',
  standalone: true,
  imports: [CommonModule, HoverScaleDirective, CardAnimateDirective],
  templateUrl: './referral-program.html',
  styleUrl: './referral-program.css'
})
export class ReferralProgram implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

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
  }

  ngAfterViewInit() {
    // Animate page transition
    this.animatePageTransition();
  }

  ngOnDestroy() {
    this.animationService.killAnimations();
  }

  private animatePageTransition() {
    const container = this.elementRef.nativeElement;
    const transitionOverlay = container.querySelector('.page-transition');
    const transitionContent = container.querySelector('.transition-content');
    const transitionIcon = container.querySelector('.transition-icon');
    const transitionText = container.querySelector('.transition-text');

    if (transitionOverlay && transitionContent) {
      // Animate transition icon bounce
      if (transitionIcon) {
        gsap.fromTo(transitionIcon,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
        );
      }

      // Animate transition text
      if (transitionText) {
        gsap.fromTo(transitionText,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, delay: 0.2, ease: 'power2.out' }
        );
      }

      // Fade out transition overlay
      gsap.to(transitionOverlay, {
        opacity: 0,
        duration: 0.4,
        delay: 0.6,
        ease: 'power2.inOut',
        onComplete: () => {
          this.showTransition = false;
          this.cdr.detectChanges();

          // Start main content animations
          setTimeout(() => {
            if (this.showOnboarding) {
              this.animateOnboarding();
            } else {
              this.animateMainContent();
            }
          }, 100);
        }
      });
    } else {
      // Fallback if transition elements not found
      setTimeout(() => {
        this.showTransition = false;
        this.cdr.detectChanges();
        if (this.showOnboarding) {
          this.animateOnboarding();
        } else {
          this.animateMainContent();
        }
      }, 800);
    }
  }

  private animateOnboarding() {
    const container = this.elementRef.nativeElement;

    // Animate glow effects
    const glows = container.querySelectorAll('.onboarding-glow');
    glows.forEach((glow: Element, index: number) => {
      this.animateGlowPulse(glow as HTMLElement, index);
    });

    // Animate onboarding content
    this.animateOnboardingContent();
  }

  private animateGlowPulse(element: HTMLElement, index: number) {
    gsap.to(element, {
      opacity: 0.5,
      scale: 1.1,
      duration: 2,
      delay: index * 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }

  private animateOnboardingContent() {
    const container = this.elementRef.nativeElement;
    const content = container.querySelector('.onboarding-content');
    const icon = container.querySelector('.onboarding-icon');
    const dots = container.querySelectorAll('.onboarding-dots .dot');
    const nav = container.querySelector('.onboarding-nav');
    const skipBtn = container.querySelector('.onboarding-skip');

    if (skipBtn) {
      this.animationService.fadeIn(skipBtn as HTMLElement, { duration: 0.3 });
    }

    if (content) {
      this.animationService.slideIn(content as HTMLElement, 'up', { duration: 0.5, distance: 30 });
    }

    if (icon) {
      gsap.fromTo(icon,
        { scale: 0, rotation: -15 },
        { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.7)', delay: 0.2 }
      );
    }

    if (dots.length) {
      gsap.fromTo(dots,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, stagger: 0.1, ease: 'back.out(1.7)', delay: 0.4 }
      );
    }

    if (nav) {
      this.animationService.slideIn(nav as HTMLElement, 'up', { duration: 0.4, distance: 20, delay: 0.5 });
    }
  }

  private animateMainContent() {
    const container = this.elementRef.nativeElement;

    // Animate background effects
    this.animateBackgroundEffects();

    // Animate header
    const header = container.querySelector('.referral-header');
    if (header) {
      this.animationService.slideIn(header as HTMLElement, 'down', { duration: 0.4, distance: 20 });
    }

    // Animate main sections based on state
    if (this.viewState === 'dashboard' && this.referralData) {
      setTimeout(() => this.animateDashboard(), 200);
    }
  }

  private animateBackgroundEffects() {
    const container = this.elementRef.nativeElement;
    const bgGradient = container.querySelector('.bg-gradient');

    if (bgGradient) {
      // GSAP gradient shift animation (replacing CSS @keyframes)
      gsap.to(bgGradient, {
        x: '-5%',
        y: '5%',
        duration: 20,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }

    // Animate floating elements if any
    const floatingElements = container.querySelectorAll('.floating-element');
    floatingElements.forEach((elem: Element, index: number) => {
      this.animationService.float(elem as HTMLElement, {
        distance: 30,
        duration: 15 + (index * 5)
      });
    });
  }

  private animateDashboard() {
    const container = this.elementRef.nativeElement;

    // Welcome section
    const welcomeSection = container.querySelector('.welcome-section');
    if (welcomeSection) {
      const badge = welcomeSection.querySelector('.welcome-badge');
      const h1 = welcomeSection.querySelector('h1');
      const p = welcomeSection.querySelector('p');

      if (badge) {
        this.animationService.scaleIn(badge as HTMLElement, { duration: 0.4, fromScale: 0.8 });
      }
      if (h1) {
        this.animationService.slideIn(h1 as HTMLElement, 'up', { duration: 0.5, distance: 20, delay: 0.1 });
      }
      if (p) {
        this.animationService.slideIn(p as HTMLElement, 'up', { duration: 0.5, distance: 20, delay: 0.2 });
      }
    }

    // Animate code section
    setTimeout(() => this.animateCodeSection(), 300);

    // Animate stats section (if hasReferrals)
    if (this.hasReferrals) {
      setTimeout(() => this.animateStatsSection(), 400);
      setTimeout(() => this.animateProgressSection(), 500);
      setTimeout(() => this.animateReferralsList(), 700);
    } else {
      setTimeout(() => this.animateEmptyState(), 400);
    }

    // Animate tiers section
    setTimeout(() => this.animateTiersSection(), 600);

    // Animate footer
    setTimeout(() => {
      const footer = container.querySelector('.referral-footer');
      if (footer) {
        this.animationService.fadeIn(footer as HTMLElement, { duration: 0.4 });
      }
    }, 800);
  }

  private animateCodeSection() {
    const container = this.elementRef.nativeElement;
    const codeCard = container.querySelector('.code-card');
    const codeDisplay = container.querySelector('.code-display');
    const codeActions = container.querySelector('.code-actions');
    const referralBenefit = container.querySelector('.referral-benefit');

    if (codeCard) {
      this.animationService.scaleIn(codeCard as HTMLElement, { duration: 0.5, fromScale: 0.95 });
    }

    if (codeDisplay) {
      gsap.fromTo(codeDisplay,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.4, delay: 0.2, ease: 'back.out(1.4)' }
      );
    }

    if (codeActions) {
      this.animationService.slideIn(codeActions as HTMLElement, 'up', { duration: 0.4, distance: 15, delay: 0.3 });
    }

    if (referralBenefit) {
      this.animationService.slideIn(referralBenefit as HTMLElement, 'up', { duration: 0.4, distance: 15, delay: 0.4 });
    }
  }

  private animateStatsSection() {
    const container = this.elementRef.nativeElement;
    const statCards = container.querySelectorAll('.stat-card');

    if (statCards.length) {
      this.animationService.staggerIn(statCards, {
        stagger: 0.1,
        direction: 'up',
        distance: 25
      });

      // Counter animations for stat values
      statCards.forEach((card: Element, index: number) => {
        const valueElement = card.querySelector('.stat-value');
        if (valueElement) {
          setTimeout(() => {
            const text = valueElement.textContent || '';
            const numMatch = text.match(/\d+/);
            if (numMatch) {
              const value = parseInt(numMatch[0], 10);
              const prefix = text.includes('$') ? '$' : '';
              this.animationService.counterUp(valueElement as HTMLElement, value, {
                startValue: 0,
                duration: 1.2,
                prefix: prefix,
                decimals: 0
              });
            }
          }, 300 + (index * 150));
        }
      });
    }
  }

  private animateProgressSection() {
    const container = this.elementRef.nativeElement;
    const progressCard = container.querySelector('.progress-card');
    const progressFill = container.querySelector('.progress-fill');

    if (progressCard) {
      this.animationService.slideIn(progressCard as HTMLElement, 'up', { duration: 0.5, distance: 20 });
    }

    if (progressFill) {
      const currentWidth = this.progressToNextTier;
      gsap.fromTo(progressFill,
        { width: '0%' },
        { width: `${currentWidth}%`, duration: 1, delay: 0.5, ease: 'power2.out' }
      );
    }
  }

  private animateEmptyState() {
    const container = this.elementRef.nativeElement;
    const emptyCard = container.querySelector('.empty-state-card');
    const emptyIcon = container.querySelector('.empty-icon-large');

    if (emptyCard) {
      this.animationService.scaleIn(emptyCard as HTMLElement, { duration: 0.5, fromScale: 0.95 });
    }

    if (emptyIcon) {
      // Bounce soft animation (replacing CSS @keyframes bounce-soft)
      gsap.to(emptyIcon, {
        y: -8,
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }
  }

  private animateTiersSection() {
    const container = this.elementRef.nativeElement;
    const sectionHeader = container.querySelector('.tiers-section .section-header');
    const tierCards = container.querySelectorAll('.tier-card');

    if (sectionHeader) {
      this.animationService.slideIn(sectionHeader as HTMLElement, 'up', { duration: 0.4, distance: 20 });
    }

    if (tierCards.length) {
      this.animationService.staggerIn(tierCards, {
        stagger: 0.08,
        direction: 'up',
        distance: 20,
        delay: 0.2
      });

      // Animate tier pulse for "next" tier (replacing CSS @keyframes tier-pulse)
      tierCards.forEach((card: Element) => {
        if (card.classList.contains('next')) {
          this.animateTierPulse(card as HTMLElement);
        }
      });
    }
  }

  private animateTierPulse(element: HTMLElement) {
    gsap.to(element, {
      boxShadow: '0 0 20px 4px rgba(99, 102, 241, 0.2)',
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }

  private animateReferralsList() {
    const container = this.elementRef.nativeElement;
    const referralItems = container.querySelectorAll('.referral-item');

    if (referralItems.length) {
      this.animationService.staggerIn(referralItems, {
        stagger: 0.1,
        direction: 'left',
        distance: 30
      });
    }
  }

  // Onboarding methods
  checkOnboardingStatus() {
    const completed = localStorage.getItem(REFERRAL_ONBOARDING_KEY);
    this.showOnboarding = !completed;
  }

  nextOnboardingStep() {
    this.animateOnboardingStepChange('next');

    setTimeout(() => {
      if (this.onboardingStep === 'benefit1') {
        this.onboardingStep = 'benefit2';
      } else if (this.onboardingStep === 'benefit2') {
        this.onboardingStep = 'benefit3';
      } else {
        this.completeOnboarding();
        return;
      }

      setTimeout(() => this.animateOnboardingContent(), 50);
    }, 250);
  }

  previousOnboardingStep() {
    this.animateOnboardingStepChange('prev');

    setTimeout(() => {
      if (this.onboardingStep === 'benefit3') {
        this.onboardingStep = 'benefit2';
      } else if (this.onboardingStep === 'benefit2') {
        this.onboardingStep = 'benefit1';
      }

      setTimeout(() => this.animateOnboardingContent(), 50);
    }, 250);
  }

  private animateOnboardingStepChange(direction: 'next' | 'prev') {
    const container = this.elementRef.nativeElement;
    const content = container.querySelector('.onboarding-content');

    if (content) {
      gsap.to(content, {
        opacity: 0,
        x: direction === 'next' ? -30 : 30,
        duration: 0.25,
        ease: 'power2.in'
      });
    }
  }

  completeOnboarding() {
    localStorage.setItem(REFERRAL_ONBOARDING_KEY, 'true');

    const container = this.elementRef.nativeElement;
    const overlay = container.querySelector('.onboarding-overlay');

    if (overlay) {
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
          this.showOnboarding = false;
          this.cdr.detectChanges();
          setTimeout(() => this.animateMainContent(), 100);
        }
      });
    } else {
      this.showOnboarding = false;
      this.cdr.detectChanges();
      setTimeout(() => this.animateMainContent(), 100);
    }
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
          name: 'Maria Garcia',
          date: new Date(Date.now() - 86400000 * 7).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_2',
          name: 'Carlos Lopez',
          date: new Date(Date.now() - 86400000 * 5).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_3',
          name: 'Ana Martinez',
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          status: 'completed',
          reward: 15
        },
        {
          id: 'demo_4',
          name: 'Pedro Sanchez',
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

    // Animate refresh
    const container = this.elementRef.nativeElement;
    const refreshIcon = container.querySelector('.refresh-icon');
    if (refreshIcon) {
      gsap.to(refreshIcon, {
        rotation: 360,
        duration: 0.5,
        ease: 'power2.inOut'
      });
    }

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

        // Animate copy indicator
        const container = this.elementRef.nativeElement;
        const copyIndicator = container.querySelector('.copy-indicator');
        if (copyIndicator) {
          this.animationService.pulse(copyIndicator as HTMLElement, { scale: 1.1, repeat: 1 });
        }

        setTimeout(() => {
          this.codeCopied = false;
        }, 2000);
      }
    });
  }

  toggleShareOptions() {
    this.showShareOptions = !this.showShareOptions;

    if (this.showShareOptions) {
      setTimeout(() => {
        const container = this.elementRef.nativeElement;
        const dropdown = container.querySelector('.share-dropdown');
        if (dropdown) {
          this.animationService.slideIn(dropdown as HTMLElement, 'down', { duration: 0.3, distance: 10 });
        }
      }, 50);
    }
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
    const subject = 'Obtene $11 de descuento en tus taxes con JAI1!';
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
