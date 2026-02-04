import { Injectable, inject, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class StandaloneService {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);

  private lastActive = Date.now();
  private initialized = false;

  get isStandalone(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return (
      ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  initialize(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;

    if (this.isStandalone) {
      this.setupLinkInterception();
      this.setupPullToRefreshPrevention();
    }

    // Session recovery applies to both standalone and Safari
    this.setupSessionRecovery();
    this.setupKeyboardFixes();
  }

  /**
   * Intercept link clicks to prevent Safari from opening external browser.
   * In standalone mode, any <a href> pointing to the same origin must use
   * client-side navigation instead of a full page load.
   */
  private setupLinkInterception(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      let node = e.target as HTMLElement | null;

      // Walk up the DOM to find the nearest <a> tag
      while (node && node.nodeName.toUpperCase() !== 'A' && node.nodeName.toUpperCase() !== 'HTML') {
        node = node.parentNode as HTMLElement | null;
      }

      if (!node || node.nodeName.toUpperCase() !== 'A') return;

      const anchor = node as HTMLAnchorElement;
      const href = anchor.href;

      if (!href) return;

      // Allow external links to open in a new tab
      if (anchor.getAttribute('target') === '_blank') return;

      // Allow non-http links (tel:, mailto:, etc.)
      if (!href.startsWith('http')) return;

      // Only intercept same-origin links
      if (new URL(href).origin !== window.location.origin) return;

      e.preventDefault();
      const path = new URL(href).pathname + new URL(href).search + new URL(href).hash;

      this.ngZone.run(() => {
        this.router.navigateByUrl(path);
      });
    }, false);
  }

  /**
   * Recover session when the app comes back from background.
   * iOS can freeze or terminate the PWA process when backgrounded.
   */
  private setupSessionRecovery(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - this.lastActive;

        // If backgrounded for more than 30 seconds, re-validate auth
        if (elapsed > 30_000) {
          this.ngZone.run(() => {
            this.authService.revalidateSession();
          });
        }
      } else {
        this.lastActive = Date.now();
      }
    });

    // Handle bfcache restores (iOS back-forward cache)
    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
      if (event.persisted) {
        this.ngZone.run(() => {
          this.authService.revalidateSession();
        });
      }
    });
  }

  /**
   * Prevent pull-to-refresh in standalone mode.
   * CSS overscroll-behavior is inconsistent on older iOS, so we add a JS fallback.
   * Skips prevention when the touch originates inside a scrollable container
   * (modals, chat areas, etc.) so nested scrolling still works.
   */
  private setupPullToRefreshPrevention(): void {
    let startY = 0;
    let targetIsScrollable = false;

    document.addEventListener('touchstart', (e: TouchEvent) => {
      startY = e.touches[0].pageY;
      targetIsScrollable = this.isInsideScrollable(e.target as HTMLElement);
    }, { passive: true });

    document.addEventListener('touchmove', (e: TouchEvent) => {
      // Don't interfere with scrolling inside nested scrollable containers
      if (targetIsScrollable) return;

      const scrollTop = document.scrollingElement?.scrollTop ?? 0;
      const deltaY = e.touches[0].pageY - startY;

      // Only prevent when at the top of the page and pulling down
      if (scrollTop <= 0 && deltaY > 0) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  private isInsideScrollable(el: HTMLElement | null): boolean {
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  /**
   * Fix position:fixed elements when the iOS virtual keyboard opens.
   * iOS doesn't resize the viewport — it pushes content up, breaking fixed elements.
   */
  private setupKeyboardFixes(): void {
    if (!window.visualViewport) return;

    const fixedElements = () =>
      document.querySelectorAll<HTMLElement>('.mobile-header, .bottom-nav, .fixed-bottom');

    window.visualViewport.addEventListener('resize', () => {
      const vv = window.visualViewport!;
      const keyboardOpen = vv.height < window.innerHeight * 0.75;

      fixedElements().forEach((el) => {
        if (keyboardOpen) {
          el.style.position = 'absolute';
        } else {
          el.style.position = '';
        }
      });
    });

    // Reset on blur (keyboard dismiss)
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        fixedElements().forEach((el) => {
          el.style.position = '';
        });
        // Force scroll correction for iOS bug
        window.scrollTo(0, window.scrollY);
      }, 100);
    });
  }
}
