import { Injectable } from '@angular/core';
import { gsap } from 'gsap';
import {
  ANIMATION_DURATION,
  ANIMATION_EASE,
  ANIMATION_DISTANCE,
  ANIMATION_STAGGER,
  ANIMATION_SCALE
} from '../constants/animation.constants';

export type SlideDirection = 'up' | 'down' | 'left' | 'right';

@Injectable({
  providedIn: 'root'
})
export class AnimationService {
  private animations: gsap.core.Tween[] = [];

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Fade in an element
   */
  fadeIn(
    element: HTMLElement | HTMLElement[],
    options: {
      duration?: number;
      delay?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { opacity: 1 });
      options.onComplete?.();
      return null;
    }

    const tween = gsap.fromTo(
      element,
      { opacity: 0 },
      {
        opacity: 1,
        duration: options.duration ?? ANIMATION_DURATION.normal,
        delay: options.delay ?? 0,
        ease: options.ease ?? ANIMATION_EASE.smooth,
        onComplete: options.onComplete
      }
    );
    this.animations.push(tween);
    return tween;
  }

  /**
   * Fade out an element
   */
  fadeOut(
    element: HTMLElement | HTMLElement[],
    options: {
      duration?: number;
      delay?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { opacity: 0 });
      options.onComplete?.();
      return null;
    }

    const tween = gsap.to(element, {
      opacity: 0,
      duration: options.duration ?? ANIMATION_DURATION.normal,
      delay: options.delay ?? 0,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Slide in an element from a direction
   */
  slideIn(
    element: HTMLElement | HTMLElement[],
    direction: SlideDirection = 'up',
    options: {
      duration?: number;
      delay?: number;
      distance?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { opacity: 1, x: 0, y: 0 });
      options.onComplete?.();
      return null;
    }

    const distance = options.distance ?? ANIMATION_DISTANCE.small;
    const fromVars: gsap.TweenVars = { opacity: 0 };

    switch (direction) {
      case 'up':
        fromVars.y = distance;
        break;
      case 'down':
        fromVars.y = -distance;
        break;
      case 'left':
        fromVars.x = distance;
        break;
      case 'right':
        fromVars.x = -distance;
        break;
    }

    const tween = gsap.fromTo(element, fromVars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: options.duration ?? ANIMATION_DURATION.normal,
      delay: options.delay ?? 0,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Slide out an element in a direction
   */
  slideOut(
    element: HTMLElement | HTMLElement[],
    direction: SlideDirection = 'up',
    options: {
      duration?: number;
      delay?: number;
      distance?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { opacity: 0 });
      options.onComplete?.();
      return null;
    }

    const distance = options.distance ?? ANIMATION_DISTANCE.small;
    const toVars: gsap.TweenVars = {
      opacity: 0,
      duration: options.duration ?? ANIMATION_DURATION.normal,
      delay: options.delay ?? 0,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    };

    switch (direction) {
      case 'up':
        toVars.y = -distance;
        break;
      case 'down':
        toVars.y = distance;
        break;
      case 'left':
        toVars.x = -distance;
        break;
      case 'right':
        toVars.x = distance;
        break;
    }

    const tween = gsap.to(element, toVars);
    this.animations.push(tween);
    return tween;
  }

  /**
   * Stagger animate a list of elements
   */
  staggerIn(
    elements: HTMLElement[] | NodeListOf<Element>,
    options: {
      direction?: SlideDirection;
      duration?: number;
      stagger?: number;
      delay?: number;
      distance?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(elements, { opacity: 1, x: 0, y: 0 });
      options.onComplete?.();
      return null;
    }

    const direction = options.direction ?? 'up';
    const distance = options.distance ?? ANIMATION_DISTANCE.small;
    const fromVars: gsap.TweenVars = { opacity: 0 };

    switch (direction) {
      case 'up':
        fromVars.y = distance;
        break;
      case 'down':
        fromVars.y = -distance;
        break;
      case 'left':
        fromVars.x = distance;
        break;
      case 'right':
        fromVars.x = -distance;
        break;
    }

    const tween = gsap.fromTo(elements, fromVars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: options.duration ?? ANIMATION_DURATION.normal,
      stagger: options.stagger ?? ANIMATION_STAGGER.normal,
      delay: options.delay ?? 0,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Scale in an element with optional bounce
   */
  scaleIn(
    element: HTMLElement | HTMLElement[],
    options: {
      duration?: number;
      delay?: number;
      fromScale?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { opacity: 1, scale: 1 });
      options.onComplete?.();
      return null;
    }

    const tween = gsap.fromTo(
      element,
      { opacity: 0, scale: options.fromScale ?? 0.9 },
      {
        opacity: 1,
        scale: 1,
        duration: options.duration ?? ANIMATION_DURATION.normal,
        delay: options.delay ?? 0,
        ease: options.ease ?? ANIMATION_EASE.bounce,
        onComplete: options.onComplete
      }
    );
    this.animations.push(tween);
    return tween;
  }

  /**
   * Button press micro-interaction
   */
  buttonPress(element: HTMLElement): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      scale: ANIMATION_SCALE.pressed,
      duration: ANIMATION_DURATION.fast,
      ease: ANIMATION_EASE.smooth
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Button release micro-interaction
   */
  buttonRelease(element: HTMLElement): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      scale: 1,
      duration: ANIMATION_DURATION.fast,
      ease: ANIMATION_EASE.bounce
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Button hover effect
   */
  buttonHover(element: HTMLElement, isHovering: boolean): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      scale: isHovering ? ANIMATION_SCALE.hover : 1,
      duration: ANIMATION_DURATION.fast,
      ease: ANIMATION_EASE.smooth
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Card hover lift effect
   */
  cardHover(element: HTMLElement, isHovering: boolean): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      y: isHovering ? -4 : 0,
      boxShadow: isHovering
        ? '0 10px 40px rgba(0,0,0,0.12)'
        : '0 4px 20px rgba(0,0,0,0.08)',
      duration: ANIMATION_DURATION.fast,
      ease: ANIMATION_EASE.smooth
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Validation error shake
   */
  validationShake(element: HTMLElement): gsap.core.Timeline | null {
    if (this.prefersReducedMotion()) return null;

    const timeline = gsap.timeline();
    timeline
      .to(element, { x: -8, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: 8, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: -6, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: 6, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: -4, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: 4, duration: 0.06, ease: ANIMATION_EASE.none })
      .to(element, { x: 0, duration: 0.06, ease: ANIMATION_EASE.none });

    return timeline;
  }

  /**
   * Counter animation (numbers counting up)
   */
  counterUp(
    element: HTMLElement,
    endValue: number,
    options: {
      startValue?: number;
      duration?: number;
      prefix?: string;
      suffix?: string;
      decimals?: number;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    const startValue = options.startValue ?? 0;
    const prefix = options.prefix ?? '';
    const suffix = options.suffix ?? '';
    const decimals = options.decimals ?? 0;

    if (this.prefersReducedMotion()) {
      element.textContent = prefix + endValue.toFixed(decimals) + suffix;
      options.onComplete?.();
      return null;
    }

    const obj = { value: startValue };
    const tween = gsap.to(obj, {
      value: endValue,
      duration: options.duration ?? ANIMATION_DURATION.slow,
      ease: ANIMATION_EASE.smooth,
      onUpdate: () => {
        element.textContent = prefix + obj.value.toFixed(decimals) + suffix;
      },
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Progress bar animation
   */
  progressBar(
    element: HTMLElement,
    percentage: number,
    options: {
      duration?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { width: `${percentage}%` });
      options.onComplete?.();
      return null;
    }

    const tween = gsap.to(element, {
      width: `${percentage}%`,
      duration: options.duration ?? ANIMATION_DURATION.slow,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * SVG stroke animation (for circular progress)
   */
  strokeAnimation(
    element: SVGElement,
    percentage: number,
    options: {
      duration?: number;
      ease?: string;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) {
      const circumference = 2 * Math.PI * 45; // Assuming radius of 45
      const offset = circumference - (percentage / 100) * circumference;
      gsap.set(element, { strokeDashoffset: offset });
      options.onComplete?.();
      return null;
    }

    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percentage / 100) * circumference;

    const tween = gsap.to(element, {
      strokeDashoffset: offset,
      duration: options.duration ?? ANIMATION_DURATION.slow,
      ease: options.ease ?? ANIMATION_EASE.smooth,
      onComplete: options.onComplete
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Pulse animation (for attention)
   */
  pulse(
    element: HTMLElement,
    options: {
      scale?: number;
      duration?: number;
      repeat?: number;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      scale: options.scale ?? 1.05,
      duration: options.duration ?? ANIMATION_DURATION.fast,
      repeat: options.repeat ?? 1,
      yoyo: true,
      ease: ANIMATION_EASE.smooth
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Float animation (gentle up/down)
   */
  float(
    element: HTMLElement,
    options: {
      distance?: number;
      duration?: number;
    } = {}
  ): gsap.core.Tween | null {
    if (this.prefersReducedMotion()) return null;

    const tween = gsap.to(element, {
      y: options.distance ?? -10,
      duration: options.duration ?? 2,
      repeat: -1,
      yoyo: true,
      ease: ANIMATION_EASE.smoothInOut
    });
    this.animations.push(tween);
    return tween;
  }

  /**
   * Success checkmark animation
   */
  successCheck(element: HTMLElement): gsap.core.Timeline | null {
    if (this.prefersReducedMotion()) {
      gsap.set(element, { scale: 1, opacity: 1 });
      return null;
    }

    const timeline = gsap.timeline();
    timeline
      .fromTo(
        element,
        { scale: 0, opacity: 0 },
        { scale: 1.2, opacity: 1, duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.smooth }
      )
      .to(element, { scale: 1, duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.bounce });

    return timeline;
  }

  /**
   * Modal entrance animation
   */
  modalIn(
    overlay: HTMLElement,
    content: HTMLElement,
    options: {
      duration?: number;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Timeline | null {
    if (this.prefersReducedMotion()) {
      gsap.set([overlay, content], { opacity: 1, scale: 1 });
      options.onComplete?.();
      return null;
    }

    const timeline = gsap.timeline({ onComplete: options.onComplete });
    timeline
      .fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: ANIMATION_DURATION.fast })
      .fromTo(
        content,
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.bounce },
        '-=0.1'
      );

    return timeline;
  }

  /**
   * Modal exit animation
   */
  modalOut(
    overlay: HTMLElement,
    content: HTMLElement,
    options: {
      duration?: number;
      onComplete?: () => void;
    } = {}
  ): gsap.core.Timeline | null {
    if (this.prefersReducedMotion()) {
      gsap.set([overlay, content], { opacity: 0 });
      options.onComplete?.();
      return null;
    }

    const timeline = gsap.timeline({ onComplete: options.onComplete });
    timeline
      .to(content, { opacity: 0, scale: 0.95, y: 10, duration: ANIMATION_DURATION.fast })
      .to(overlay, { opacity: 0, duration: ANIMATION_DURATION.fast }, '-=0.1');

    return timeline;
  }

  /**
   * Kill all tracked animations (call on component destroy)
   */
  killAnimations(): void {
    this.animations.forEach(tween => tween.kill());
    this.animations = [];
  }

  /**
   * Kill animations on specific element
   */
  killElementAnimations(element: HTMLElement | HTMLElement[]): void {
    gsap.killTweensOf(element);
  }
}
