import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

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

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;

    console.log('[Login] Attempting login with rememberMe:', this.rememberMe);

    this.authService.login({ email: this.email, password: this.password, rememberMe: this.rememberMe }).subscribe({
      next: (response) => {
        console.log('[Login] Login successful, tokens received:', {
          hasAccessToken: !!response.accessToken,
          hasRefreshToken: !!response.refreshToken,
          rememberMe: this.rememberMe
        });
        this.isLoading = false;

        // Clear dashboard cache to ensure fresh data on login
        localStorage.removeItem('jai1_dashboard_cache');

        // Redirect based on role
        if (response.user.role === UserRole.ADMIN) {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        console.log('[Login] Login failed:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Credenciales invalidas';
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
