import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  getNotifications(unreadOnly = false): Observable<Notification[]> {
    let params = new HttpParams();
    if (unreadOnly) {
      params = params.set('unreadOnly', 'true');
    }

    return this.http.get<Notification[]>(`${this.apiUrl}/notifications`, { params }).pipe(
      tap((notifications: Notification[]) => {
        const unread = notifications.filter((n: Notification) => !n.isRead).length;
        this.unreadCountSubject.next(unread);
      }),
      catchError(this.handleError)
    );
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
      }),
      catchError(this.handleError)
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/notifications/read-all`, {}).pipe(
      tap(() => this.unreadCountSubject.next(0)),
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Notification error:', error);
    return throwError(() => error);
  }
}
