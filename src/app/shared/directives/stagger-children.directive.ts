import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  inject
} from '@angular/core';
import { AnimationService, SlideDirection } from '../../core/services/animation.service';
import { ANIMATION_STAGGER, ANIMATION_DURATION, ANIMATION_DISTANCE } from '../../core/constants/animation.constants';

@Directive({
  selector: '[appStaggerChildren]',
  standalone: true
})
export class StaggerChildrenDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef);
  private animationService = inject(AnimationService);

  @Input() appStaggerChildren: string = ''; // Child selector (e.g., '.item', 'li')
  @Input() staggerDirection: SlideDirection = 'up';
  @Input() staggerDelay: number = 0;
  @Input() staggerAmount: number = ANIMATION_STAGGER.normal;
  @Input() staggerDuration: number = ANIMATION_DURATION.normal;
  @Input() staggerDistance: number = ANIMATION_DISTANCE.small;

  ngAfterViewInit(): void {
    const container = this.el.nativeElement as HTMLElement;
    const selector = this.appStaggerChildren || ':scope > *';
    const children = container.querySelectorAll(selector);

    if (children.length === 0) return;

    // Set initial state for all children
    children.forEach(child => {
      (child as HTMLElement).style.opacity = '0';
    });

    this.animationService.staggerIn(children, {
      direction: this.staggerDirection,
      delay: this.staggerDelay,
      stagger: this.staggerAmount,
      duration: this.staggerDuration,
      distance: this.staggerDistance
    });
  }

  ngOnDestroy(): void {
    const container = this.el.nativeElement as HTMLElement;
    const selector = this.appStaggerChildren || ':scope > *';
    const children = container.querySelectorAll(selector);

    children.forEach(child => {
      this.animationService.killElementAnimations(child as HTMLElement);
    });
  }
}
