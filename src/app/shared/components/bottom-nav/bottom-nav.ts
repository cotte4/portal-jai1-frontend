import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNav implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  activeRoute: string = '/dashboard';

  ngOnInit() {
    // Set initial active route
    this.activeRoute = this.router.url.split('?')[0];

    // Listen to route changes
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.activeRoute = event.urlAfterRedirects.split('?')[0];
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  isActive(route: string): boolean {
    return this.activeRoute === route;
  }

  navigate(route: string) {
    if (this.activeRoute !== route) {
      this.router.navigate([route]);
    }
  }

  navigateToUpload() {
    this.router.navigate(['/documents'], { queryParams: { upload: 'true' } });
  }
}
