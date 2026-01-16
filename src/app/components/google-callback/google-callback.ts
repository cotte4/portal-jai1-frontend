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

      const code = params['code'];
      const error = params['error'];

      console.log('[GoogleCallback] Has code:', !!code);
      console.log('[GoogleCallback] Has error:', !!error);

      if (error) {
        console.error('[GoogleCallback] Error from backend:', error);
        this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
        return;
      }

      if (code) {
        console.log('[GoogleCallback] Exchanging code for tokens...');

        // Exchange the authorization code for tokens via secure POST request
        // This prevents tokens from ever appearing in URLs (security best practice)
        this.authService.exchangeGoogleCode(code).subscribe({
          next: (response) => {
            console.log('[GoogleCallback] Code exchange successful');

            // Clear caches to ensure fresh data on login
            localStorage.removeItem('jai1_dashboard_cache');
            localStorage.removeItem('jai1_cached_profile');

            // Get user from auth service (already set by exchangeGoogleCode)
            const user = this.authService.currentUser;
            console.log('[GoogleCallback] Auth handled, redirecting...');

            // Redirect based on role
            if (user?.role === UserRole.ADMIN) {
              console.log('[GoogleCallback] Redirecting to admin dashboard');
              this.router.navigate(['/admin/dashboard']);
            } else {
              console.log('[GoogleCallback] Redirecting to client dashboard');
              this.router.navigate(['/dashboard']);
            }
          },
          error: (err) => {
            console.error('[GoogleCallback] Code exchange failed:', err);
            this.router.navigate(['/login'], { queryParams: { error: 'google_auth_failed' } });
          }
        });
      } else {
        console.warn('[GoogleCallback] Missing code param, redirecting to login');
        this.router.navigate(['/login']);
      }
    });
  }
}
