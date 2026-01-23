import { Component, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { UserRole } from '../../core/models';
import { environment } from '../../../environments/environment';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule, HoverScaleDirective],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  @ViewChild('brandContent') brandContent!: ElementRef<HTMLElement>;
  @ViewChild('formWrapper') formWrapper!: ElementRef<HTMLElement>;
  @ViewChild('errorAlert') errorAlert!: ElementRef<HTMLElement>;

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;
  rememberMe: boolean = false;
  isLoading: boolean = false;

  ngOnInit() {
    // Check for Google auth error
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'google_auth_failed') {
        this.errorMessage = 'Error al iniciar sesion con Google. Intenta nuevamente.';
      }
    });
  }

  ngAfterViewInit() {
    this.initAnimations();
  }

  ngOnDestroy() {
    this.animationService.killAnimations();
  }

  private initAnimations() {
    // Animate brand content
    if (this.brandContent?.nativeElement) {
      this.animationService.slideIn(this.brandContent.nativeElement, 'up', {
        duration: 0.6,
        distance: 30
      });

      // Animate decorations with floating effect
      const decorations = this.brandContent.nativeElement.parentElement?.querySelectorAll('.decoration');
      decorations?.forEach((dec, i) => {
        this.animationService.float(dec as HTMLElement, {
          distance: 15 + (i * 5),
          duration: 6 + (i * 2)
        });
      });

      // Animate pills with stagger
      const pills = this.brandContent.nativeElement.querySelectorAll('.pill');
      if (pills.length > 0) {
        this.animationService.staggerIn(pills, {
          direction: 'up',
          delay: 0.3,
          stagger: 0.08
        });
      }
    }

    // Animate form wrapper
    if (this.formWrapper?.nativeElement) {
      this.animationService.fadeIn(this.formWrapper.nativeElement, {
        duration: 0.5,
        delay: 0.2
      });
    }
  }

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      this.shakeError();
      return;
    }

    this.isLoading = true;

    this.authService.login({ email: this.email, password: this.password, rememberMe: this.rememberMe }).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Redirect based on role
        if (response.user.role === UserRole.ADMIN) {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Credenciales invalidas';
        this.shakeError();
      }
    });
  }

  private shakeError() {
    setTimeout(() => {
      const errorEl = this.elementRef.nativeElement.querySelector('.error-alert');
      if (errorEl) {
        this.animationService.validationShake(errorEl);
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
}
