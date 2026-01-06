import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class ToastComponent implements OnInit, OnDestroy {
  private toastService = inject(ToastService);
  private subscriptions = new Subscription();

  toasts: Toast[] = [];

  ngOnInit() {
    this.subscriptions.add(
      this.toastService.toast$.subscribe((toast) => {
        this.toasts.push(toast);

        if (toast.duration && toast.duration > 0) {
          setTimeout(() => this.removeToast(toast.id), toast.duration);
        }
      })
    );

    this.subscriptions.add(
      this.toastService.dismiss$.subscribe((id) => {
        this.removeToast(id);
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  removeToast(id: number) {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index > -1) {
      this.toasts.splice(index, 1);
    }
  }

  getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'notification': return '🔔';
      default: return 'ℹ';
    }
  }
}
