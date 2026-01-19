import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private destroyRef = inject(DestroyRef);

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  showPassword: boolean = false;
  rememberMe: boolean = false;
  isLoading: boolean = false;

  private readonly REMEMBER_EMAIL_KEY = 'jai1_remembered_email';

  ngOnInit() {
    // Load remembered email if exists
    const rememberedEmail = localStorage.getItem(this.REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      this.email = rememberedEmail;
      this.rememberMe = true;
    }

    // Check for Google auth error (auto-cleanup on destroy)
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
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

        // Block admin users from client login - they must use admin login page
        if (response.user.role === UserRole.ADMIN) {
          this.authService.logout().subscribe();
          this.isLoading = false;
          this.errorMessage = 'Los administradores deben usar el panel de admin. Ir a /admin-login';
          return;
        }

        this.isLoading = false;

        // Save or remove remembered email based on checkbox
        if (this.rememberMe) {
          localStorage.setItem(this.REMEMBER_EMAIL_KEY, this.email);
        } else {
          localStorage.removeItem(this.REMEMBER_EMAIL_KEY);
        }

        // Clear caches to ensure fresh data on login
        localStorage.removeItem('jai1_dashboard_cache');
        localStorage.removeItem('jai1_cached_profile');

        // Redirect to client dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.log('[Login] Login failed:', error);
        this.isLoading = false;

        // Check for EMAIL_NOT_VERIFIED error
        const errorCode = error?.error?.error || error?.error?.code || '';
        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          // Store email and redirect to verification page
          sessionStorage.setItem('pendingVerificationEmail', this.email);
          this.router.navigate(['/verify-email-sent']);
          return;
        }

        // Map common error messages to Spanish
        const message = error.message || '';
        if (message.includes('Invalid credentials') || message.includes('credentials')) {
          this.errorMessage = 'Email o contraseña incorrectos';
        } else if (message.includes('deactivated')) {
          this.errorMessage = 'Tu cuenta ha sido desactivada';
        } else if (message.includes('Session expired')) {
          this.errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        } else {
          this.errorMessage = message || 'Credenciales inválidas';
        }
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
