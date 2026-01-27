import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly DARK_MODE_KEY = 'jai1_admin_dark_mode';

  // Reactive signal for dark mode state
  darkMode = signal<boolean>(this.loadDarkModePreference());

  constructor() {
    // Effect to sync dark mode changes to localStorage and document
    effect(() => {
      const isDark = this.darkMode();
      this.saveDarkModePreference(isDark);
      this.applyThemeToDocument(isDark);
    });

    // Apply initial theme
    this.applyThemeToDocument(this.darkMode());
  }

  toggleDarkMode(): void {
    this.darkMode.update(current => !current);
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);
  }

  private loadDarkModePreference(): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    try {
      const saved = localStorage.getItem(this.DARK_MODE_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  }

  private saveDarkModePreference(enabled: boolean): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.DARK_MODE_KEY, String(enabled));
      } catch {
        // Ignore storage errors
      }
    }
  }

  private applyThemeToDocument(isDark: boolean): void {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark-mode');
        document.body.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.remove('dark-mode');
      }
    }
  }
}
