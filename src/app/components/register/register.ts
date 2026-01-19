import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ReferralService } from '../../core/services/referral.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-register',
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private router = inject(Router);
  private authService = inject(AuthService);
  private referralService = inject(ReferralService);
  private cdr = inject(ChangeDetectorRef);

  // Form data
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  referralCode: string = '';
  agreeToTerms: boolean = false;

  errorMessage: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;

  // Referral code validation state
  referralCodeValid: boolean | null = null;
  referralCodeValidating: boolean = false;
  referrerName: string = '';

  // Modal state
  showTermsModal: boolean = false;
  showPrivacyModal: boolean = false;

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    // Validation
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Por favor ingresa un email valido';
      return;
    }

    // Password length validation (backend requires 8 characters)
    if (this.password.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      return;
    }

    // Password match validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
      return;
    }

    // Terms agreement validation
    if (!this.agreeToTerms) {
      this.errorMessage = 'Debes aceptar los terminos y condiciones';
      return;
    }

    this.isLoading = true;
    console.log('Starting registration...');

    this.authService.register({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || undefined,
      referralCode: this.referralCode || undefined
    }).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.isLoading = false;
        this.successMessage = 'Registro exitoso! Revisa tu email para verificar tu cuenta.';
        this.cdr.detectChanges();

        // Store email for verification page
        sessionStorage.setItem('pendingVerificationEmail', this.email);

        // Redirect to verify-email-sent page
        setTimeout(() => {
          this.router.navigate(['/verify-email-sent']);
        }, 1500);
      },
      error: (error) => {
        console.log('Registration error:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Error al registrar. Intenta nuevamente.';
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('Registration observable completed');
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

  validateReferralCode() {
    if (!this.referralCode || this.referralCode.length < 4) {
      this.referralCodeValid = null;
      this.referrerName = '';
      return;
    }

    this.referralCodeValidating = true;
    this.referralService.validateCode(this.referralCode).subscribe({
      next: (result) => {
        this.referralCodeValidating = false;
        this.referralCodeValid = result.valid;
        this.referrerName = result.referrerName || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.referralCodeValidating = false;
        this.referralCodeValid = false;
        this.referrerName = '';
        this.cdr.detectChanges();
      }
    });
  }

  clearReferralCode() {
    this.referralCode = '';
    this.referralCodeValid = null;
    this.referrerName = '';
  }

  openTermsModal(event: Event) {
    event.preventDefault();
    this.showTermsModal = true;
  }

  openPrivacyModal(event: Event) {
    event.preventDefault();
    this.showPrivacyModal = true;
  }

  closeModal() {
    this.showTermsModal = false;
    this.showPrivacyModal = false;
  }

  registerWithGoogle() {
    // Redirect to backend Google OAuth endpoint
    // The backend handles both login and registration automatically
    window.location.href = `${environment.apiUrl}/auth/google`;
  }
}
