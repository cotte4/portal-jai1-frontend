import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError, of, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RegisterResponse,
  RefreshTokenRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private storage = inject(StorageService);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private apiUrl = environment.apiUrl;
  private initialized = false;

  constructor() {
    // Load user from storage on init
    const user = this.storage.getUser<User>();
    if (user) {
      this.currentUserSubject.next(user);
    }
  }

  /**
   * Initialize auth state - check if tokens need refresh
   * Call this on app startup
   */
  async initializeAuth(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const accessToken = this.storage.getAccessToken();
    const refreshToken = this.storage.getRefreshToken();

    if (!accessToken || !refreshToken) {
      return;
    }

    // Check if access token is expired or about to expire (within 1 minute)
    if (this.isTokenExpired(accessToken, 60)) {
      console.log('Access token expired, attempting refresh...');
      try {
        await firstValueFrom(this.refreshToken());
        console.log('Token refreshed successfully');
      } catch (error) {
        console.log('Token refresh failed, redirecting to login');
        this.clearSession(); // This clears auth AND redirects to login
      }
    }
  }

  /**
   * Check if JWT token is expired
   * @param token JWT token string
   * @param bufferSeconds Seconds before actual expiry to consider it expired
   */
  private isTokenExpired(token: string, bufferSeconds: number = 0): boolean {
    // Validate token is a non-empty string
    if (!token || typeof token !== 'string') {
      return true;
    }

    // Validate JWT structure (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    try {
      const payload = JSON.parse(atob(parts[1]));

      // Validate exp claim exists and is a number
      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return true; // No valid exp claim, consider expired for safety
      }

      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= (exp - bufferSeconds * 1000);
    } catch {
      return true; // If we can't parse, consider it expired
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.storage.isAuthenticated();
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === UserRole.ADMIN;
  }

  get isClient(): boolean {
    return this.currentUser?.role === UserRole.CLIENT;
  }

  /**
   * Update current user data after profile changes
   * This properly triggers the BehaviorSubject and persists to storage
   */
  updateCurrentUser(updates: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      this.storage.setUser(updatedUser);
      this.currentUserSubject.next(updatedUser);
    }
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    // Convert to snake_case for API
    const apiData: any = {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
    };

    // Only include referral_code if provided
    if (data.referralCode) {
      apiData.referral_code = data.referralCode;
    }
    // Log without sensitive data (password redacted)
    console.log('[AuthService] register - Making API call');

    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, apiData).pipe(
      tap((response) => {
        console.log('[AuthService] register - Response received, requires verification:', response.requiresVerification);
        // Don't call handleAuthResponse - no tokens returned, user must verify email
      }),
      catchError((error) => {
        console.log('[AuthService] register - Error');
        return this.handleError(error);
      })
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    console.log('[AuthService] login - rememberMe:', data.rememberMe);
    // Set rememberMe BEFORE the response comes back so storage knows where to save
    this.storage.setRememberMe(data.rememberMe || false);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, data).pipe(
      tap((response) => {
        console.log('[AuthService] login - response received, calling handleAuthResponse');
        this.handleAuthResponse(response);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  logout(): Observable<void> {
    // Send the refresh token so the server can revoke this specific session
    const refreshToken = this.storage.getRefreshToken();
    const body = refreshToken ? { refresh_token: refreshToken } : {};

    return this.http.post<void>(`${this.apiUrl}/auth/logout`, body).pipe(
      tap(() => this.clearSession()),
      catchError((err) => {
        // Clear session even if API call fails
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.storage.getRefreshToken();
    console.log('[AuthService] refreshToken - hasRefreshToken:', !!refreshToken);

    if (!refreshToken) {
      console.log('[AuthService] refreshToken - No refresh token available');
      return throwError(() => new Error('No refresh token available'));
    }

    // Backend expects snake_case: refresh_token
    const request = { refresh_token: refreshToken };
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, request).pipe(
      tap((response) => {
        console.log('[AuthService] refreshToken - Success, updating tokens');
        this.handleAuthResponse(response);
      }),
      catchError((err) => {
        console.log('[AuthService] refreshToken - Failed:', err);
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    // Note: Don't log the email - it's PII
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email })
      .pipe(
        catchError((error) => this.handleError(error))
      );
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, {
        token,
        new_password: newPassword,
      })
      .pipe(catchError(this.handleError));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .pipe(
        tap(() => {
          // Password changed - clear session since all tokens are invalidated
          this.clearSession();
        }),
        catchError(this.handleError)
      );
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http
      .get<{ message: string }>(`${this.apiUrl}/auth/verify-email/${token}`)
      .pipe(catchError(this.handleError));
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/resend-verification`, { email })
      .pipe(catchError(this.handleError));
  }

  private handleAuthResponse(response: any): void {
    // Guard against invalid response
    if (!response) {
      console.error('[AuthService] handleAuthResponse called with invalid response');
      return;
    }

    // Handle snake_case from API
    const accessToken = response.accessToken || response.access_token;
    const refreshToken = response.refreshToken || response.refresh_token;
    const user = this.mapUserFromApi(response.user);

    // CRITICAL: Validate tokens exist before storing
    // Storing undefined/null tokens would break isAuthenticated() checks
    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
      console.error('[AuthService] Invalid or missing access token in response');
      this.clearSession();
      return;
    }

    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      console.error('[AuthService] Invalid or missing refresh token in response');
      this.clearSession();
      return;
    }

    // If user mapping failed, clear session and redirect to login
    if (!user) {
      console.error('[AuthService] Failed to map user from auth response');
      this.clearSession();
      return;
    }

    this.storage.setAccessToken(accessToken);
    this.storage.setRefreshToken(refreshToken);
    this.storage.setUser(user);
    this.currentUserSubject.next(user);

    console.log('[AuthService] handleAuthResponse - auth data stored successfully');
  }

  /**
   * Exchange Google OAuth authorization code for tokens
   * This is the secure way to complete OAuth - code is exchanged via POST, not URL params
   */
  exchangeGoogleCode(code: string): Observable<AuthResponse> {
    console.log('[AuthService] exchangeGoogleCode - exchanging code for tokens');
    // Default to rememberMe=true for Google OAuth (no checkbox shown)
    this.storage.setRememberMe(true);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/google/exchange`, { code }).pipe(
      tap((response) => {
        console.log('[AuthService] exchangeGoogleCode - success, handling response');
        this.handleAuthResponse(response);
      }),
      catchError((error) => {
        console.error('[AuthService] exchangeGoogleCode - failed:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Handle Google OAuth callback - stores tokens and updates user state
   * Google OAuth defaults to rememberMe=true since no checkbox is shown
   * @deprecated Use exchangeGoogleCode instead for secure OAuth flow
   */
  handleGoogleAuth(response: { access_token: string; refresh_token: string; user: any }): void {
    // Default to rememberMe=true for Google OAuth (no checkbox shown)
    this.storage.setRememberMe(true);

    // Validate tokens before storing (same validation as handleAuthResponse)
    if (!response.access_token || typeof response.access_token !== 'string' || response.access_token.trim() === '') {
      console.error('[AuthService] handleGoogleAuth - Invalid access token');
      this.clearSession();
      return;
    }

    if (!response.refresh_token || typeof response.refresh_token !== 'string' || response.refresh_token.trim() === '') {
      console.error('[AuthService] handleGoogleAuth - Invalid refresh token');
      this.clearSession();
      return;
    }

    const user = this.mapUserFromApi(response.user);
    if (!user) {
      console.error('[AuthService] handleGoogleAuth - Failed to map user');
      this.clearSession();
      return;
    }

    this.storage.setAccessToken(response.access_token);
    this.storage.setRefreshToken(response.refresh_token);
    this.storage.setUser(user);
    this.currentUserSubject.next(user);
  }

  private mapUserFromApi(apiUser: any): User | null {
    // Guard against undefined or null user data
    if (!apiUser || typeof apiUser !== 'object') {
      console.error('mapUserFromApi called with invalid user data:', apiUser);
      return null;
    }

    return {
      id: apiUser.id,
      email: apiUser.email,
      role: apiUser.role,
      firstName: apiUser.firstName || apiUser.first_name,
      lastName: apiUser.lastName || apiUser.last_name,
      phone: apiUser.phone,
      profilePictureUrl: apiUser.profilePictureUrl || apiUser.profile_picture_url,
      isActive: apiUser.isActive ?? apiUser.is_active ?? true,
      lastLoginAt: apiUser.lastLoginAt || apiUser.last_login_at,
      createdAt: apiUser.createdAt || apiUser.created_at,
      updatedAt: apiUser.updatedAt || apiUser.updated_at,
    };
  }

  private clearSession(): void {
    this.storage.clearAuth();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private handleError(error: any): Observable<never> {
    console.error('Auth error:', error);
    return throwError(() => error);
  }
}
