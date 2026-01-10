import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, tap, map, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';

// API Response interfaces
export interface ReferralCodeResponse {
  code: string | null;
  isEligible: boolean;
  createdAt: string | null;
}

export interface ReferralRecord {
  id: string;
  referredUser: {
    firstName: string;
    lastName: string;
  };
  status: 'pending' | 'tax_form_submitted' | 'awaiting_refund' | 'successful' | 'expired';
  createdAt: string;
  completedAt: string | null;
}

export interface DiscountInfo {
  successfulReferrals: number;
  pendingReferrals: number;
  currentDiscountPercent: number;
  nextTierAt: number;
  discountTiers: Array<{ min: number; percent: number }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  profilePicturePath: string | null;
  successfulReferrals: number;
  currentTier: number;
}

export interface ValidateCodeResponse {
  valid: boolean;
  referrerName?: string;
  referrerId?: string;
}

export interface RewardTier {
  tier: number;
  referralsRequired: number;
  reward: string;
  discountPercent: number;
  description: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Cached data subjects
  private myCodeSubject = new BehaviorSubject<ReferralCodeResponse | null>(null);
  private myReferralsSubject = new BehaviorSubject<ReferralRecord[]>([]);
  private myDiscountSubject = new BehaviorSubject<DiscountInfo | null>(null);
  private leaderboardSubject = new BehaviorSubject<LeaderboardEntry[]>([]);

  myCode$ = this.myCodeSubject.asObservable();
  myReferrals$ = this.myReferralsSubject.asObservable();
  myDiscount$ = this.myDiscountSubject.asObservable();
  leaderboard$ = this.leaderboardSubject.asObservable();

  // Reward tiers (matching backend)
  readonly rewardTiers: RewardTier[] = [
    {
      tier: 1,
      referralsRequired: 1,
      reward: '5% descuento',
      discountPercent: 5,
      description: 'Por tu primer referido exitoso',
      icon: '1'
    },
    {
      tier: 2,
      referralsRequired: 2,
      reward: '10% descuento',
      discountPercent: 10,
      description: 'Al alcanzar 2 referidos',
      icon: '2'
    },
    {
      tier: 3,
      referralsRequired: 3,
      reward: '20% descuento',
      discountPercent: 20,
      description: 'Al alcanzar 3 referidos',
      icon: '3'
    },
    {
      tier: 4,
      referralsRequired: 4,
      reward: '30% descuento',
      discountPercent: 30,
      description: 'Al alcanzar 4 referidos',
      icon: '4'
    },
    {
      tier: 5,
      referralsRequired: 5,
      reward: '50% descuento',
      discountPercent: 50,
      description: 'Al alcanzar 5 referidos',
      icon: '5'
    },
    {
      tier: 6,
      referralsRequired: 6,
      reward: '75% descuento',
      discountPercent: 75,
      description: 'Al alcanzar 6 referidos',
      icon: '6'
    },
    {
      tier: 7,
      referralsRequired: 7,
      reward: '100% GRATIS',
      discountPercent: 100,
      description: 'Al alcanzar 7+ referidos',
      icon: '7'
    }
  ];

  // === PUBLIC API CALLS ===

  /**
   * Validate a referral code (public - for registration)
   */
  validateCode(code: string): Observable<ValidateCodeResponse> {
    return this.http.get<ValidateCodeResponse>(`${this.apiUrl}/referrals/validate/${code}`).pipe(
      catchError(() => of({ valid: false }))
    );
  }

  // === PROTECTED API CALLS ===

  /**
   * Get current user's referral code
   */
  getMyCode(): Observable<ReferralCodeResponse> {
    return this.http.get<ReferralCodeResponse>(`${this.apiUrl}/referrals/my-code`).pipe(
      tap(response => this.myCodeSubject.next(response)),
      catchError(() => of({ code: null, isEligible: false, createdAt: null }))
    );
  }

