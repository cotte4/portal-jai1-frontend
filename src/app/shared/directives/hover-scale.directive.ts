import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';
import { AnimationService } from '../../core/services/animation.service';

@Directive({
  selector: '[appHoverScale]',
  standalone: true
})
export class HoverScaleDirective implements OnDestroy {
  private el = inject(ElementRef);
  private animationService = inject(AnimationService);

  @Input() appHoverScale: 'button' | 'card' | '' = 'button';

  private get isCard(): boolean {
    return this.appHoverScale === 'card';
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.isCard) {
      this.animationService.cardHover(this.el.nativeElement, true);
    } else {
      this.animationService.buttonHover(this.el.nativeElement, true);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (this.isCard) {
      this.animationService.cardHover(this.el.nativeElement, false);
    } else {
      this.animationService.buttonHover(this.el.nativeElement, false);
    }
  }

  @HostListener('mousedown')
  onMouseDown(): void {
    if (!this.isCard) {
      this.animationService.buttonPress(this.el.nativeElement);
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    if (!this.isCard) {
      this.animationService.buttonRelease(this.el.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.animationService.killElementAnimations(this.el.nativeElement);
  }
}
