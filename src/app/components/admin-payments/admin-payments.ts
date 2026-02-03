import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/utils/error-handler';
import { ThemeService } from '../../core/services/theme.service';
import * as XLSX from 'xlsx';

interface PaymentClient {
  id: string;
  name: string;
  email: string;
  federalTaxes: number;
  stateTaxes: number;
  totalTaxes: number;
  federalCommission: number;
  stateCommission: number;
  totalCommission: number;
  clientReceives: number;
  federalDepositDate: string | null;
  stateDepositDate: string | null;
  paymentReceived: boolean;
  commissionPaid: boolean;
  // New confirmation fields
  federalRefundReceived?: boolean;
  stateRefundReceived?: boolean;
  federalRefundReceivedAt?: string | null;
  stateRefundReceivedAt?: string | null;
  federalCommissionPaid?: boolean;
  stateCommissionPaid?: boolean;
}

interface UnpaidClient {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  taxYear: number;
  federal: {
    refundAmount: number;
    commission: number;
    refundReceived: boolean;
    refundReceivedAt: string | null;
    commissionPaid: boolean;
    commissionPaidAt: string | null;
  };
  state: {
    refundAmount: number;
    commission: number;
    refundReceived: boolean;
    refundReceivedAt: string | null;
    commissionPaid: boolean;
    commissionPaidAt: string | null;
  };
  totalUnpaidCommission: number;
}

interface UnpaidTotals {
  unpaidFederalCommission: number;
  unpaidStateCommission: number;
  totalUnpaidCommission: number;
  clientCount: number;
}

interface UnpaidCommissionsResponse {
  clients: UnpaidClient[];
  nextCursor: string | null;
  hasMore: boolean;
  totals: UnpaidTotals;
}

interface PaymentsTotals {
  federalTaxes: number;
  stateTaxes: number;
  totalTaxes: number;
  federalCommission: number;
  stateCommission: number;
  totalCommission: number;
  clientReceives: number;
}

interface PaymentsSummaryResponse {
  clients: PaymentClient[];
  nextCursor: string | null;
  hasMore: boolean;
  totals: PaymentsTotals;
}

