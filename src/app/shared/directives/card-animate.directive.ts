import { Directive, ElementRef, HostListener, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { AnimationService } from '../../core/services/animation.service';
import { ANIMATION_DURATION, ANIMATION_DISTANCE } from '../../core/constants/animation.constants';

@Directive({
  selector: '[appCardAnimate]',
  standalone: true
})
export class CardAnimateDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private animationService = inject(AnimationService);

  @Input() appCardAnimate: number | '' = ''; // Delay in seconds
  @Input() cardAnimateDirection: 'up' | 'down' | 'left' | 'right' = 'up';
  @Input() cardAnimateHover: boolean = true;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;

    // Set initial state
    element.style.opacity = '0';

    const delay = typeof this.appCardAnimate === 'number' ? this.appCardAnimate : 0;

    this.animationService.slideIn(element, this.cardAnimateDirection, {
      delay,
      duration: ANIMATION_DURATION.normal,
      distance: ANIMATION_DISTANCE.small
    });
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.cardAnimateHover) {
      this.animationService.cardHover(this.el.nativeElement, true);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (this.cardAnimateHover) {
      this.animationService.cardHover(this.el.nativeElement, false);
    }
  }

  ngOnDestroy(): void {
    this.animationService.killElementAnimations(this.el.nativeElement);
  }
}
