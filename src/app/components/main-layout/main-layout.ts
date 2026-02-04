import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationSoundService } from '../../core/services/notification-sound.service';
import { ToastService } from '../../core/services/toast.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { Notification } from '../../core/models';
import { ToastComponent } from '../toast/toast';
import { ChatWidget } from '../chat-widget/chat-widget';
import { BottomNav } from '../../shared/components/bottom-nav/bottom-nav';
import { MobileHeader } from '../../shared/components/mobile-header/mobile-header';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, ChatWidget, BottomNav, MobileHeader],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayout implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private notificationSoundService = inject(NotificationSoundService);
  private toastService = inject(ToastService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private navTimeouts: ReturnType<typeof setTimeout>[] = [];

  userName: string = '';
  userEmail: string = '';
  userProfilePicture: string | null = null;
  sidebarOpen: boolean = false;
  showNotificationsPanel: boolean = false;
  unreadNotifications: number = 0;
  notifications: Notification[] = [];
  loadingMoreNotifications = false;
  isOnChatbotPage = false;
  isMobileView: boolean = false;

  @HostListener('window:resize')
  onResize() {
    this.checkMobileView();
  }

  private checkMobileView() {
    const wasMobile = this.isMobileView;
    this.isMobileView = window.innerWidth < 1024;
    if (wasMobile !== this.isMobileView) {
      // Close sidebar when switching to mobile
      if (this.isMobileView) {
        this.sidebarOpen = false;
      }
      this.cdr.markForCheck();
    }
  }

  ngOnInit() {
    // Check initial mobile view
    this.checkMobileView();

    // Track current route to hide widget on chatbot page
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.isOnChatbotPage = event.urlAfterRedirects.includes('/chatbot');
        this.cdr.markForCheck();
      })
    );
    // Check initial route
    this.isOnChatbotPage = this.router.url.includes('/chatbot');
    this.loadUserData();
    this.setupNotifications();
  }

  ngOnDestroy() {
    this.notificationService.stopPolling();
    this.subscriptions.unsubscribe();
    this.navTimeouts.forEach(t => clearTimeout(t));
    this.navTimeouts = [];
  }

  private setupNotifications() {
    // Subscribe to notifications observable
    this.subscriptions.add(
      this.notificationService.notifications$.subscribe((notifications) => {
        this.notifications = notifications;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to unread count
    this.subscriptions.add(
      this.notificationService.unreadCount$.subscribe((count) => {
        this.unreadNotifications = count;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to new notifications for toast alerts and sound
    this.subscriptions.add(
      this.notificationService.newNotification$.subscribe((newNotifications) => {
        if (newNotifications.length > 0) {
          // Play notification sound once for all new notifications
          this.notificationSoundService.playNotificationSound();

          // Show toast for each notification
          newNotifications.forEach((notification) => {
            this.toastService.notification(
              notification.message,
              notification.title
            );
          });
        }
      })
    );

    // Start polling every 30 seconds
    this.notificationService.startPolling(30000);
  }

  get userInitials(): string {
    if (this.userName) {
      const parts = this.userName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return this.userName.substring(0, 2).toUpperCase();
    }
    return this.userEmail ? this.userEmail.substring(0, 2).toUpperCase() : 'U';
  }

  loadUserData() {
    // Initial load
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      this.userEmail = user.email;
      this.userProfilePicture = user.profilePictureUrl || null;
    }

    // Subscribe to auth changes (e.g., when profile picture is updated or user logs out)
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        if (user) {
          this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          this.userEmail = user.email;
          this.userProfilePicture = user.profilePictureUrl || null;
        } else {
          // Clear user data when logged out to prevent stale data on next login
          this.userName = '';
          this.userEmail = '';
          this.userProfilePicture = null;
        }
      })
    );
  }

  toggleNotificationsPanel() {
    this.showNotificationsPanel = !this.showNotificationsPanel;
  }

  markAsRead(notification: Notification) {
    if (notification.isRead) return;
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: () => {
        this.toastService.error('Error al marcar como leída');
      }
    });
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: () => {
        this.toastService.error('Error al marcar todas como leídas');
      }
    });
  }

  archiveNotification(event: Event, notification: Notification) {
    event.stopPropagation(); // Prevent triggering markAsRead
    this.notificationService.archiveNotification(notification.id).subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: () => {
        this.toastService.error('Error al archivar notificación');
      }
    });
  }

  archiveAllRead() {
    this.notificationService.archiveAllRead().subscribe({
      next: () => {
        this.toastService.success('Notificaciones leídas archivadas');
      },
      error: () => {
        this.toastService.error('Error al archivar notificaciones');
      }
    });
  }

  deleteNotification(event: Event, notification: Notification) {
    event.stopPropagation(); // Prevent triggering markAsRead
    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: () => {
        this.toastService.error('Error al eliminar notificación');
      }
    });
  }

  deleteAllRead() {
    this.notificationService.deleteAllRead().subscribe({
      next: () => {
        this.toastService.success('Notificaciones leídas eliminadas');
      },
      error: () => {
        this.toastService.error('Error al eliminar notificaciones');
      }
    });
  }

  loadMoreNotifications() {
    if (this.loadingMoreNotifications || !this.notificationService.hasMore) {
      return;
    }

    this.loadingMoreNotifications = true;
    this.cdr.markForCheck();

    this.notificationService.loadMoreNotifications().subscribe({
      next: () => {
        this.loadingMoreNotifications = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingMoreNotifications = false;
        this.cdr.markForCheck();
        this.toastService.error('Error al cargar más notificaciones');
      }
    });
  }

  get hasMoreNotifications(): boolean {
    return this.notificationService.hasMore;
  }

  getNotificationIcon(type: string | null | undefined, title?: string): string {
    // Match on title keywords first for contextual icons
    if (title) {
      const t = title.toLowerCase();
      if (t.includes('depositado')) return '💰';
      if (t.includes('aprobado')) return '✅';
      if (t.includes('rechazad')) return '❌';
      if (t.includes('atención')) return '🚨';
      if (t.includes('resuelto')) return '✅';
      if (t.includes('bienvenido')) return '👋';
      if (t.includes('referido') || t.includes('indicación')) return '🤝';
      if (t.includes('descuento')) return '🎁';
      if (t.includes('verificación')) return '🔍';
      if (t.includes('correo')) return '📬';
      if (t.includes('novedades')) return '📢';
      if (t.includes('procesando') || t.includes('en proceso')) return '⏳';
      if (t.includes('enviada') || t.includes('enviado')) return '📤';
      if (t.includes('documento')) return '📄';
      if (t.includes('soporte')) return '💬';
    }

    // Fallback by notification type
    if (!type) return '🔔';

    switch (type) {
      case 'status_change': return '📊';
      case 'docs_missing': return '📁';
      case 'message': return '💬';
      case 'system': return '⚙️';
      case 'problem_alert': return '⚠️';
      default: return '🔔';
    }
  }

  formatNotificationDate(dateStr: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);

    // Check for invalid date
    if (isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-AR');
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  navigateToProfile() {
    this.closeSidebar();
    this.router.navigate(['/profile']);
  }

  /**
   * Handle nav link clicks - works with routerLink for navigation
   * Triggers refresh to ensure fresh data
   */
  onNavClick(route: string) {
    this.closeSidebar();

    const currentUrl = this.router.url.split('?')[0];
    const isAlreadyOnRoute = currentUrl === route;

    if (isAlreadyOnRoute) {
      // Already on the route - routerLink won't navigate, so trigger refresh immediately
      this.dataRefreshService.triggerRefresh(route);
    } else {
      // Navigating to different route - trigger refresh after navigation completes
      this.navTimeouts.push(setTimeout(() => {
        this.dataRefreshService.triggerRefresh(route);
      }, 150));
    }
  }

  navigateWithRefresh(route: string) {
    this.closeSidebar();

    // Check if we're already on the target route
    const currentUrl = this.router.url.split('?')[0]; // Remove query params
    const isAlreadyOnRoute = currentUrl === route;

    if (isAlreadyOnRoute) {
      // Already on the route - just trigger refresh immediately
      this.dataRefreshService.triggerRefresh(route);
    } else {
      // Navigate first, then trigger refresh AFTER component is ready
      this.router.navigate([route]).then(() => {
        // Small delay to ensure component has subscribed
        this.navTimeouts.push(setTimeout(() => {
          this.dataRefreshService.triggerRefresh(route);
        }, 100));
      });
    }
  }

  logout() {
    // Reset notification state before logout
    this.notificationService.reset();

    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
