import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmail implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isLoading: boolean = true;
  isVerified: boolean = false;
  errorMessage: string = '';

  // For resend form (shown on error)
  showResendForm: boolean = false;
  resendEmail: string = '';
  isResending: boolean = false;
  resendSuccess: boolean = false;
  resendError: string = '';

  ngOnInit() {
    // Get token from query params
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.verifyToken(token);
      } else {
        this.isLoading = false;
        this.errorMessage = 'Token de verificacion no encontrado';
        this.showResendForm = true;
        this.cdr.detectChanges();
      }
    });
  }

  private verifyToken(token: string) {
    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.isLoading = false;
        this.isVerified = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'El enlace de verificacion es invalido o ha expirado';
        this.showResendForm = true;
        this.cdr.detectChanges();
      }
    });
  }

  resendVerification() {
    if (!this.resendEmail || this.isResending) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.resendEmail)) {
      this.resendError = 'Por favor ingresa un email valido';
      return;
    }

    this.isResending = true;
    this.resendError = '';
    this.resendSuccess = false;

    this.authService.resendVerification(this.resendEmail).subscribe({
      next: () => {
        this.isResending = false;
        this.resendSuccess = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isResending = false;
        this.resendError = error?.message || 'Error al reenviar. Intenta nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
