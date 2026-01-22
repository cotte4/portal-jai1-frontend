import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, BehaviorSubject, tap, interval, Subscription, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification, NotificationType } from '../models';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private newNotificationSubject = new Subject<Notification[]>();
  public newNotification$ = this.newNotificationSubject.asObservable();

  private pollingSubscription: Subscription | null = null;
  private knownNotificationIds = new Set<string>();

  getNotifications(unreadOnly = false): Observable<Notification[]> {
    let params = new HttpParams();
    if (unreadOnly) {
      params = params.set('unreadOnly', 'true');
    }

    return this.http.get<Notification[]>(`${this.apiUrl}/notifications`, { params }).pipe(
      tap((notifications: Notification[]) => {
        const unread = notifications.filter((n: Notification) => !n.isRead).length;
        this.unreadCountSubject.next(unread);
        this.notificationsSubject.next(notifications);
      }),
      catchError(this.handleError)
    );
  }

  startPolling(intervalMs = 30000): void {
    if (this.pollingSubscription) {
      return; // Already polling
    }

    // Initial load
    this.fetchAndCheckNewNotifications();

    // Start interval
    this.pollingSubscription = interval(intervalMs).subscribe(() => {
      this.fetchAndCheckNewNotifications();
    });
  }

  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private fetchAndCheckNewNotifications(): void {
    this.http.get<Notification[]>(`${this.apiUrl}/notifications`).subscribe({
      next: (notifications) => {
        // Update counts and state
        const unread = notifications.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);
        this.notificationsSubject.next(notifications);

        // Check for new notifications
        const newNotifications = notifications.filter(n => !this.knownNotificationIds.has(n.id));

        if (newNotifications.length > 0 && this.knownNotificationIds.size > 0) {
          // Only emit if we had previous notifications (not first load)
          this.newNotificationSubject.next(newNotifications);
        }

        // Update known IDs
        this.knownNotificationIds.clear();
        notifications.forEach(n => this.knownNotificationIds.add(n.id));
      },
      error: (error) => {
        console.error('Notification polling error:', error);
        // Don't stop polling on error, just log it
      }
    });
  }

  markAsRead(notificationId: string): Observable<Notification> {
    return this.http.patch<Notification>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {}
    ).pipe(
      tap(() => {
        const current = this.unreadCountSubject.value;
        if (current > 0) {
          this.unreadCountSubject.next(current - 1);
        }
        // Update local state
        const notifications = this.notificationsSubject.value.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        );
        this.notificationsSubject.next(notifications);
      }),
      catchError(this.handleError)
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/notifications/read-all`, {}).pipe(
      tap(() => {
        this.unreadCountSubject.next(0);
        // Update local state
        const notifications = this.notificationsSubject.value.map(n => ({ ...n, isRead: true }));
        this.notificationsSubject.next(notifications);
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Notification error:', error);
    return throwError(() => error);
  }

  // Emit a local notification for immediate UI feedback
  emitLocalNotification(title: string, message: string, type: NotificationType = NotificationType.STATUS_CHANGE): void {
    const localNotification: Notification = {
      id: `local-${Date.now()}`,
      userId: '',
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // Add to current notifications
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([localNotification, ...currentNotifications]);

    // Update unread count
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);

    // Emit as new notification for toast/alert display
    this.newNotificationSubject.next([localNotification]);
  }
}
