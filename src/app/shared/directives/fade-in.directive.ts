import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { AnimationService } from '../../core/services/animation.service';
import { ANIMATION_DURATION } from '../../core/constants/animation.constants';

@Directive({
  selector: '[appFadeIn]',
  standalone: true
})
export class FadeInDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private animationService = inject(AnimationService);

  @Input() appFadeIn: number | '' = ''; // Delay in seconds
  @Input() fadeInDuration: number = ANIMATION_DURATION.normal;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;

    // Set initial state
    element.style.opacity = '0';

    const delay = typeof this.appFadeIn === 'number' ? this.appFadeIn : 0;

    this.animationService.fadeIn(element, {
      delay,
      duration: this.fadeInDuration
    });
  }

  ngOnDestroy(): void {
    this.animationService.killElementAnimations(this.el.nativeElement);
  }
}
