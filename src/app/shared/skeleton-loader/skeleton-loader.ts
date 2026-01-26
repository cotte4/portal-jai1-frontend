import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type SkeletonVariant = 'text' | 'title' | 'avatar' | 'thumbnail' | 'card' | 'button' | 'circle' | 'rect';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="skeleton"
      [class.skeleton-text]="variant === 'text'"
      [class.skeleton-title]="variant === 'title'"
      [class.skeleton-avatar]="variant === 'avatar'"
      [class.skeleton-thumbnail]="variant === 'thumbnail'"
      [class.skeleton-card]="variant === 'card'"
      [class.skeleton-button]="variant === 'button'"
      [class.skeleton-circle]="variant === 'circle'"
      [class.skeleton-rect]="variant === 'rect'"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="borderRadius"
    ></div>
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.06) 25%,
        rgba(0, 0, 0, 0.1) 50%,
        rgba(0, 0, 0, 0.06) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-text {
      height: 14px;
      width: 100%;
      border-radius: 4px;
    }

    .skeleton-title {
      height: 24px;
      width: 60%;
      border-radius: 6px;
    }

    .skeleton-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
    }

    .skeleton-thumbnail {
      width: 80px;
      height: 80px;
      border-radius: 8px;
    }

    .skeleton-card {
      width: 100%;
      height: 120px;
      border-radius: 12px;
    }

    .skeleton-button {
      width: 100px;
      height: 40px;
      border-radius: 8px;
    }

    .skeleton-circle {
      border-radius: 50%;
    }

    .skeleton-rect {
      border-radius: 8px;
    }
  `]
})
export class SkeletonLoader {
  @Input() variant: SkeletonVariant = 'text';
  @Input() width: string = '';
  @Input() height: string = '';
  @Input() borderRadius: string = '';
}
