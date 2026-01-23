import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { AnimationService, SlideDirection } from '../../core/services/animation.service';
import { ANIMATION_DURATION, ANIMATION_DISTANCE } from '../../core/constants/animation.constants';

@Directive({
  selector: '[appSlideIn]',
  standalone: true
})
export class SlideInDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private animationService = inject(AnimationService);

  @Input() appSlideIn: SlideDirection = 'up';
  @Input() slideInDelay: number = 0;
  @Input() slideInDuration: number = ANIMATION_DURATION.normal;
  @Input() slideInDistance: number = ANIMATION_DISTANCE.small;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;

    // Set initial state
    element.style.opacity = '0';

    this.animationService.slideIn(element, this.appSlideIn, {
      delay: this.slideInDelay,
      duration: this.slideInDuration,
      distance: this.slideInDistance
    });
  }

  ngOnDestroy(): void {
    this.animationService.killElementAnimations(this.el.nativeElement);
  }
}
