import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProfileResponse, ClientStatus, Notification } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);

  userName: string = '';
  userEmail: string = '';
  profileData: ProfileResponse | null = null;
  unreadNotifications: number = 0;
  notifications: Notification[] = [];
  showNotificationsPanel: boolean = false;
  isLoading: boolean = true;
  errorMessage: string = '';

  // Status display mapping
  statusLabels: Record<ClientStatus, string> = {
    [ClientStatus.ESPERANDO_DATOS]: 'Necesitamos tus datos y documentos',
    [ClientStatus.CUENTA_EN_REVISION]: 'Estamos revisando tu informacion',
    [ClientStatus.TAXES_EN_PROCESO]: 'Estamos trabajando en tu declaracion!',
    [ClientStatus.TAXES_EN_CAMINO]: 'Tu reembolso esta en camino',
    [ClientStatus.TAXES_DEPOSITADOS]: 'Reembolso depositado en tu cuenta!',
    [ClientStatus.PAGO_REALIZADO]: 'Gracias por tu pago',
    [ClientStatus.EN_VERIFICACION]: 'El IRS esta verificando tu caso',
    [ClientStatus.TAXES_FINALIZADOS]: 'Proceso completado! Gracias por confiar en JAI1'
  };

  ngOnInit() {
    this.loadUserData();
    this.loadNotifications();
  }

  loadUserData() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName} ${user.lastName}`;
      this.userEmail = user.email;
    }

    this.profileService.getProfile().subscribe({
      next: (data) => {
        this.profileData = data;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar perfil';
        this.isLoading = false;
      }
    });
  }

  loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.unreadNotifications = notifications.filter(n => !n.isRead).length;
      },
      error: () => {
        // Silent fail for notifications
      }
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

  get currentStatus(): string {
    if (this.profileData?.taxCase) {
      return this.statusLabels[this.profileData.taxCase.clientStatus] || 'Estado desconocido';
    }
    return 'Completa tu perfil para comenzar';
  }

  get estimatedRefund(): number | null {
    return this.profileData?.taxCase?.estimatedRefund || null;
  }

  get isProfileComplete(): boolean {
    return this.profileData?.profile?.profileComplete || false;
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if API fails, redirect to login
        this.router.navigate(['/login']);
      }
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
