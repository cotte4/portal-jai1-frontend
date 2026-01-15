import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
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
  totals: PaymentsTotals;
  clientCount: number;
}

@Component({
  selector: 'app-admin-payments',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.css'
})
export class AdminPayments implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

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
  clientCount: number = 0;
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';
  isExporting: boolean = false;

  ngOnInit() {
    this.loadPaymentsSummary();
  }

  loadPaymentsSummary() {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.http.get<PaymentsSummaryResponse>(`${environment.apiUrl}/admin/payments`).subscribe({
        next: (response) => {
          this.clients = response.clients;
          this.filteredClients = this.clients;
          this.totals = response.totals;
          this.clientCount = response.clientCount;
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading payments summary:', error);
          this.errorMessage = error?.error?.message || 'Error al cargar resumen de pagos';
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        }
      })
    );
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
