import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.css'
})
export class AdminPayments implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  clients: PaymentClient[] = [];
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

  ngOnInit() {
    this.loadPaymentsSummary();
  }

  loadPaymentsSummary() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<PaymentsSummaryResponse>(`${environment.apiUrl}/admin/payments`).subscribe({
      next: (response) => {
        this.clients = response.clients;
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

  viewClient(clientId: string) {
    this.router.navigate(['/admin/client', clientId]);
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.loadPaymentsSummary();
  }
}
