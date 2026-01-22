import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  email: string = '';
  errorMessage: string = '';
  isSubmitted: boolean = false;
  isLoading: boolean = false;

  onSubmit() {
    this.errorMessage = '';

    if (!this.email) {
      this.errorMessage = 'Por favor ingresa tu email';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor ingresa un email valido';
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
      },
      error: (error) => {
        console.log('ForgotPassword - Error:', error);
        this.isLoading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Ocurrio un error. Intenta nuevamente.';
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('ForgotPassword - Observable completed');
      }
    });
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
