import { Injectable } from '@angular/core';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';
const ONBOARDING_KEY = 'onboarding_completed';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  getUser<T>(): T | null {
    const user = localStorage.getItem(USER_KEY);
    if (user) {
      try {
        return JSON.parse(user) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  setUser<T>(user: T): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Onboarding methods
  isOnboardingCompleted(): boolean {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  }

  setOnboardingCompleted(): void {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }

  clearOnboarding(): void {
    localStorage.removeItem(ONBOARDING_KEY);
  }
}
