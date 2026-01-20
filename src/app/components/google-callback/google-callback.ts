import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-google-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="spinner"></div>
      <p>Iniciando sesion con Google...</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      color: #1D345D;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #1D345D;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class GoogleCallback implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];
      const userParam = params['user'];
      const hasProfileParam = params['hasProfile'];
      const error = params['error'];

      if (error) {
        this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        return;
      }

      if (accessToken && refreshToken && userParam) {
        try {
          const userData = JSON.parse(userParam);
          const hasProfile = hasProfileParam === 'true';

          // Clear caches to ensure fresh data on login
          localStorage.removeItem('jai1_dashboard_cache');
          localStorage.removeItem('jai1_cached_profile');
          localStorage.removeItem('jai1_calculator_result');

          // Store tokens and user data
          this.authService.handleGoogleAuthCallback(userData, hasProfile);

          // Also store the tokens (handleGoogleAuthCallback only stores user)
          const storage = localStorage; // Google OAuth defaults to remember
          storage.setItem('access_token', accessToken);
          storage.setItem('refresh_token', refreshToken);

          const user = this.authService.currentUser;

          // Redirect based on role and profile status
          if (user?.role === UserRole.ADMIN) {
            this.router.navigate(['/admin/dashboard']);
          } else if (hasProfile) {
            this.router.navigate(['/dashboard']);
          } else {
            this.router.navigate(['/onboarding']);
          }
        } catch {
          this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        }
        return;
      }

      // No valid params - redirect to login
      this.router.navigate(['/login']);
    });
  }
}
