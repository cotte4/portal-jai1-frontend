import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

interface RouteTitle {
  route: string;
  title: string;
  showBack: boolean;
}

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-header.html',
  styleUrl: './mobile-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileHeader implements OnInit, OnDestroy {
  private router = inject(Router);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private subscriptions = new Subscription();

  @Input() unreadNotifications: number = 0;
  @Output() notificationClick = new EventEmitter<void>();

  currentTitle: string = 'Inicio';
  showBackButton: boolean = false;
  showProfilePanel: boolean = false;

  // User info
  userName: string = '';
  userEmail: string = '';
  userInitials: string = '';
  userProfilePicture: string | null = null;

  private routeTitles: RouteTitle[] = [
    { route: '/dashboard', title: 'Inicio', showBack: false },
    { route: '/tax-form', title: 'Mi Declaracion', showBack: false },
    { route: '/documents', title: 'Mis Documentos', showBack: false },
    { route: '/tax-tracking', title: 'Seguimiento', showBack: false },
    { route: '/chatbot', title: 'Asistente IA', showBack: false },
    { route: '/messages', title: 'Soporte', showBack: true },
    { route: '/tax-calculator', title: 'Calculadora', showBack: true },
    { route: '/profile', title: 'Mi Perfil', showBack: true },
    { route: '/consent-form', title: 'Formulario de Consentimiento', showBack: true },
    { route: '/referral-program', title: 'Programa de Referidos', showBack: true },
    { route: '/leaderboard', title: 'Leaderboard', showBack: true }
  ];

  ngOnInit() {
    // Set initial title
    this.updateTitleForRoute(this.router.url);

    // Load user info
    this.loadUserInfo();

    // Listen to route changes
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.updateTitleForRoute(event.urlAfterRedirects);
        this.cdr.markForCheck();
      })
    );

    // Subscribe to user changes
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
          this.userEmail = user.email || '';
          this.userInitials = this.getInitials(user.firstName, user.lastName);
          this.userProfilePicture = user.profilePictureUrl || null;
          this.cdr.markForCheck();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private loadUserInfo() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
      this.userEmail = user.email || '';
      this.userInitials = this.getInitials(user.firstName, user.lastName);
      this.userProfilePicture = user.profilePictureUrl || null;
    }
  }

  private getInitials(firstName?: string, lastName?: string): string {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last || 'U';
  }

  private updateTitleForRoute(url: string) {
    const path = url.split('?')[0];
    const routeConfig = this.routeTitles.find(r => path.startsWith(r.route));

    if (routeConfig) {
      this.currentTitle = routeConfig.title;
      this.showBackButton = routeConfig.showBack;
    } else {
      this.currentTitle = 'JAI1';
      this.showBackButton = true;
    }
  }

  goBack() {
    this.location.back();
  }

  onNotificationClick() {
    this.notificationClick.emit();
  }

  toggleProfilePanel() {
    this.showProfilePanel = !this.showProfilePanel;
    // Prevent body scroll when panel is open
    document.body.style.overflow = this.showProfilePanel ? 'hidden' : '';
    this.cdr.markForCheck();
  }

  closeProfilePanel() {
    this.showProfilePanel = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  navigateAndClose(route: string) {
    this.closeProfilePanel();
    this.router.navigate([route]);
  }

  logout() {
    this.closeProfilePanel();
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        // Still redirect on error since session is cleared locally
        this.router.navigate(['/login']);
      }
    });
  }
}
