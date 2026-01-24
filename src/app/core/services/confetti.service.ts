import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';

@Injectable({
  providedIn: 'root'
})
export class ConfettiService {

  /**
   * Classic confetti burst from the center
   */
  celebrate(): void {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  /**
   * Big celebration with multiple bursts - for major milestones
   */
  bigCelebration(): void {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#B21B43', '#1D345D', '#ffd700', '#10b981'];

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }

  /**
   * Fireworks effect - for refund deposited
   */
  fireworks(): void {
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Launch from two random points
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#B21B43', '#ff6b8a', '#ffd700']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#1D345D', '#2a4a7a', '#10b981']
      });
    }, 250);
  }

  /**
   * Gold coins effect - for money/refund related celebrations
   */
  moneyRain(): void {
    const defaults = {
      spread: 360,
      ticks: 100,
      gravity: 0.5,
      decay: 0.94,
      startVelocity: 30,
      colors: ['#ffd700', '#ffec8b', '#daa520', '#f0e68c']
    };

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 30,
        scalar: 1.2,
        shapes: ['circle'],
        origin: { x: 0.5, y: 0.3 }
      });

      confetti({
        ...defaults,
        particleCount: 20,
        scalar: 0.8,
        shapes: ['circle'],
        origin: { x: 0.3, y: 0.4 }
      });

      confetti({
        ...defaults,
        particleCount: 20,
        scalar: 0.8,
        shapes: ['circle'],
        origin: { x: 0.7, y: 0.4 }
      });
    };

    shoot();
    setTimeout(shoot, 200);
    setTimeout(shoot, 400);
  }

  /**
   * Side cannons - celebration from both sides
   */
  sideCannons(): void {
    const end = Date.now() + 1000;
    const colors = ['#B21B43', '#1D345D', '#10b981', '#ffd700'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }

  /**
   * Quick burst for smaller wins (copy code, first action, etc.)
   */
  quickBurst(): void {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#B21B43', '#1D345D', '#10b981']
    });
  }

  /**
   * Star burst effect
   */
  stars(): void {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 20,
      shapes: ['star'] as confetti.Shape[],
      colors: ['#ffd700', '#ffec8b', '#fff']
    };

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 20,
        scalar: 1.2,
        origin: { x: 0.5, y: 0.5 }
      });
    };

    shoot();
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }
}
