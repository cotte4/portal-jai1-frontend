import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RegisterResponse,
} from '../models';

/** API registration data format (snake_case) */
interface RegisterApiData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  referral_code?: string;
}

/** API user response format (can be camelCase or snake_case) */
interface ApiUserData {
  id: string;
  email: string;
  role: UserRole | string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  phone?: string;
  profilePictureUrl?: string;
  profile_picture_url?: string;
  isActive?: boolean;
  is_active?: boolean;
  hasProfile?: boolean;
  lastLoginAt?: string;
  last_login_at?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

/** API auth response format (can be camelCase or snake_case) */
interface ApiAuthResponse {
  user: ApiUserData;
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  hasProfile?: boolean;
}

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
   * Initialize auth state - check if tokens need refresh.
   * Call this on app startup. Only runs once (guarded).
   */
  async initializeAuth(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.checkAndRefreshToken();
  }

  /**
   * Re-validate the session after the app returns from background.
   * Unlike initializeAuth(), this can be called multiple times.
   */
  async revalidateSession(): Promise<void> {
    await this.checkAndRefreshToken();
  }

  private async checkAndRefreshToken(): Promise<void> {
    const accessToken = this.storage.getAccessToken();
    const refreshToken = this.storage.getRefreshToken();

    if (!accessToken || !refreshToken) {
      return;
    }

    if (this.isTokenExpired(accessToken, 60)) {
      try {
        await firstValueFrom(this.refreshToken());
      } catch {
        this.clearSession();
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

      // Validate exp claim exists and is a finite number
      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return true; // No valid exp = treat as expired for safety
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

  get isJai1gent(): boolean {
    return this.currentUser?.role === UserRole.JAI1GENT;
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
    const apiData: RegisterApiData = {
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

    // Don't call handleAuthResponse - user needs to verify email first
    // The register component will redirect to verify-email-sent page
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, apiData).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    // Set rememberMe BEFORE the response comes back so storage knows where to save
    this.storage.setRememberMe(data.rememberMe || false);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, data).pipe(
      tap((response) => this.handleAuthResponse(response)),
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

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    // Backend expects snake_case: refresh_token
    const request = { refresh_token: refreshToken };
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, request).pipe(
      tap((response) => this.handleAuthResponse(response)),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email })
      .pipe(catchError((error) => this.handleError(error)));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleAuthResponse(response: any): void {
    // Guard against invalid response
    if (!response) {
      return;
    }

    // Handle snake_case from API
    const accessToken = response.accessToken || response.access_token;
    const refreshToken = response.refreshToken || response.refresh_token;
    const user = this.mapUserFromApi(response.user);

    // CRITICAL: Validate tokens exist before storing
    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
      this.clearSession();
      return;
    }

    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      this.clearSession();
      return;
    }

    // If user mapping failed, clear session and redirect to login
    if (!user) {
      this.clearSession();
      return;
    }

    this.storage.setAccessToken(accessToken);
    this.storage.setRefreshToken(refreshToken);
    this.storage.setUser(user);
    this.currentUserSubject.next(user);
  }

  /**
   * Handle Google OAuth callback - stores tokens and updates user state
   * Google OAuth defaults to rememberMe=true since no checkbox is shown
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleGoogleAuthCallback(userData: any, _hasProfile: boolean): void {
    // Default to rememberMe=true for Google OAuth (no checkbox shown)
    this.storage.setRememberMe(true);

    const user = this.mapUserFromApi(userData);
    if (!user) {
      this.clearSession();
      return;
    }

    this.storage.setUser(user);
    this.currentUserSubject.next(user);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapUserFromApi(apiUser: any): User | null {
    // Guard against undefined or null user data
    if (!apiUser || typeof apiUser !== 'object') {
      return null;
    }

    return {
      id: apiUser.id,
      email: apiUser.email,
      role: apiUser.role as UserRole,
      firstName: apiUser.firstName || apiUser.first_name || '',
      lastName: apiUser.lastName || apiUser.last_name || '',
      phone: apiUser.phone,
      profilePictureUrl: apiUser.profilePictureUrl || apiUser.profile_picture_url,
      isActive: apiUser.isActive ?? apiUser.is_active ?? true,
      lastLoginAt: apiUser.lastLoginAt || apiUser.last_login_at,
      createdAt: apiUser.createdAt || apiUser.created_at || new Date().toISOString(),
      updatedAt: apiUser.updatedAt || apiUser.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Clear auth state without navigating.
   * Used by the auth interceptor to clean up tokens after a failed refresh
   * before it handles the redirect itself (with loop prevention).
   */
  forceLogout(): void {
    this.storage.clearAuth();
    this.currentUserSubject.next(null);
  }

  private clearSession(): void {
    this.storage.clearAuth();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
