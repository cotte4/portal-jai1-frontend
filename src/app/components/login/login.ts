import { Component, inject, OnInit, OnDestroy, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { UserRole } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private storage = inject(StorageService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;
  rememberMe: boolean = false;
  isLoading: boolean = false;

  // Splash Screen
  showSplash = true;
  splashFading = false;

  // Intro Screen
  showIntro = !this.storage.isIntroSeen();
  animateSlide = false;
  currentSlide = 0;
  slides = [
    {
      heading: 'Declará, despreocupate, disfrutá.',
      subheading: 'La plataforma que simplifica tu tax return de principio a fin.',
      image: '',
      isLogo: true
    },
    {
      heading: 'Declará',
      subheading: 'Completá tu declaración en minutos desde tu celular. Sin papeles, sin complicaciones.',
      image: 'assets/images/Declara.png',
      isLogo: false
    },
    {
      heading: 'Despreocupate',
      subheading: 'Seguimiento en tiempo real. Conocé el estado de tu reembolso en cada paso.',
      image: 'assets/images/Despreocupate.png',
      isLogo: false
    },
    {
      heading: 'Disfrutá',
      subheading: 'Recibí tu reembolso de forma rápida y segura. Tu dinero, de vuelta.',
      image: 'assets/images/Disfruta.png',
      isLogo: false
    }
  ];
  private autoAdvanceTimer: ReturnType<typeof setInterval> | null = null;
  private touchStartX = 0;
  private touchStartY = 0;

  // PWA Install
  showInstallButton: boolean = false;
  private deferredPrompt: any = null;
  private beforeInstallHandler: ((e: Event) => void) | null = null;
  private appInstalledHandler: (() => void) | null = null;

  private readonly REMEMBER_EMAIL_KEY = 'jai1_remembered_email';

  ngOnInit() {
    // Load remembered email if exists
    const rememberedEmail = localStorage.getItem(this.REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      this.email = rememberedEmail;
      this.rememberMe = true;
    }

    // Check for Google auth error (auto-cleanup on destroy)
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      if (params['error'] === 'google_no_account') {
        this.errorMessage = 'No encontramos una cuenta con este email. Por favor, registrate primero o iniciá sesión con otro método.';
        this.cdr.detectChanges();
      } else if (params['error'] === 'google_auth_failed') {
        this.errorMessage = 'Error al iniciar sesion con Google. Intenta nuevamente.';
        this.cdr.detectChanges();
      }
    });

    // PWA Install prompt - listen for beforeinstallprompt event
    this.setupInstallPrompt();

    // Start auto-advance only if intro carousel is showing
    if (this.showIntro) {
      this.startAutoAdvance();
    }

    // Splash screen: fade out after 2s, remove after fade animation
    setTimeout(() => {
      this.splashFading = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.showSplash = false;
        this.cdr.markForCheck();
      }, 600);
    }, 2000);
  }

  private setupInstallPrompt() {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.showInstallButton = false;
      return;
    }

    // Check if iOS Safari (needs different handling)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      // iOS Safari doesn't support beforeinstallprompt, show button anyway
      // It will show instructions on how to add to home screen
      this.showInstallButton = true;
      this.cdr.detectChanges();
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    this.beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
      this.cdr.detectChanges();
    };
    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    // Hide button if app gets installed
    this.appInstalledHandler = () => {
      this.showInstallButton = false;
      this.deferredPrompt = null;
      this.cdr.detectChanges();
    };
    window.addEventListener('appinstalled', this.appInstalledHandler);
  }

  ngOnDestroy() {
    this.stopAutoAdvance();
    // Remove window event listeners to prevent memory leaks
    if (this.beforeInstallHandler) {
      window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
      this.beforeInstallHandler = null;
    }
    if (this.appInstalledHandler) {
      window.removeEventListener('appinstalled', this.appInstalledHandler);
      this.appInstalledHandler = null;
    }
  }

  // --- Intro Carousel ---

  goToSlide(index: number) {
    this.currentSlide = index;
    this.cdr.markForCheck();
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    this.cdr.markForCheck();
  }

  prevSlide() {
    this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
    this.cdr.markForCheck();
  }

  enterLogin() {
    this.animateSlide = true;
    this.storage.setIntroSeen();
    this.showIntro = false;
    this.stopAutoAdvance();
    this.cdr.markForCheck();
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].clientX;
    this.touchStartY = event.changedTouches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    const deltaY = event.changedTouches[0].clientY - this.touchStartY;
    // Only swipe if horizontal movement > vertical and exceeds threshold
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
      this.restartAutoAdvance();
    }
  }

  private startAutoAdvance() {
    this.autoAdvanceTimer = setInterval(() => {
      if (this.showIntro) {
        this.nextSlide();
      }
    }, 4000);
  }

  private stopAutoAdvance() {
    if (this.autoAdvanceTimer) {
      clearInterval(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  private restartAutoAdvance() {
    this.stopAutoAdvance();
    this.startAutoAdvance();
  }

  // --- Login ---

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;

    this.authService.login({ email: this.email, password: this.password, rememberMe: this.rememberMe }).subscribe({
      next: (response) => {
        // Block admin users from client login - they must use admin login page
        if (response.user.role === UserRole.ADMIN) {
          this.authService.logout().subscribe();
          this.isLoading = false;
          this.errorMessage = 'Los administradores deben usar el panel de admin. Ir a /admin-login';
          return;
        }

        this.isLoading = false;

        // Save or remove remembered email based on checkbox
        if (this.rememberMe) {
          localStorage.setItem(this.REMEMBER_EMAIL_KEY, this.email);
        } else {
          localStorage.removeItem(this.REMEMBER_EMAIL_KEY);
        }

        // Clear caches to ensure fresh data on login
        localStorage.removeItem('jai1_dashboard_cache');
        localStorage.removeItem('jai1_cached_profile');
        localStorage.removeItem('jai1_calculator_result'); // Clear old calculator data

        // Check if user should skip onboarding:
        // 1. hasProfile from backend = user has completed tax form (profileComplete = true)
        // 2. local onboarding flag = user has been through onboarding before (even without completing tax form)
        // If EITHER is true, skip onboarding - they're not a first-time user
        const hasProfile = (response as any).hasProfile ?? (response as any).has_profile;
        const hasCompletedOnboarding = this.storage.isOnboardingCompleted();

        if (hasProfile || hasCompletedOnboarding) {
          // Existing user - go to dashboard
          this.router.navigate(['/dashboard']);
        } else {
          // First time user - show onboarding
          this.router.navigate(['/onboarding']);
        }
      },
      error: (error) => {
        this.isLoading = false;

        // Check for EMAIL_NOT_VERIFIED error
        const errorCode = error?.error?.error || error?.error?.code || '';
        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          // Store email and redirect to verification page
          sessionStorage.setItem('pendingVerificationEmail', this.email);
          this.router.navigate(['/verify-email-sent']);
          return;
        }

        // Map common error messages to Spanish
        // Use error.error?.message for NestJS HttpErrorResponse structure
        const message = error.error?.message || error.message || '';
        if (message.includes('Invalid credentials') || message.includes('credentials')) {
          this.errorMessage = 'Email o contraseña incorrectos';
        } else if (message.includes('deactivated')) {
          this.errorMessage = 'Tu cuenta ha sido desactivada';
        } else if (message.includes('Session expired')) {
          this.errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        } else {
          this.errorMessage = message || 'Credenciales inválidas';
        }
        this.cdr.detectChanges();
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  loginWithGoogle() {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  async installApp() {
    // Check if iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      // Show iOS instructions alert
      alert('Para instalar la app:\n\n1. Tocá el botón Compartir (📤) abajo\n2. Seleccioná "Agregar a inicio"\n3. Tocá "Agregar"\n\n¡Listo! La app aparecerá en tu pantalla de inicio.');
      return;
    }

    // Use the deferred prompt for Chrome/Edge/etc.
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showInstallButton = false;
      }
      this.deferredPrompt = null;
      this.cdr.detectChanges();
    }
  }
}
