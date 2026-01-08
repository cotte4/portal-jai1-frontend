import { Injectable } from '@angular/core';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';
const REMEMBER_ME_KEY = 'remember_me';
const ONBOARDING_KEY = 'onboarding_completed';
const DASHBOARD_CACHE_KEY = 'jai1_dashboard_cache';
const PROFILE_CACHE_KEY = 'jai1_cached_profile';

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
    console.log('[StorageService] Setting rememberMe:', rememberMe);
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
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    const localToken = localStorage.getItem(TOKEN_KEY);
    const token = sessionToken || localToken;
    console.log('[StorageService] getAccessToken - found in:', sessionToken ? 'sessionStorage' : (localToken ? 'localStorage' : 'none'));
    return token;
  }

  setAccessToken(token: string): void {
    const storage = this.getStorage();
    console.log('[StorageService] setAccessToken - using:', storage === localStorage ? 'localStorage' : 'sessionStorage');
    storage.setItem(TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    // Check both storages
    const sessionToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const localToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const token = sessionToken || localToken;
    console.log('[StorageService] getRefreshToken - found in:', sessionToken ? 'sessionStorage' : (localToken ? 'localStorage' : 'none'));
    return token;
  }

  setRefreshToken(token: string): void {
    const storage = this.getStorage();
    console.log('[StorageService] setRefreshToken - using:', storage === localStorage ? 'localStorage' : 'sessionStorage');
    storage.setItem(REFRESH_TOKEN_KEY, token);
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
    const storage = this.getStorage();
    console.log('[StorageService] setUser - using:', storage === localStorage ? 'localStorage' : 'sessionStorage');
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearAuth(): void {
    console.log('[StorageService] clearAuth - clearing both storages');
    // Clear from both storages to ensure complete logout
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);

    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
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
