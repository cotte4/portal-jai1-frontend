import { Component, OnInit, OnDestroy, AfterViewInit, inject, ElementRef } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { Notification } from '../../core/models';
import { ToastComponent } from '../toast/toast';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, HoverScaleDirective],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private toastService = inject(ToastService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);
  private chatbotScriptId = 'relevance-ai-chatbot';
  private subscriptions = new Subscription();

  userName: string = '';
  userEmail: string = '';
  sidebarOpen: boolean = false;
  showNotificationsPanel: boolean = false;
  unreadNotifications: number = 0;
  notifications: Notification[] = [];

  ngOnInit() {
    this.loadUserData();
    this.setupNotifications();
    this.loadChatbotScript();
  }

  ngAfterViewInit() {
    // Initial animations for nav links
    this.animateNavLinks();
  }

  ngOnDestroy() {
    this.removeChatbotScript();
    this.notificationService.stopPolling();
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  private animateNavLinks() {
    const navLinks = this.elementRef.nativeElement.querySelectorAll('.nav-link');
    if (navLinks.length > 0) {
      this.animationService.staggerIn(navLinks, {
        direction: 'left',
        stagger: 0.05,
        delay: 0.1,
        distance: 20
      });
    }
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

    // Subscribe to new notifications for toast alerts
    this.subscriptions.add(
      this.notificationService.newNotification$.subscribe((newNotifications) => {
        newNotifications.forEach((notification) => {
          this.toastService.notification(
            notification.message,
            notification.title
          );
        });
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
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      this.userEmail = user.email;
    }
  }

  toggleNotificationsPanel() {
    this.showNotificationsPanel = !this.showNotificationsPanel;

    if (this.showNotificationsPanel) {
      // Animate panel and items
      setTimeout(() => {
        const panel = this.elementRef.nativeElement.querySelector('.notifications-panel');
        const overlay = this.elementRef.nativeElement.querySelector('.notifications-overlay');

        if (overlay) {
          this.animationService.fadeIn(overlay, { duration: 0.2 });
        }

        if (panel) {
          this.animationService.slideIn(panel, 'left', {
            duration: 0.25,
            distance: 50
          });

          // Stagger notification items
          const items = panel.querySelectorAll('.notification-item');
          if (items.length > 0) {
            this.animationService.staggerIn(items, {
              direction: 'left',
              stagger: 0.05,
              delay: 0.15
            });
          }
        }
      });
    }
  }

  markAsRead(notification: Notification) {
    if (notification.isRead) return;
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: (error) => {
        this.toastService.error('Error al marcar como leída');
        console.error('Mark as read error:', error);
      }
    });
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        // State is updated reactively via subscription
      },
      error: (error) => {
        this.toastService.error('Error al marcar todas como leídas');
        console.error('Mark all as read error:', error);
      }
    });
  }

  getNotificationIcon(type: string): string {
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
    const date = new Date(dateStr);
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

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;

    if (this.sidebarOpen) {
      // Animate sidebar open on mobile
      setTimeout(() => {
        const sidebar = this.elementRef.nativeElement.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 768) {
          this.animationService.slideIn(sidebar, 'right', {
            duration: 0.25,
            distance: 280
          });
        }
      });
    }
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
      setTimeout(() => {
        this.dataRefreshService.triggerRefresh(route);
      }, 150);
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
        setTimeout(() => {
          this.dataRefreshService.triggerRefresh(route);
        }, 100);
      });
    }
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
