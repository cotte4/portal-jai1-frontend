import { Component, inject, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule, HoverScaleDirective],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  @ViewChild('brandContent') brandContent!: ElementRef<HTMLElement>;
  @ViewChild('formWrapper') formWrapper!: ElementRef<HTMLElement>;

  token: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  isSubmitted: boolean = false;
  isLoading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isTokenValid: boolean = true;

  ngOnInit() {
    // Get token from URL query parameter
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.isTokenValid = false;
        this.errorMessage = 'Enlace de recuperacion invalido o expirado.';
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

  onSubmit() {
    this.errorMessage = '';

    // Validate passwords
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      this.shakeError();
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      this.shakeError();
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
      this.shakeError();
      return;
    }

    this.resetPassword();
  }

  private resetPassword(): void {
    this.isLoading = true;

    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: (response) => {
        console.log('ResetPassword - Success:', response);
        this.isLoading = false;
        this.isSubmitted = true;
        this.cdr.detectChanges();

        // Animate success state
        setTimeout(() => this.animateSuccessState());
      },
      error: (error) => {
        console.log('ResetPassword - Error:', error);
        this.isLoading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Ocurrio un error. El enlace puede haber expirado.';
        this.shakeError();
        this.cdr.detectChanges();
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

  private animateSuccessState() {
    const successContainer = this.elementRef.nativeElement.querySelector('.success-container');
    if (successContainer) {
      this.animationService.slideIn(successContainer, 'up', {
        duration: 0.5,
        distance: 20
      });
    }

    const successIcon = this.elementRef.nativeElement.querySelector('.success-icon');
    if (successIcon) {
      this.animationService.scaleIn(successIcon, {
        duration: 0.4,
        fromScale: 0
      });
    }

    const successCheckmark = this.elementRef.nativeElement.querySelector('.success-checkmark');
    if (successCheckmark) {
      this.animationService.successCheck(successCheckmark);
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}