@Component({
  selector: 'app-admin-payments',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPayments implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private subscriptions = new Subscription();

  get darkMode() { return this.themeService.darkMode(); }

  // Tab state
  activeTab: 'all' | 'unpaid' = 'all';

  // All payments data
  clients: PaymentClient[] = [];
  filteredClients: PaymentClient[] = [];
  searchQuery: string = '';
  totals: PaymentsTotals = {
    federalTaxes: 0,
    stateTaxes: 0,
    totalTaxes: 0,
    federalCommission: 0,
    stateCommission: 0,
    totalCommission: 0,
    clientReceives: 0
  };
  nextCursor: string | null = null;
  hasMore: boolean = false;

  // Unpaid commissions data
  unpaidClients: UnpaidClient[] = [];
  filteredUnpaidClients: UnpaidClient[] = [];
  unpaidSearchQuery: string = '';
  unpaidTotals: UnpaidTotals = {
    unpaidFederalCommission: 0,
    unpaidStateCommission: 0,
    totalUnpaidCommission: 0,
    clientCount: 0
  };
  unpaidNextCursor: string | null = null;
  unpaidHasMore: boolean = false;
  unpaidHasLoaded: boolean = false;

  // UI state
  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';
  isExporting: boolean = false;
  markingPaidClientId: string | null = null;
  markingPaidType: 'federal' | 'state' | null = null;

  // Help banner
  showHelp: boolean = false;

  ngOnInit() {
    this.loadPaymentsSummary();
  }

  // ===== TAB METHODS =====

  switchTab(tab: 'all' | 'unpaid') {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.errorMessage = '';

    if (tab === 'unpaid' && !this.unpaidHasLoaded) {
      this.loadUnpaidCommissions();
    }
    this.cdr.detectChanges();
  }

  loadPaymentsSummary() {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.http.get<PaymentsSummaryResponse>(`${environment.apiUrl}/admin/payments?limit=500`).subscribe({
        next: (response) => {
          this.clients = response.clients;
          this.filteredClients = this.clients;
          this.totals = response.totals;
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading payments summary:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar resumen de pagos');
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadMorePayments() {
    if (!this.hasMore || this.isLoadingMore || !this.nextCursor) return;

    this.isLoadingMore = true;

    this.subscriptions.add(
      this.http.get<PaymentsSummaryResponse>(
        `${environment.apiUrl}/admin/payments?cursor=${this.nextCursor}&limit=500`
      ).subscribe({
        next: (response) => {
          this.clients = [...this.clients, ...response.clients];
          this.filteredClients = this.searchQuery ? this.filteredClients : this.clients;
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading more payments:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar mas pagos');
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // ===== UNPAID COMMISSIONS METHODS =====

  loadUnpaidCommissions() {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.http.get<UnpaidCommissionsResponse>(`${environment.apiUrl}/admin/clients/unpaid-commissions?limit=100`).subscribe({
        next: (response) => {
          this.unpaidClients = response.clients;
          this.filteredUnpaidClients = this.unpaidClients;
          this.unpaidTotals = response.totals;
          this.unpaidNextCursor = response.nextCursor;
          this.unpaidHasMore = response.hasMore;
          this.isLoading = false;
          this.unpaidHasLoaded = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading unpaid commissions:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar comisiones pendientes');
          this.isLoading = false;
          this.unpaidHasLoaded = true;
          this.cdr.detectChanges();
        }
      })
    );
  }

  filterUnpaidByName() {
    const query = this.unpaidSearchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredUnpaidClients = this.unpaidClients;
    } else {
      this.filteredUnpaidClients = this.unpaidClients.filter(client =>
        client.name.toLowerCase().includes(query) || client.email.toLowerCase().includes(query)
      );
    }
    this.cdr.detectChanges();
  }

  markCommissionPaid(clientId: string, type: 'federal' | 'state', event: Event) {
    event.stopPropagation(); // Prevent row click

    if (this.markingPaidClientId) return; // Already processing

    this.markingPaidClientId = clientId;
    this.markingPaidType = type;
    this.cdr.detectChanges();

    this.subscriptions.add(
      this.http.post<{ message: string; commissionAmount: number }>(
        `${environment.apiUrl}/admin/clients/${clientId}/commission`,
        { type }
      ).subscribe({
        next: (response) => {
          // Update local data
          const client = this.unpaidClients.find(c => c.id === clientId);
          if (client) {
            if (type === 'federal') {
              client.federal.commissionPaid = true;
              client.federal.commissionPaidAt = new Date().toISOString();
              client.totalUnpaidCommission -= client.federal.commission;
              this.unpaidTotals.unpaidFederalCommission -= client.federal.commission;
            } else {
              client.state.commissionPaid = true;
              client.state.commissionPaidAt = new Date().toISOString();
              client.totalUnpaidCommission -= client.state.commission;
              this.unpaidTotals.unpaidStateCommission -= client.state.commission;
            }
            this.unpaidTotals.totalUnpaidCommission -= response.commissionAmount;

            // Remove client from list if both commissions are now paid
            if (
              (!client.federal.refundReceived || client.federal.commissionPaid) &&
              (!client.state.refundReceived || client.state.commissionPaid)
            ) {
              this.unpaidClients = this.unpaidClients.filter(c => c.id !== clientId);
              this.filteredUnpaidClients = this.filteredUnpaidClients.filter(c => c.id !== clientId);
              this.unpaidTotals.clientCount--;
            }
          }

          this.markingPaidClientId = null;
          this.markingPaidType = null;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error marking commission as paid:', error);
          this.errorMessage = getErrorMessage(error, 'Error al marcar comision como pagada');
          this.markingPaidClientId = null;
          this.markingPaidType = null;
          this.cdr.detectChanges();
        }
      })
    );
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    const first = parts[0]?.charAt(0)?.toUpperCase() || '?';
    const last = parts[1]?.charAt(0)?.toUpperCase() || '';
    return first + last;
  }

  getPaymentStatusClass(client: PaymentClient): string {
    if (client.commissionPaid) return 'status-paid';
    if (client.federalDepositDate || client.stateDepositDate) return 'status-deposited';
    return 'status-pending';
  }

  getPaymentStatusLabel(client: PaymentClient): string {
    if (client.commissionPaid) return 'Comision Pagada';
    if (client.federalDepositDate || client.stateDepositDate) return 'Deposito Recibido';
    return 'Pendiente';
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
    this.cdr.detectChanges();
  }

  viewClient(clientId: string) {
    this.router.navigate(['/admin/client', clientId]);
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.searchQuery = '';
    this.loadPaymentsSummary();
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
      'Email': client.email,
      'Federal Taxes': client.federalTaxes,
      'State Taxes': client.stateTaxes,
      'Total Taxes': client.totalTaxes,
      'Comision Federal': client.federalCommission,
      'Comision Estatal': client.stateCommission,
      'Total Comision': client.totalCommission,
      'Cliente Recibe': client.clientReceives,
      'Estado': this.getPaymentStatusLabel(client)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
    XLSX.writeFile(wb, `pagos-${new Date().toISOString().split('T')[0]}.xlsx`);

    this.isExporting = false;
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
