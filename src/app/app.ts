import { Component, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ToastComponent } from './components/toast/toast';
import { StandaloneService } from './core/services/standalone.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private standaloneService = inject(StandaloneService);
  private swUpdate = inject(SwUpdate, { optional: true });
  private swSub?: Subscription;

  protected readonly title = signal('tax-client-portal');
  protected showSplash = signal(true);
  protected splashFading = signal(false);

  ngOnInit(): void {
    // Initialize standalone mode fixes (link interception, session recovery, etc.)
    this.standaloneService.initialize();

    // Notify user when a new version of the app is available
    if (this.swUpdate?.isEnabled) {
      this.swSub = this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        if (confirm('Hay una nueva version disponible. ¿Actualizar ahora?')) {
          document.location.reload();
        }
      });
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

  ngOnDestroy(): void {
    this.swSub?.unsubscribe();
  }
}
