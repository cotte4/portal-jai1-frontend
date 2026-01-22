import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationSoundService } from '../../core/services/notification-sound.service';
import { ToastService } from '../../core/services/toast.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { Notification } from '../../core/models';
import { ToastComponent } from '../toast/toast';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
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
  private chatbotScriptId = 'relevance-ai-chatbot';
  private subscriptions = new Subscription();
  private navTimeouts: ReturnType<typeof setTimeout>[] = [];

  userName: string = '';
  userEmail: string = '';
  userProfilePicture: string | null = null;
  sidebarOpen: boolean = false;
  showNotificationsPanel: boolean = false;
  unreadNotifications: number = 0;
  notifications: Notification[] = [];

  ngOnInit() {
    this.loadUserData();
    this.setupNotifications();
    this.loadChatbotScript();
  }

  ngOnDestroy() {
    this.removeChatbotScript();
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
      })
    );

    // Subscribe to unread count
    this.subscriptions.add(
      this.notificationService.unreadCount$.subscribe((count) => {
        this.unreadNotifications = count;
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

  private loadChatbotScript() {
    // Check if script already exists
    if (document.getElementById(this.chatbotScriptId)) return;

    const script = document.createElement('script');
    script.id = this.chatbotScriptId;
    script.src = 'https://app.relevanceai.com/embed/chat-bubble.js';
    script.defer = true;
    script.setAttribute('data-relevanceai-share-id', 'bcbe5a/8cba1df1b42f-4044-a926-18f8ee83d3c8/84379516-1725-42b5-a261-6bfcfeaa328c');
    script.setAttribute('data-share-styles', 'hide_tool_steps=false&hide_file_uploads=false&hide_conversation_list=false&bubble_style=agent&primary_color=%231D345D&bubble_icon=pd%2Fchat&input_placeholder_text=Escrib%C3%AD+tu+pregunta...&hide_logo=false&hide_description=false');
    document.body.appendChild(script);
  }

  private removeChatbotScript() {
    const script = document.getElementById(this.chatbotScriptId);
    if (script) {
      script.remove();
    }
    // Also remove the chatbot widget elements
    const chatWidget = document.querySelector('[data-relevanceai-chat-bubble]');
    if (chatWidget) {
      chatWidget.remove();
    }
    // Remove any iframe or chat container added by the script
    const relevanceElements = document.querySelectorAll('[id^="relevance"], [class*="relevance"]');
    relevanceElements.forEach(el => el.remove());
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

  getNotificationIcon(type: string | null | undefined): string {
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
    return date.toLocaleDateString('es-ES');
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
