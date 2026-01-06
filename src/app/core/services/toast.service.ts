import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  title?: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'notification';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<Toast>();
  private dismissSubject = new Subject<number>();

  toast$: Observable<Toast> = this.toastSubject.asObservable();
  dismiss$: Observable<number> = this.dismissSubject.asObservable();

  show(message: string, type: Toast['type'] = 'info', title?: string, duration = 4000): number {
    const id = Date.now();
    this.toastSubject.next({ id, message, type, title, duration });
    return id;
  }

  success(message: string, title?: string): number {
    return this.show(message, 'success', title);
  }

  error(message: string, title?: string): number {
    return this.show(message, 'error', title, 5000);
  }

  warning(message: string, title?: string): number {
    return this.show(message, 'warning', title);
  }

  info(message: string, title?: string): number {
    return this.show(message, 'info', title);
  }

  notification(message: string, title?: string): number {
    return this.show(message, 'notification', title, 5000);
  }

  dismiss(id: number): void {
    this.dismissSubject.next(id);
  }
}
