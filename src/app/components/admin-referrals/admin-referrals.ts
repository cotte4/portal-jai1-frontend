import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ReferrerSummary {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  successfulReferrals: number;
  discountPercent: number;
  tier: number;
}

interface ReferralSummaryResponse {
  referrers: ReferrerSummary[];
  total: number;
}

@Component({
  selector: 'app-admin-referrals',
  imports: [CommonModule],
  templateUrl: './admin-referrals.html',
  styleUrl: './admin-referrals.css'
})
export class AdminReferrals implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  referrers: ReferrerSummary[] = [];
  total: number = 0;
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';

  ngOnInit() {
    this.loadReferralSummary();
  }

  loadReferralSummary() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ReferralSummaryResponse>(`${environment.apiUrl}/referrals/admin/summary`).subscribe({
      next: (response) => {
        this.referrers = response.referrers;
        this.total = response.total;
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading referral summary:', error);
        this.errorMessage = error?.error?.message || 'Error al cargar resumen de referidos';
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  getTierLabel(tier: number): string {
    const labels: Record<number, string> = {
      1: 'Tier 1',
      2: 'Tier 2',
      3: 'Tier 3',
      4: 'Tier 4',
      5: 'Tier 5',
      6: 'Tier 6',
      7: 'Tier 7'
    };
    return labels[tier] || '-';
  }

  getTierClass(tier: number): string {
    const classes: Record<number, string> = {
      1: 'tier-bronze',
      2: 'tier-silver',
      3: 'tier-gold',
      4: 'tier-platinum',
      5: 'tier-diamond',
      6: 'tier-master',
      7: 'tier-legend'
    };
    return classes[tier] || '';
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    const first = parts[0]?.charAt(0)?.toUpperCase() || '?';
    const last = parts[1]?.charAt(0)?.toUpperCase() || '';
    return first + last;
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.loadReferralSummary();
  }
}
