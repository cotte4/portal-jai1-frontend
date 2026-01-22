import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-email-sent',
  imports: [CommonModule],
  templateUrl: './verify-email-sent.html',
  styleUrl: './verify-email-sent.css'
})
export class VerifyEmailSent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  email: string = '';
  isLoading: boolean = false;
  resendSuccess: boolean = false;
  errorMessage: string = '';

  ngOnInit() {
    // Get email from sessionStorage
    this.email = sessionStorage.getItem('pendingVerificationEmail') || '';

    // If no email, redirect to login
    if (!this.email) {
      this.router.navigate(['/login']);
    }
  }

  resendVerification() {
    if (!this.email || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.resendSuccess = false;

    this.authService.resendVerification(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.resendSuccess = true;
        this.cdr.detectChanges();

        // Reset success message after 5 seconds
        setTimeout(() => {
          this.resendSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'Error al reenviar. Intenta nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  goToLogin() {
    sessionStorage.removeItem('pendingVerificationEmail');
    this.router.navigate(['/login']);
  }
}