  /**
   * Get referrals made by current user
   */
  getMyReferrals(): Observable<ReferralRecord[]> {
    return this.http.get<ReferralRecord[]>(`${this.apiUrl}/referrals/my-referrals`).pipe(
      tap(response => this.myReferralsSubject.next(response)),
      catchError(() => of([]))
    );
  }

  /**
   * Get current user's discount info
   */
  getMyDiscount(): Observable<DiscountInfo> {
    return this.http.get<DiscountInfo>(`${this.apiUrl}/referrals/my-discount`).pipe(
      tap(response => this.myDiscountSubject.next(response)),
      catchError(() => of({
        successfulReferrals: 0,
        pendingReferrals: 0,
        currentDiscountPercent: 0,
        nextTierAt: 1,
        discountTiers: []
      }))
    );
  }

  /**
   * Get global leaderboard
   */
  getLeaderboard(limit = 10): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.apiUrl}/referrals/leaderboard?limit=${limit}`).pipe(
      tap(response => this.leaderboardSubject.next(response)),
      catchError(() => of([]))
    );
  }

  /**
   * Load all referral data at once
   */
  loadAllData(): Observable<{
    code: ReferralCodeResponse;
    referrals: ReferralRecord[];
    discount: DiscountInfo;
    leaderboard: LeaderboardEntry[];
  }> {
    return forkJoin({
      code: this.getMyCode(),
      referrals: this.getMyReferrals(),
      discount: this.getMyDiscount(),
      leaderboard: this.getLeaderboard()
    });
  }

  // === HELPER METHODS ===

  /**
   * Check if user has a referral code
   */
  hasReferralCode(): boolean {
    return this.myCodeSubject.value?.code !== null;
  }

  /**
   * Get current tier based on successful referral count
   */
  getCurrentTier(successfulCount: number): RewardTier | null {
    let currentTier: RewardTier | null = null;
    for (const tier of this.rewardTiers) {
      if (successfulCount >= tier.referralsRequired) {
        currentTier = tier;
      }
    }
    return currentTier;
  }

  /**
   * Get next tier
   */
  getNextTier(successfulCount: number): RewardTier | null {
    for (const tier of this.rewardTiers) {
      if (successfulCount < tier.referralsRequired) {
        return tier;
      }
    }
    return null;
  }

  /**
   * Progress to next tier (percentage)
   */
  getProgressToNextTier(successfulCount: number): number {
    const nextTier = this.getNextTier(successfulCount);
    if (!nextTier) return 100;

    const currentTier = this.getCurrentTier(successfulCount);
    const currentThreshold = currentTier ? currentTier.referralsRequired : 0;
    const nextThreshold = nextTier.referralsRequired;

    const progress = ((successfulCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  /**
   * Copy referral code to clipboard
   */
  copyCodeToClipboard(): Promise<boolean> {
    const code = this.myCodeSubject.value?.code;
    if (!code) return Promise.resolve(false);

    return navigator.clipboard.writeText(code)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Get share message
   */
  getShareMessage(): string {
    const code = this.myCodeSubject.value?.code;
    if (!code) return '';

    return `Usa mi codigo ${code} en JAI1 y obtén $11 de descuento en tu declaracion de taxes! https://jai1.app`;
  }

  /**
   * Get referral status label in Spanish
   */
  getStatusLabel(status: ReferralRecord['status']): string {
    const labels: Record<ReferralRecord['status'], string> = {
      pending: 'Pendiente',
      tax_form_submitted: 'Formulario enviado',
      awaiting_refund: 'Esperando reembolso',
      successful: 'Exitoso',
      expired: 'Expirado'
    };
    return labels[status] || status;
  }

  /**
   * Clear cached data (useful on logout)
   */
  clearCache(): void {
    this.myCodeSubject.next(null);
    this.myReferralsSubject.next([]);
    this.myDiscountSubject.next(null);
    this.leaderboardSubject.next([]);
  }
}
