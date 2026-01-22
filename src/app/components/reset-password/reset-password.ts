import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

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

  onSubmit() {
    this.errorMessage = '';

    // Validate passwords
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
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
      },
      error: (error) => {
        console.log('ResetPassword - Error:', error);
        this.isLoading = false;
        this.errorMessage = error?.error?.message || error?.message || 'Ocurrio un error. El enlace puede haber expirado.';
        this.cdr.detectChanges();
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

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}
