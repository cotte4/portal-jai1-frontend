import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/utils/error-handler';
import * as XLSX from 'xlsx';

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
  nextCursor: string | null;
  hasMore: boolean;
}

@Component({
  selector: 'app-admin-referrals',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-referrals.html',
  styleUrl: './admin-referrals.css'
})
export class AdminReferrals implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  referrers: ReferrerSummary[] = [];
  filteredReferrers: ReferrerSummary[] = [];
  searchQuery: string = '';
  total: number = 0;
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';
  isExporting: boolean = false;

  // Pagination state
  nextCursor: string | null = null;
  hasMore: boolean = false;
  isLoadingMore: boolean = false;

  ngOnInit() {
    this.loadReferralSummary();
  }

  loadReferralSummary() {
    this.isLoading = true;
    this.errorMessage = '';
    // Reset pagination state on fresh load
    this.nextCursor = null;
    this.hasMore = false;

    this.subscriptions.add(
      this.http.get<ReferralSummaryResponse>(`${environment.apiUrl}/referrals/admin/summary`).subscribe({
        next: (response) => {
          this.referrers = response.referrers;
          this.filteredReferrers = this.referrers;
          this.total = response.total;
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading referral summary:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar resumen de referidos');
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadMoreReferrers() {
    if (this.isLoadingMore || !this.hasMore || !this.nextCursor) return;

    this.isLoadingMore = true;

    const params = new URLSearchParams();
    params.set('cursor', this.nextCursor);

    this.subscriptions.add(
      this.http.get<ReferralSummaryResponse>(`${environment.apiUrl}/referrals/admin/summary?${params.toString()}`).subscribe({
        next: (response) => {
          // Append new referrers to existing list
          this.referrers = [...this.referrers, ...response.referrers];
          // Re-apply filter if search is active
          if (this.searchQuery.trim()) {
            this.filterByName();
          } else {
            this.filteredReferrers = this.referrers;
          }
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading more referrers:', error);
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        }
      })
    );
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
    this.searchQuery = '';
    this.loadReferralSummary();
  }

  filterByName() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredReferrers = this.referrers;
    } else {
      this.filteredReferrers = this.referrers.filter(referrer =>
        referrer.name.toLowerCase().includes(query)
      );
    }
    this.cdr.detectChanges();
  }

  exportToExcel() {
    if (this.isExporting || this.referrers.length === 0) return;

    this.isExporting = true;

    const data = this.referrers.map((referrer, index) => ({
      'Ranking': index + 1,
      'Nombre': referrer.name,
      'Email': referrer.email,
      'Codigo': referrer.referralCode,
      'Referidos Exitosos': referrer.successfulReferrals,
      'Descuento': `${referrer.discountPercent}%`,
      'Tier': this.getTierLabel(referrer.tier)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Referidos');
    XLSX.writeFile(wb, `referidos-${new Date().toISOString().split('T')[0]}.xlsx`);

    this.isExporting = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // ===== TRACKBY FUNCTIONS =====

  trackByUserId(index: number, item: { userId: string }): string {
    return item.userId;
  }
}
