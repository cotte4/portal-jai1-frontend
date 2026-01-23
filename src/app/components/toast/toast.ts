import { Component, OnInit, OnDestroy, AfterViewInit, inject, ElementRef, ViewChild, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../core/services/toast.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';
import { gsap } from 'gsap';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, HoverScaleDirective],
  templateUrl: './toast.html',
  styleUrl: './toast.css'
})
export class ToastComponent implements OnInit, OnDestroy, AfterViewInit {
  private toastService = inject(ToastService);
  private animationService = inject(AnimationService);
  private subscriptions = new Subscription();
  private toastTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private progressAnimations: Map<number, gsap.core.Tween> = new Map();

  toasts: Toast[] = [];

  ngOnInit() {
    this.subscriptions.add(
      this.toastService.toast$.subscribe((toast) => {
        this.toasts.push(toast);

        // Animate entrance after DOM update
        setTimeout(() => this.animateToastEntrance(toast), 0);

        if (toast.duration && toast.duration > 0) {
          // Start progress bar animation
          setTimeout(() => this.animateProgressBar(toast), 50);

          const timer = setTimeout(() => this.dismissToast(toast.id), toast.duration);
          this.toastTimers.set(toast.id, timer);
        }
      })
    );

    this.subscriptions.add(
      this.toastService.dismiss$.subscribe((id) => {
        this.dismissToast(id);
      })
    );
  }

  ngAfterViewInit() {
    // Initial animations handled per toast
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
    this.toastTimers.forEach(timer => clearTimeout(timer));
    this.progressAnimations.forEach(anim => anim.kill());
  }

  private animateToastEntrance(toast: Toast) {
    const toastElement = document.querySelector(`[data-toast-id="${toast.id}"]`) as HTMLElement;
    if (toastElement) {
      // Slide from right animation
      gsap.fromTo(toastElement,
        {
          opacity: 0,
          x: 100,
          scale: 0.95
        },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.2)'
        }
      );
    }
  }

  private animateProgressBar(toast: Toast) {
    const progressBar = document.querySelector(`[data-toast-id="${toast.id}"] .toast-progress-bar`) as HTMLElement;
    if (progressBar && toast.duration) {
      const tween = gsap.fromTo(progressBar,
        { width: '100%' },
        {
          width: '0%',
          duration: toast.duration / 1000,
          ease: 'none'
        }
      );
      this.progressAnimations.set(toast.id, tween);
    }
  }

  dismissToast(id: number) {
    const toastElement = document.querySelector(`[data-toast-id="${id}"]`) as HTMLElement;

    // Clear timer
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }

    // Kill progress animation
    const progressAnim = this.progressAnimations.get(id);
    if (progressAnim) {
      progressAnim.kill();
      this.progressAnimations.delete(id);
    }

    if (toastElement) {
      // Fade out animation
      gsap.to(toastElement, {
        opacity: 0,
        x: 50,
        scale: 0.95,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => this.removeToast(id)
      });
    } else {
      this.removeToast(id);
    }
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
