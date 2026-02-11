import { Injectable } from '@angular/core';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';
const REMEMBER_ME_KEY = 'remember_me';
const ONBOARDING_KEY = 'onboarding_completed';
const DASHBOARD_CACHE_KEY = 'jai1_dashboard_cache';
const PROFILE_CACHE_KEY = 'jai1_cached_profile';
const CALCULATOR_RESULT_KEY = 'jai1_calculator_result';
const INTRO_SEEN_KEY = 'jai1_intro_seen';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * Get the appropriate storage based on rememberMe preference.
   * - localStorage: persists across browser sessions (rememberMe = true)
   * - sessionStorage: cleared when browser/tab closes (rememberMe = false)
   */
  private getStorage(): Storage {
    // Check if rememberMe was set (stored in localStorage so it persists)
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    return rememberMe ? localStorage : sessionStorage;
  }

  /**
   * Set the rememberMe preference - must be called BEFORE setting tokens
   */
  setRememberMe(rememberMe: boolean): void {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
  }

  /**
   * Check if rememberMe is enabled
   */
  isRememberMeEnabled(): boolean {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  }

  getAccessToken(): string | null {
    // Check both storages - sessionStorage first (current session), then localStorage (remembered)
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    this.getStorage().setItem(TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    // Check both storages
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    this.getStorage().setItem(REFRESH_TOKEN_KEY, token);
  }

  getUser<T>(): T | null {
    // Check both storages
    const sessionUser = sessionStorage.getItem(USER_KEY);
    const localUser = localStorage.getItem(USER_KEY);
    const user = sessionUser || localUser;
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
    this.getStorage().setItem(USER_KEY, JSON.stringify(user));
  }

  clearAuth(): void {
    // Clear from both storages to ensure complete logout
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(CALCULATOR_RESULT_KEY);
    localStorage.removeItem(ONBOARDING_KEY);

    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Onboarding methods (simple localStorage, cleared on logout)
  isOnboardingCompleted(): boolean {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  }

  setOnboardingCompleted(): void {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }

  clearOnboarding(): void {
    localStorage.removeItem(ONBOARDING_KEY);
  }

  // Intro carousel methods (persists across sessions, NOT cleared on logout)
  isIntroSeen(): boolean {
    return localStorage.getItem(INTRO_SEEN_KEY) === 'true';
  }

  setIntroSeen(): void {
    localStorage.setItem(INTRO_SEEN_KEY, 'true');
  }
}
