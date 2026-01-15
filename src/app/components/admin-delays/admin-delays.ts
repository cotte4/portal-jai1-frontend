import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TaxStatus } from '../../core/models';
import * as XLSX from 'xlsx';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-delays.html',
  styleUrl: './admin-delays.css'
})
export class AdminDelays implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  clients: DelayClient[] = [];
  filteredClients: DelayClient[] = [];
  clientCount: number = 0;
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';
  isExporting: boolean = false;
  searchQuery: string = '';

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

    this.subscriptions.add(
      this.http.get<DelaysResponse>(`${environment.apiUrl}/admin/delays`).subscribe({
        next: (response) => {
          this.clients = response.clients;
          this.filteredClients = this.clients;
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
      })
    );
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
    this.searchQuery = '';
    this.loadDelaysData();
  }

  filterByName() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredClients = this.clients;
    } else {
      this.filteredClients = this.clients.filter(client =>
        client.name.toLowerCase().includes(query)
      );
    }
    this.cdr.detectChanges();
  }

  exportToExcel() {
    if (this.isExporting || this.clients.length === 0) return;

    this.isExporting = true;

    const data = this.clients.map(client => ({
      'Nombre': client.name,
      'Docs Completos': client.documentationCompleteDate ? this.formatDate(client.documentationCompleteDate) : '---',
      'Presentacion': client.taxesFiledAt ? this.formatDate(client.taxesFiledAt) : '---',
      'Recibo Federal': client.federalDepositDate ? this.formatDate(client.federalDepositDate) : '---',
      'Recibo Estatal': client.stateDepositDate ? this.formatDate(client.stateDepositDate) : '---',
      'Verificacion': client.wentThroughVerification ? 'Si' : 'No',
      'Demora Federal': client.federalDelayDays ?? '---',
      'Demora Estatal': client.stateDelayDays ?? '---'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Demoras');
    XLSX.writeFile(wb, `demoras-${new Date().toISOString().split('T')[0]}.xlsx`);

    this.isExporting = false;
    this.cdr.detectChanges();
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
    this.filterByName();
  }

  private applySorting() {
    if (!this.sortField) return;

    this.filteredClients = [...this.filteredClients].sort((a, b) => {
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

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }
}
