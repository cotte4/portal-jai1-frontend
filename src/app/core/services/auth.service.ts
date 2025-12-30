import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
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

  constructor() {
    // Load user from storage on init
    const user = this.storage.getUser<User>();
    if (user) {
      this.currentUserSubject.next(user);
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

  register(data: RegisterRequest): Observable<AuthResponse> {
    // Convert to snake_case for API
    const apiData = {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
    };
    console.log('AuthService.register - Making API call to:', `${this.apiUrl}/auth/register`);
    console.log('AuthService.register - Data:', apiData);
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, apiData).pipe(
      tap((response) => {
        console.log('AuthService.register - Response received:', response);
        this.handleAuthResponse(response);
      }),
      catchError((error) => {
        console.log('AuthService.register - Error:', error);
        return this.handleError(error);
      })
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, data).pipe(
      tap((response) => this.handleAuthResponse(response)),
      catchError((error) => this.handleError(error))
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}).pipe(
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

    const request: RefreshTokenRequest = { refreshToken };
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, request).pipe(
      tap((response) => this.handleAuthResponse(response)),
      catchError((err) => {
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

  private handleAuthResponse(response: any): void {
    // Handle snake_case from API
    const accessToken = response.accessToken || response.access_token;
    const refreshToken = response.refreshToken || response.refresh_token;
    const user = this.mapUserFromApi(response.user);

    this.storage.setAccessToken(accessToken);
    this.storage.setRefreshToken(refreshToken);
    this.storage.setUser(user);
    this.currentUserSubject.next(user);
  }

  private mapUserFromApi(apiUser: any): User {
    return {
      id: apiUser.id,
      email: apiUser.email,
      role: apiUser.role,
      firstName: apiUser.firstName || apiUser.first_name,
      lastName: apiUser.lastName || apiUser.last_name,
      phone: apiUser.phone,
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
