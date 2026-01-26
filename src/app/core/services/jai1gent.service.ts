import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

// ============= INTERFACES =============

export interface Jai1gentRegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  invite_code: string;
  phone?: string;
}

export interface Jai1gentRegisterResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  referral_code: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ValidateInviteCodeResponse {
  valid: boolean;
  message?: string;
}

export interface ValidateReferralCodeResponse {
  valid: boolean;
  jai1gentName?: string;
  jai1gentId?: string;
}

export interface Jai1gentTier {
  tierNumber: number;
  percent: number;
  min: number;
  max: number;
}

export interface Jai1gentStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_earnings: number;
  paid_earnings: number;
  unpaid_earnings: number;
}

export interface Jai1gentReferral {
  id: string;
  referred_name: string;
  status: 'pending' | 'taxes_filed' | 'completed' | 'expired';
  commission_amount: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface Jai1gentDashboardResponse {
  referral_code: string;
  stats: Jai1gentStats;
  tier: {
    current: Jai1gentTier;
    next: { nextTierAt: number; nextPercent: number } | null;
    all_tiers: Array<{
      tier_number: number;
      min_referrals: number;
      max_referrals: number | null;
      percent: number;
    }>;
  };
  recent_referrals: Jai1gentReferral[];
  payment_info: {
    payment_method: 'bank_transfer' | 'zelle' | null;
    has_payment_info: boolean;
  };
}

export interface UpdateProfileRequest {
  payment_method?: 'bank_transfer' | 'zelle';
  bank_name?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  zelle_email?: string;
  zelle_phone?: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string;
  created_at: string;
  used_by: { name: string; email: string } | null;
  used_at: string | null;
}

export interface Jai1gentListItem {
  id: string;
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  referral_code: string;
  is_active: boolean;
  stats: {
    total_referrals: number;
    completed_referrals: number;
    total_earnings: number;
    paid_earnings: number;
  };
  tier: Jai1gentTier;
  payment_method: 'bank_transfer' | 'zelle' | null;
  has_payment_info: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class Jai1gentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Cached dashboard data
  private dashboardSubject = new BehaviorSubject<Jai1gentDashboardResponse | null>(null);
  dashboard$ = this.dashboardSubject.asObservable();

  // ============= PUBLIC ENDPOINTS =============

  /**
   * Validate an invite code (for registration form)
   */
  validateInviteCode(code: string): Observable<ValidateInviteCodeResponse> {
    return this.http.get<ValidateInviteCodeResponse>(
      `${this.apiUrl}/jai1gents/validate-invite/${code}`
    ).pipe(
      catchError(() => of({ valid: false, message: 'Failed to validate code' }))
    );
  }

  /**
   * Validate a JAI1GENT referral code (for client registration)
   */
  validateReferralCode(code: string): Observable<ValidateReferralCodeResponse> {
    return this.http.get<ValidateReferralCodeResponse>(
      `${this.apiUrl}/jai1gents/validate-referral/${code}`
    ).pipe(
      catchError(() => of({ valid: false }))
    );
  }

  /**
   * Register as a new JAI1GENT
   */
  register(data: Jai1gentRegisterRequest): Observable<Jai1gentRegisterResponse> {
    return this.http.post<Jai1gentRegisterResponse>(
      `${this.apiUrl}/jai1gents/register`,
      data
    );
  }

  // ============= PROTECTED JAI1GENT ENDPOINTS =============

  /**
   * Get dashboard data
   */
  getDashboard(): Observable<Jai1gentDashboardResponse> {
    return this.http.get<Jai1gentDashboardResponse>(
      `${this.apiUrl}/jai1gents/dashboard`
    ).pipe(
      tap(response => this.dashboardSubject.next(response)),
      catchError((error) => {
        console.error('Failed to load dashboard:', error);
        throw error;
      })
    );
  }

  /**
   * Update profile (payment info)
   */
  updateProfile(data: UpdateProfileRequest): Observable<{ message: string; payment_method: string }> {
    return this.http.patch<{ message: string; payment_method: string }>(
      `${this.apiUrl}/jai1gents/profile`,
      data
    );
  }

  // ============= ADMIN ENDPOINTS =============

  /**
   * Generate invite codes (admin only)
   */
  generateInviteCodes(count: number): Observable<{ message: string; codes: string[] }> {
    return this.http.post<{ message: string; codes: string[] }>(
      `${this.apiUrl}/jai1gents/admin/invite-codes`,
      { count }
    );
  }

  /**
   * List invite codes (admin only)
   */
  listInviteCodes(options?: {
    status?: 'used' | 'unused' | 'all';
    limit?: number;
    offset?: number;
  }): Observable<{ codes: InviteCode[]; total: number; unused_count: number }> {
    const params: any = {};
    if (options?.status) params.status = options.status;
    if (options?.limit) params.limit = options.limit.toString();
    if (options?.offset) params.offset = options.offset.toString();

    return this.http.get<{ codes: InviteCode[]; total: number; unused_count: number }>(
      `${this.apiUrl}/jai1gents/admin/invite-codes`,
      { params }
    );
  }

  /**
   * List all JAI1GENTS (admin only)
   */
  listJai1gents(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ jai1gents: Jai1gentListItem[]; total: number }> {
    const params: any = {};
    if (options?.search) params.search = options.search;
    if (options?.limit) params.limit = options.limit.toString();
    if (options?.offset) params.offset = options.offset.toString();

    return this.http.get<{ jai1gents: Jai1gentListItem[]; total: number }>(
      `${this.apiUrl}/jai1gents/admin/list`,
      { params }
    );
  }

  // ============= HELPER METHODS =============

  /**
   * Get status label in Spanish
   */
  getStatusLabel(status: Jai1gentReferral['status']): string {
    const labels: Record<Jai1gentReferral['status'], string> = {
      pending: 'Pendiente',
      taxes_filed: 'Taxes presentados',
      completed: 'Completado',
      expired: 'Expirado'
    };
    return labels[status] || status;
  }

  /**
   * Get status color class
   */
  getStatusColor(status: Jai1gentReferral['status']): string {
    const colors: Record<Jai1gentReferral['status'], string> = {
      pending: 'status-pending',
      taxes_filed: 'status-in-progress',
      completed: 'status-completed',
      expired: 'status-expired'
    };
    return colors[status] || '';
  }

  /**
   * Copy referral code to clipboard
   */
  async copyReferralCode(): Promise<boolean> {
    const code = this.dashboardSubject.value?.referral_code;
    if (!code) return false;

    try {
      await navigator.clipboard.writeText(code);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get share message
   */
  getShareMessage(): string {
    const code = this.dashboardSubject.value?.referral_code;
    if (!code) return '';
    return `Usa mi codigo ${code} en JAI1 para tu declaracion de taxes! https://jai1.app`;
  }

  /**
   * Clear cached data (on logout)
   */
  clearCache(): void {
    this.dashboardSubject.next(null);
  }
}
