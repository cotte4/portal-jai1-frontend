import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast';
import { StandaloneService } from './core/services/standalone.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private standaloneService = inject(StandaloneService);
  private platformId = inject(PLATFORM_ID);

  protected readonly title = signal('tax-client-portal');
  protected showSplash = signal(true);
  protected splashFading = signal(false);

  ngOnInit(): void {
    // Initialize standalone mode fixes (link interception, session recovery, etc.)
    this.standaloneService.initialize();

    // Add standalone CSS class for iOS navigator.standalone detection
    if (isPlatformBrowser(this.platformId) && this.standaloneService.isStandalone) {
      document.documentElement.classList.add('standalone-mode');
    }

    // Start fade out after 2 seconds
    setTimeout(() => {
      this.splashFading.set(true);
      // Remove splash completely after fade animation (0.6s)
      setTimeout(() => {
        this.showSplash.set(false);
      }, 600);
    }, 2000);
  }
}
