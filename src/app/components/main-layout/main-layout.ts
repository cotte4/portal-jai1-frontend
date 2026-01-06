import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { Notification } from '../../core/models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private dataRefreshService = inject(DataRefreshService);
  private chatbotScriptId = 'relevance-ai-chatbot';

  userName: string = '';
  userEmail: string = '';
  sidebarOpen: boolean = false;
  showNotificationsPanel: boolean = false;
  unreadNotifications: number = 0;
  notifications: Notification[] = [];

  ngOnInit() {
    this.loadUserData();
    this.loadNotifications();
    this.loadChatbotScript();
  }

  ngOnDestroy() {
    this.removeChatbotScript();
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

  loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.unreadNotifications = notifications.filter(n => !n.isRead).length;
      },
      error: () => {}
    });
  }

  toggleNotificationsPanel() {
    this.showNotificationsPanel = !this.showNotificationsPanel;
  }

  markAsRead(notification: Notification) {
    if (notification.isRead) return;
    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
        this.unreadNotifications = this.notifications.filter(n => !n.isRead).length;
      }
    });
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadNotifications = 0;
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'status_change': return '📊';
      case 'docs_missing': return '📁';
      case 'message': return '💬';
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

  closeSidebar() {
    this.sidebarOpen = false;
  }

  navigateToProfile() {
    this.closeSidebar();
    this.router.navigate(['/profile']);
  }

  navigateWithRefresh(route: string) {
    this.closeSidebar();
    // Navigate first, then trigger refresh AFTER component is ready
    this.router.navigate([route]).then(() => {
      // Small delay to ensure component has subscribed
      setTimeout(() => {
        this.dataRefreshService.triggerRefresh(route);
      }, 50);
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}

