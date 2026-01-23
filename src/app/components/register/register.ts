import { Component, inject, ChangeDetectorRef, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { environment } from '../../../environments/environment';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-register',
  imports: [FormsModule, CommonModule, HoverScaleDirective],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  @ViewChild('brandContent') brandContent!: ElementRef<HTMLElement>;
  @ViewChild('formWrapper') formWrapper!: ElementRef<HTMLElement>;

  // Form data
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  agreeToTerms: boolean = false;

  errorMessage: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;

  // Modal state
  showTermsModal: boolean = false;
  showPrivacyModal: boolean = false;

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

      // Animate feature items with stagger
      const features = this.brandContent.nativeElement.querySelectorAll('.feature-item');
      if (features.length > 0) {
        this.animationService.staggerIn(features, {
          direction: 'left',
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

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    // Validation
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      this.shakeError();
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Por favor ingresa un email valido';
      this.shakeError();
      return;
    }

    // Password length validation (backend requires 8 characters)
    if (this.password.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      this.shakeError();
      return;
    }

    // Password match validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
      this.shakeError();
      return;
    }

    // Terms agreement validation
    if (!this.agreeToTerms) {
      this.errorMessage = 'Debes aceptar los terminos y condiciones';
      this.shakeError();
      return;
    }

    this.isLoading = true;
    console.log('Starting registration...');

    this.authService.register({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || undefined
    }).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.isLoading = false;
        this.successMessage = 'Registro exitoso! Redirigiendo...';
        this.cdr.detectChanges();

        // Animate success message
        const successEl = this.elementRef.nativeElement.querySelector('.success-alert');
        if (successEl) {
          this.animationService.slideIn(successEl, 'down', { duration: 0.3 });
        }

        // Redirect to tax form (F2) after registration
        setTimeout(() => {
          this.router.navigate(['/tax-form']);
        }, 1500);
      },
      error: (error) => {
        console.log('Registration error:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Error al registrar. Intenta nuevamente.';
        this.shakeError();
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('Registration observable completed');
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

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  openTermsModal(event: Event) {
    event.preventDefault();
    this.showTermsModal = true;
    setTimeout(() => this.animateModalIn());
  }

  openPrivacyModal(event: Event) {
    event.preventDefault();
    this.showPrivacyModal = true;
    setTimeout(() => this.animateModalIn());
  }

  private animateModalIn() {
    const overlay = this.elementRef.nativeElement.querySelector('.modal-overlay');
    const content = this.elementRef.nativeElement.querySelector('.modal-content');
    if (overlay && content) {
      this.animationService.modalIn(overlay, content);
    }
  }

  closeModal() {
    const overlay = this.elementRef.nativeElement.querySelector('.modal-overlay');
    const content = this.elementRef.nativeElement.querySelector('.modal-content');
    if (overlay && content) {
      this.animationService.modalOut(overlay, content, {
        onComplete: () => {
          this.showTermsModal = false;
          this.showPrivacyModal = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.showTermsModal = false;
      this.showPrivacyModal = false;
    }
  }

  registerWithGoogle() {
    // Redirect to backend Google OAuth endpoint
    // The backend handles both login and registration automatically
    window.location.href = `${environment.apiUrl}/auth/google`;
  }
}
