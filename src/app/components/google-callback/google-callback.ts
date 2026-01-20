import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { environment } from '../../../environments/environment';

interface GoogleExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: string;
    hasProfile: boolean;
  };
}

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
  private http = inject(HttpClient);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const error = params['error'];

      if (error) {
        this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        return;
      }

      if (code) {
        this.exchangeCodeForTokens(code);
        return;
      }

      // No valid params - redirect to login
      this.router.navigate(['/login']);
    });
  }

  private exchangeCodeForTokens(code: string): void {
    this.http.post<GoogleExchangeResponse>(`${environment.apiUrl}/auth/google/exchange`, { code })
      .subscribe({
        next: (response) => {
          // Clear caches to ensure fresh data on login
          localStorage.removeItem('jai1_dashboard_cache');
          localStorage.removeItem('jai1_cached_profile');
          localStorage.removeItem('jai1_calculator_result');

          // Store tokens (Google OAuth defaults to remember)
          localStorage.setItem('access_token', response.access_token);
          localStorage.setItem('refresh_token', response.refresh_token);

          // Store user data via auth service
          this.authService.handleGoogleAuthCallback(response.user, response.user.hasProfile);

          const user = this.authService.currentUser;

          // Redirect based on role and profile status
          if (user?.role === UserRole.ADMIN) {
            this.router.navigate(['/admin/dashboard']);
          } else if (response.user.hasProfile) {
            this.router.navigate(['/dashboard']);
          } else {
            this.router.navigate(['/onboarding']);
          }
        },
        error: () => {
          this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        }
      });
  }
}
