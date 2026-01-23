import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, BehaviorSubject, tap, interval, Subscription, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Notification, NotificationType } from '../models';

export interface NotificationsPaginatedResponse {
  notifications: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
}

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
  private fetchSubscription: Subscription | null = null;
  private knownNotificationIds = new Set<string>();

  private nextCursor: string | null = null;
  private hasMoreNotifications = false;

  // WebSocket support
  private socket: Socket | null = null;
  private isWebSocketConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  /**
   * Get notifications with pagination support
   * @param unreadOnly - Filter to only unread notifications
   * @param cursor - Cursor for pagination
   * @param limit - Maximum number of results (default 20)
   */
  getNotifications(unreadOnly = false, cursor?: string, limit = 20): Observable<NotificationsPaginatedResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (unreadOnly) {
      params = params.set('unreadOnly', 'true');
    }
    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http.get<NotificationsPaginatedResponse>(`${this.apiUrl}/notifications`, { params }).pipe(
      tap((response: NotificationsPaginatedResponse) => {
        const unread = response.notifications.filter((n: Notification) => !n.isRead).length;
        this.unreadCountSubject.next(unread);
        this.notificationsSubject.next(response.notifications);
        this.nextCursor = response.nextCursor;
        this.hasMoreNotifications = response.hasMore;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Load more notifications (append to existing list)
   */
  loadMoreNotifications(): Observable<NotificationsPaginatedResponse> {
    if (!this.hasMoreNotifications || !this.nextCursor) {
      return throwError(() => new Error('No more notifications to load'));
    }

    let params = new HttpParams()
      .set('cursor', this.nextCursor)
      .set('limit', '20');

    return this.http.get<NotificationsPaginatedResponse>(`${this.apiUrl}/notifications`, { params }).pipe(
      tap((response: NotificationsPaginatedResponse) => {
        // Append new notifications to existing list
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = [...currentNotifications, ...response.notifications];
        this.notificationsSubject.next(updatedNotifications);

        // Update cursor and hasMore
        this.nextCursor = response.nextCursor;
        this.hasMoreNotifications = response.hasMore;

        // Update unread count based on full list
        const unread = updatedNotifications.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Check if there are more notifications to load
   */
  get hasMore(): boolean {
    return this.hasMoreNotifications;
  }

  /**
   * Initialize WebSocket connection and start real-time notifications
   * Falls back to HTTP polling if WebSocket fails
   */
  startPolling(intervalMs = 30000): void {
    // Initial load
    this.fetchAndCheckNewNotifications();

    // Try to connect via WebSocket first
    this.connectWebSocket();

    // Start HTTP polling as fallback (will be minimal load if WebSocket is working)
    if (this.pollingSubscription) {
      return; // Already polling
    }

    this.pollingSubscription = interval(intervalMs).subscribe(() => {
      // Only poll if WebSocket is not connected
      if (!this.isWebSocketConnected) {
        this.fetchAndCheckNewNotifications();
      }
    });
  }

  /**
   * Connect to WebSocket server for real-time notifications
   */
  private connectWebSocket(): void {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // Get token from localStorage
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No auth token found, skipping WebSocket connection');
        return;
      }

      // Extract base URL (remove /v1 suffix)
      const baseUrl = this.apiUrl.replace('/v1', '');

      // Connect to WebSocket server
      this.socket = io(`${baseUrl}/notifications`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      // Connection successful
      this.socket.on('connected', (data) => {
        console.log('WebSocket connected:', data);
        this.isWebSocketConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset reconnect delay
      });

      // Handle incoming notifications
      this.socket.on('notification', (notification: Notification) => {
        console.log('Received real-time notification:', notification);
        this.handleIncomingNotification(notification);
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isWebSocketConnected = false;
        this.reconnectAttempts++;

        // Exponential backoff for reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
          console.log(`Will retry WebSocket connection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        } else {
          console.warn('Max WebSocket reconnection attempts reached, falling back to HTTP polling');
        }
      });

      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isWebSocketConnected = false;

        // Try to reconnect if it wasn't a manual disconnect
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          this.socket?.connect();
        }
      });

      // Handle errors
      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Ping/pong for keep-alive
      setInterval(() => {
        if (this.socket?.connected) {
          this.socket.emit('ping');
        }
      }, 30000); // Ping every 30 seconds

      this.socket.on('pong', (data) => {
        // Keep connection alive
        console.debug('WebSocket pong received:', data);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.isWebSocketConnected = false;
    }
  }

  /**
   * Handle incoming real-time notification from WebSocket
   */
  private handleIncomingNotification(notification: Notification): void {
    // Check if we already have this notification
    if (this.knownNotificationIds.has(notification.id)) {
      return;
    }

    // Add to known IDs
    this.knownNotificationIds.add(notification.id);

    // Update unread count
    if (!notification.isRead) {
      const current = this.unreadCountSubject.value;
      this.unreadCountSubject.next(current + 1);
    }

    // Prepend to notifications list
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([notification, ...currentNotifications]);

    // Emit as new notification (for toasts/alerts)
    this.newNotificationSubject.next([notification]);
  }

  /**
   * Disconnect WebSocket
   */
  private disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isWebSocketConnected = false;
      console.log('WebSocket disconnected');
    }
  }

  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    if (this.fetchSubscription) {
      this.fetchSubscription.unsubscribe();
      this.fetchSubscription = null;
    }
    // Disconnect WebSocket
    this.disconnectWebSocket();
  }

  /**
   * Reset all notification state - call this on logout
   */
  reset(): void {
    this.stopPolling();
    this.unreadCountSubject.next(0);
    this.notificationsSubject.next([]);
    this.knownNotificationIds.clear();
    this.nextCursor = null;
    this.hasMoreNotifications = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  private fetchAndCheckNewNotifications(): void {
    // Cancel any in-flight fetch request
    if (this.fetchSubscription) {
      this.fetchSubscription.unsubscribe();
    }

    // Polling: only fetch first page (latest 20 notifications) to detect new ones
    let params = new HttpParams().set('limit', '20');

    this.fetchSubscription = this.http.get<NotificationsPaginatedResponse>(
      `${this.apiUrl}/notifications`,
      { params }
    ).subscribe({
      next: (response) => {
        const notifications = response.notifications;

        // Update counts and state
        const unread = notifications.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);

        // Update cursor info
        this.nextCursor = response.nextCursor;
        this.hasMoreNotifications = response.hasMore;

        // Check for new notifications
        const newNotifications = notifications.filter(n => !this.knownNotificationIds.has(n.id));

        if (newNotifications.length > 0 && this.knownNotificationIds.size > 0) {
          // Only emit if we had previous notifications (not first load)
          this.newNotificationSubject.next(newNotifications);

          // Prepend new notifications to existing list (they come first)
          const currentNotifications = this.notificationsSubject.value;
          const updatedNotifications = [...newNotifications, ...currentNotifications];
          this.notificationsSubject.next(updatedNotifications);
        } else {
          // First load or no new notifications - just replace the list
          this.notificationsSubject.next(notifications);
        }

        // Update known IDs
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

  archiveNotification(notificationId: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.apiUrl}/notifications/${notificationId}/archive`,
      {}
    ).pipe(
      tap(() => {
        // Remove from local state (archived notifications are excluded by default)
        const notifications = this.notificationsSubject.value.filter(n => n.id !== notificationId);
        this.notificationsSubject.next(notifications);
        // Update unread count
        const unread = notifications.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);
        // Remove from known IDs only on success
        this.knownNotificationIds.delete(notificationId);
      }),
      catchError((error) => {
        // On error, sync with server by re-fetching to prevent divergence
        this.fetchAndCheckNewNotifications();
        return this.handleError(error);
      })
    );
  }

  archiveAllRead(): Observable<{ message: string; count: number }> {
    return this.http.patch<{ message: string; count: number }>(
      `${this.apiUrl}/notifications/archive-all-read`,
      {}
    ).pipe(
      tap(() => {
        // Remove all read notifications from local state
        const notifications = this.notificationsSubject.value.filter(n => !n.isRead);
        this.notificationsSubject.next(notifications);
        // Update known IDs only on success
        this.knownNotificationIds.clear();
        notifications.forEach(n => this.knownNotificationIds.add(n.id));
      }),
      catchError((error) => {
        // On error, sync with server by re-fetching to prevent divergence
        this.fetchAndCheckNewNotifications();
        return this.handleError(error);
      })
    );
  }

  // ============= DELETE METHODS =============

  deleteNotification(notificationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/notifications/${notificationId}`
    ).pipe(
      tap(() => {
        // Remove from local state
        const notifications = this.notificationsSubject.value.filter(n => n.id !== notificationId);
        this.notificationsSubject.next(notifications);
        // Update unread count
        const unread = notifications.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);
        // Remove from known IDs only on success
        this.knownNotificationIds.delete(notificationId);
      }),
      catchError((error) => {
        // On error, sync with server by re-fetching to prevent divergence
        this.fetchAndCheckNewNotifications();
        return this.handleError(error);
      })
    );
  }

  deleteAllRead(): Observable<{ message: string; count: number }> {
    return this.http.delete<{ message: string; count: number }>(
      `${this.apiUrl}/notifications/read`
    ).pipe(
      tap(() => {
        // Remove all read notifications from local state
        const notifications = this.notificationsSubject.value.filter(n => !n.isRead);
        this.notificationsSubject.next(notifications);
        // Update known IDs only on success
        this.knownNotificationIds.clear();
        notifications.forEach(n => this.knownNotificationIds.add(n.id));
      }),
      catchError((error) => {
        // On error, sync with server by re-fetching to prevent divergence
        this.fetchAndCheckNewNotifications();
        return this.handleError(error);
      })
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Notification error:', error);
    return throwError(() => error);
  }

  // Emit a local notification for immediate UI feedback
  emitLocalNotification(title: string, message: string, type: NotificationType = NotificationType.STATUS_CHANGE): void {
    const localNotification: Notification = {
      id: `local-${crypto.randomUUID()}`,
      userId: '',
      title,
      message,
      type,
      isRead: false,
      isArchived: false,
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

  /**
   * Get WebSocket connection status (for debugging/monitoring)
   */
  getConnectionStatus(): { isWebSocketConnected: boolean; reconnectAttempts: number } {
    return {
      isWebSocketConnected: this.isWebSocketConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
