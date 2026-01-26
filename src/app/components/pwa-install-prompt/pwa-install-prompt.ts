import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pwa-install-prompt.html',
  styleUrl: './pwa-install-prompt.css'
})
export class PwaInstallPrompt implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);

  showPrompt = signal(false);
  private deferredPrompt: any = null;
  private boundHandler: ((e: Event) => void) | null = null;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check if already installed or dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (dismissed || isStandalone) return;

    // Listen for the beforeinstallprompt event
    this.boundHandler = (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      // Show after a short delay for better UX
      setTimeout(() => {
        this.showPrompt.set(true);
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', this.boundHandler);

    // For iOS Safari (doesn't support beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIOS && isSafari && !isStandalone) {
      setTimeout(() => {
        this.showPrompt.set(true);
      }, 3000);
    }
  }

  ngOnDestroy() {
    if (this.boundHandler && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('beforeinstallprompt', this.boundHandler);
    }
  }

  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showPrompt.set(false);
      }
      this.deferredPrompt = null;
    } else {
      // For iOS, show instructions
      this.showPrompt.set(false);
    }
  }

  dismiss() {
    this.showPrompt.set(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  }
}
