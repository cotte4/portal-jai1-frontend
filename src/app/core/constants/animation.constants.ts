/**
 * Animation constants for GSAP animations across the portal
 * These provide consistent timing and easing throughout the app
 */

export const ANIMATION_DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8
} as const;

export const ANIMATION_EASE = {
  smooth: 'power2.out',
  smoothIn: 'power2.in',
  smoothInOut: 'power2.inOut',
  bounce: 'back.out(1.2)',
  elastic: 'elastic.out(1, 0.5)',
  none: 'none'
} as const;

export const ANIMATION_DISTANCE = {
  tiny: 8,
  small: 15,
  medium: 30,
  large: 50
} as const;

export const ANIMATION_STAGGER = {
  fast: 0.05,
  normal: 0.08,
  slow: 0.12
} as const;

export const ANIMATION_SCALE = {
  pressed: 0.95,
  hover: 1.02,
  pop: 1.1
} as const;

// Animation presets for common use cases
export const ANIMATION_PRESETS = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  fadeInUp: {
    from: { opacity: 0, y: ANIMATION_DISTANCE.small },
    to: { opacity: 1, y: 0, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  fadeInDown: {
    from: { opacity: 0, y: -ANIMATION_DISTANCE.small },
    to: { opacity: 1, y: 0, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  slideInLeft: {
    from: { opacity: 0, x: -ANIMATION_DISTANCE.medium },
    to: { opacity: 1, x: 0, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  slideInRight: {
    from: { opacity: 0, x: ANIMATION_DISTANCE.medium },
    to: { opacity: 1, x: 0, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1, duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.bounce }
  },
  cardHover: {
    to: { y: -4, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.smooth }
  },
  cardUnhover: {
    to: { y: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.smooth }
  }
} as const;
