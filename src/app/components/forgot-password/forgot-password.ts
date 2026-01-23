import { Component, inject, ChangeDetectorRef, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, HoverScaleDirective],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  @ViewChild('brandContent') brandContent!: ElementRef<HTMLElement>;
  @ViewChild('formWrapper') formWrapper!: ElementRef<HTMLElement>;

  email: string = '';
  errorMessage: string = '';
  isSubmitted: boolean = false;
  isLoading: boolean = false;

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

    if (!this.email) {
      this.errorMessage = 'Por favor ingresa tu email';
      this.shakeError();
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor ingresa un email valido';
      this.shakeError();
      return;
    }

    this.requestPasswordReset();
  }

  private requestPasswordReset(): void {
    this.isLoading = true;
    console.log('ForgotPassword - Starting request for:', this.email);

    this.authService.forgotPassword(this.email).subscribe({
      next: (response) => {
        console.log('ForgotPassword - Success:', response);
        this.isLoading = false;
        this.isSubmitted = true;
        this.cdr.detectChanges();

        // Animate success state
        setTimeout(() => this.animateSuccessState());
      },
      error: (error) => {
        console.log('ForgotPassword - Error:', error);
        this.isLoading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Ocurrio un error. Intenta nuevamente.';
        this.shakeError();
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('ForgotPassword - Observable completed');
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

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  resendEmail() {
    this.isSubmitted = false;
    this.requestPasswordReset();
  }
}
