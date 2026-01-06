import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, delay } from 'rxjs';
import { StorageService } from './storage.service';

export interface ReferralData {
  code: string;
  referralCount: number;
  totalEarnings: number;
  referrals: ReferralRecord[];
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  name: string;
  date: string;
  status: 'pending' | 'completed';
  reward: number;
}

export interface RewardTier {
  tier: number;
  referralsRequired: number;
  reward: string;
  rewardAmount: number;
  description: string;
  icon: string;
}

const REFERRAL_STORAGE_KEY = 'jai1_referral_data';

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private storageService = inject(StorageService);

  private referralDataSubject = new BehaviorSubject<ReferralData | null>(this.loadFromStorage());
  referralData$ = this.referralDataSubject.asObservable();

  // Reward tiers
  readonly rewardTiers: RewardTier[] = [
    {
      tier: 1,
      referralsRequired: 1,
      reward: '$15 USD',
      rewardAmount: 15,
      description: 'Por tu primer referido',
      icon: '🌟'
    },
    {
      tier: 2,
      referralsRequired: 3,
      reward: '$50 USD',
      rewardAmount: 50,
      description: 'Al alcanzar 3 referidos',
      icon: '🔥'
    },
    {
      tier: 3,
      referralsRequired: 5,
      reward: '$100 USD',
      rewardAmount: 100,
      description: 'Al alcanzar 5 referidos',
      icon: '💎'
    },
    {
      tier: 4,
      referralsRequired: 10,
      reward: '$250 USD',
      rewardAmount: 250,
      description: 'Al alcanzar 10 referidos',
      icon: '👑'
    },
    {
      tier: 5,
      referralsRequired: 25,
      reward: '$750 USD + VIP',
      rewardAmount: 750,
      description: 'Jaigent VIP - 25 referidos',
      icon: '🏆'
    }
  ];

  private loadFromStorage(): ReferralData | null {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  private saveToStorage(data: ReferralData): void {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(data));
    this.referralDataSubject.next(data);
  }

  // Generate unique code based on user data
  generateReferralCode(userId: string, firstName: string): string {
    const prefix = firstName.substring(0, 3).toUpperCase();
    const suffix = userId.substring(0, 4).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${suffix}${random}`;
  }

  // Check if user has a referral code (only after tax return is submitted)
  hasReferralCode(): boolean {
    return this.referralDataSubject.value !== null;
  }

  // Get referral data
  getReferralData(): ReferralData | null {
    return this.referralDataSubject.value;
  }

  // Initialize referral code after user submits their tax return
  initializeReferralCode(userId: string, firstName: string): Observable<ReferralData> {
    const existingData = this.getReferralData();
    if (existingData) {
      return of(existingData);
    }

    const code = this.generateReferralCode(userId, firstName);
    const data: ReferralData = {
      code,
      referralCount: 0,
      totalEarnings: 0,
      referrals: [],
      createdAt: new Date().toISOString()
    };

    this.saveToStorage(data);
    return of(data).pipe(delay(500)); // Simulate API delay
  }

  // Get current tier based on referral count
  getCurrentTier(referralCount: number): RewardTier | null {
    let currentTier: RewardTier | null = null;
    for (const tier of this.rewardTiers) {
      if (referralCount >= tier.referralsRequired) {
        currentTier = tier;
      }
    }
    return currentTier;
  }

  // Get next tier
  getNextTier(referralCount: number): RewardTier | null {
    for (const tier of this.rewardTiers) {
      if (referralCount < tier.referralsRequired) {
        return tier;
      }
    }
    return null;
  }

  // Progress to next tier (percentage)
  getProgressToNextTier(referralCount: number): number {
    const nextTier = this.getNextTier(referralCount);
    if (!nextTier) return 100;

    const currentTier = this.getCurrentTier(referralCount);
    const currentThreshold = currentTier ? currentTier.referralsRequired : 0;
    const nextThreshold = nextTier.referralsRequired;

    const progress = ((referralCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  // Add a demo referral (for testing)
  addDemoReferral(): void {
    const data = this.getReferralData();
    if (!data) return;

    const names = ['María García', 'Carlos López', 'Ana Martínez', 'Juan Rodriguez', 'Laura Pérez'];
    const randomName = names[Math.floor(Math.random() * names.length)];

    const newReferral: ReferralRecord = {
      id: `ref_${Date.now()}`,
      name: randomName,
      date: new Date().toISOString(),
      status: 'completed',
      reward: 15
    };

    data.referrals.push(newReferral);
    data.referralCount = data.referrals.filter(r => r.status === 'completed').length;

    // Calculate total earnings based on tiers reached
    let earnings = 0;
    for (const tier of this.rewardTiers) {
      if (data.referralCount >= tier.referralsRequired) {
        earnings = tier.rewardAmount;
      }
    }
    data.totalEarnings = earnings;

    this.saveToStorage(data);
  }

  // Copy referral code to clipboard
  copyCodeToClipboard(): Promise<boolean> {
    const data = this.getReferralData();
    if (!data) return Promise.resolve(false);

    return navigator.clipboard.writeText(data.code)
      .then(() => true)
      .catch(() => false);
  }

  // Get share message
  getShareMessage(): string {
    const data = this.getReferralData();
    if (!data) return '';

    return `¡Usa mi código ${data.code} en JAI1 y obtén $11 de descuento en tu declaración de taxes! 🎉 https://jai1.app`;
  }

  // Clear referral data (for testing)
  clearReferralData(): void {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    this.referralDataSubject.next(null);
  }
}
