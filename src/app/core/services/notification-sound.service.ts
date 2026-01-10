import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationSoundService {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.3;

  /**
   * Play a pleasant notification sound using Web Audio API
   * Creates a soft, Apple-like "ding" sound
   */
  playNotificationSound(): void {
    if (!this.isEnabled) return;

    try {
      // Create or reuse AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Create oscillator for the main tone
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Configure a pleasant notification tone (similar to iOS)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.1); // E6 note

      // Envelope: quick attack, gentle decay
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.02); // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Gentle decay

      // Play the sound
      oscillator.start(now);
      oscillator.stop(now + 0.35);

      // Add a subtle second tone for richness (harmony)
      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);

      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1320, now + 0.05); // E6
      oscillator2.frequency.exponentialRampToValueAtTime(1760, now + 0.15); // A6

      gainNode2.gain.setValueAtTime(0, now + 0.05);
      gainNode2.gain.linearRampToValueAtTime(this.volume * 0.5, now + 0.07);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      oscillator2.start(now + 0.05);
      oscillator2.stop(now + 0.45);

    } catch (error) {
      // Silently fail - sound is a nice-to-have, not critical
      console.debug('Could not play notification sound:', error);
    }
  }

  /**
   * Enable or disable notification sounds
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    // Store preference
    try {
      localStorage.setItem('notification_sound_enabled', String(enabled));
    } catch {}
  }

  /**
   * Check if sounds are enabled
   */
  getEnabled(): boolean {
    try {
      const stored = localStorage.getItem('notification_sound_enabled');
      if (stored !== null) {
        this.isEnabled = stored === 'true';
      }
    } catch {}
    return this.isEnabled;
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}
