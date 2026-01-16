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
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
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

  register(data: RegisterRequest): Observable<AuthResponse> {
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
    console.log('[AuthService] register - Making API call to:', `${this.apiUrl}/auth/register`);
    console.log('[AuthService] register - Data:', apiData);

    // New registrations default to rememberMe=true for better UX
    this.storage.setRememberMe(true);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, apiData).pipe(
      tap((response) => {
        console.log('[AuthService] register - Response received:', response);
        this.handleAuthResponse(response);
      }),
      catchError((error) => {
        console.log('[AuthService] register - Error:', error);
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
    console.log('AuthService.forgotPassword - Calling API for:', email);
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email })
      .pipe(
        tap((response) => console.log('AuthService.forgotPassword - Response:', response)),
        catchError((error) => {
          console.log('AuthService.forgotPassword - Error:', error);
          return this.handleError(error);
        })
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

  private handleAuthResponse(response: any): void {
    // Guard against invalid response
    if (!response) {
      console.error('[AuthService] handleAuthResponse called with invalid response:', response);
      return;
    }

    // Handle snake_case from API
    const accessToken = response.accessToken || response.access_token;
    const refreshToken = response.refreshToken || response.refresh_token;
    const user = this.mapUserFromApi(response.user);

    console.log('[AuthService] handleAuthResponse - tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      rememberMeEnabled: this.storage.isRememberMeEnabled()
    });

    // If user mapping failed, clear session and redirect to login
    if (!user) {
      console.error('[AuthService] Failed to map user from auth response, clearing session');
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
    console.log('[AuthService] handleGoogleAuth - setting rememberMe to true by default');
    // Default to rememberMe=true for Google OAuth (no checkbox shown)
    this.storage.setRememberMe(true);

    const user = this.mapUserFromApi(response.user);

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
