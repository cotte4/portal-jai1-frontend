import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TaxStatus } from '../../core/models';

interface DelayClient {
  id: string;
  name: string;
  documentationCompleteDate: string | null;
  taxesFiledAt: string | null;
  federalDepositDate: string | null;
  stateDepositDate: string | null;
  wentThroughVerification: boolean;
  federalDelayDays: number | null;
  stateDelayDays: number | null;
  federalStatus: TaxStatus | null;
  stateStatus: TaxStatus | null;
}

interface DelaysResponse {
  clients: DelayClient[];
  clientCount: number;
}

@Component({
  selector: 'app-admin-delays',
  imports: [CommonModule],
  templateUrl: './admin-delays.html',
  styleUrl: './admin-delays.css'
})
export class AdminDelays implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  clients: DelayClient[] = [];
  clientCount: number = 0;
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';

  // Sorting
  sortField: 'name' | 'federalDelay' | 'stateDelay' | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  // Stats
  avgFederalDelay: number = 0;
  avgStateDelay: number = 0;
  verificationCount: number = 0;

  ngOnInit() {
    this.loadDelaysData();
  }

  loadDelaysData() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<DelaysResponse>(`${environment.apiUrl}/admin/delays`).subscribe({
      next: (response) => {
        this.clients = response.clients;
        this.clientCount = response.clientCount;
        this.calculateStats();
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading delays data:', error);
        this.errorMessage = error?.error?.message || 'Error al cargar datos de demoras';
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  calculateStats() {
    // Calculate average delays (only for clients with deposit dates)
    const federalDelays = this.clients
      .filter(c => c.federalDelayDays !== null)
      .map(c => c.federalDelayDays!);
    const stateDelays = this.clients
      .filter(c => c.stateDelayDays !== null)
      .map(c => c.stateDelayDays!);

    this.avgFederalDelay = federalDelays.length > 0
      ? Math.round(federalDelays.reduce((a, b) => a + b, 0) / federalDelays.length)
      : 0;

    this.avgStateDelay = stateDelays.length > 0
      ? Math.round(stateDelays.reduce((a, b) => a + b, 0) / stateDelays.length)
      : 0;

    this.verificationCount = this.clients.filter(c => c.wentThroughVerification).length;
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    const first = parts[0]?.charAt(0)?.toUpperCase() || '?';
    const last = parts[1]?.charAt(0)?.toUpperCase() || '';
    return first + last;
  }

  formatDate(date: string | null): string {
    if (!date) return '---';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  formatDays(days: number | null): string {
    if (days === null) return '---';
    return `${days} dias`;
  }

  getDelayClass(days: number | null): string {
    if (days === null) return '';
    if (days <= 14) return 'delay-fast';
    if (days <= 30) return 'delay-normal';
    return 'delay-slow';
  }

  viewClient(clientId: string) {
    this.router.navigate(['/admin/client', clientId]);
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.loadDelaysData();
  }

  // Sorting
  sortBy(field: 'name' | 'federalDelay' | 'stateDelay') {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'name' ? 'asc' : 'desc';
    }
    this.applySorting();
  }

  clearSort() {
    this.sortField = null;
    this.loadDelaysData();
  }

  private applySorting() {
    if (!this.sortField) return;

    this.clients = [...this.clients].sort((a, b) => {
      let comparison = 0;

      switch (this.sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'federalDelay':
          const fedA = a.federalDelayDays ?? -Infinity;
          const fedB = b.federalDelayDays ?? -Infinity;
          comparison = fedA - fedB;
          break;
        case 'stateDelay':
          const stateA = a.stateDelayDays ?? -Infinity;
          const stateB = b.stateDelayDays ?? -Infinity;
          comparison = stateA - stateB;
          break;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.cdr.detectChanges();
  }
}
