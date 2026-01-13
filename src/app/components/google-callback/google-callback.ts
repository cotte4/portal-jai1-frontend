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
    console.log('[GoogleCallback] Component initialized');
    console.log('[GoogleCallback] Current URL:', window.location.href);

    this.route.queryParams.subscribe(params => {
      console.log('[GoogleCallback] Query params received:', Object.keys(params));

      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];
      const userJson = params['user'];
      const error = params['error'];

      console.log('[GoogleCallback] Has access_token:', !!accessToken);
      console.log('[GoogleCallback] Has refresh_token:', !!refreshToken);
      console.log('[GoogleCallback] Has user:', !!userJson);
      console.log('[GoogleCallback] Has error:', !!error);

      if (error) {
        console.error('[GoogleCallback] Error from backend:', error);
        this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        return;
      }

      if (accessToken && refreshToken && userJson) {
        try {
          const user = JSON.parse(userJson);
          console.log('[GoogleCallback] User parsed successfully:', user.email, user.role);

          // Use AuthService to properly handle the auth response
          // This updates both storage AND the BehaviorSubject
          this.authService.handleGoogleAuth({
            access_token: accessToken,
            refresh_token: refreshToken,
            user: user
          });

          // Clear caches to ensure fresh data on login
          localStorage.removeItem('jai1_dashboard_cache');
          localStorage.removeItem('jai1_cached_profile');

          console.log('[GoogleCallback] Auth handled, redirecting...');

          // Redirect based on role
          if (user.role === UserRole.ADMIN) {
            console.log('[GoogleCallback] Redirecting to admin dashboard');
            this.router.navigate(['/admin/dashboard']);
          } else {
            console.log('[GoogleCallback] Redirecting to client dashboard');
            this.router.navigate(['/dashboard']);
          }
        } catch (e) {
          console.error('[GoogleCallback] Error parsing Google auth response:', e);
          this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        }
      } else {
        console.warn('[GoogleCallback] Missing required params, redirecting to login');
        this.router.navigate(['/login']);
      }
    });
  }
}
