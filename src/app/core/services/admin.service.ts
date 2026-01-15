import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminClientListResponse,
  AdminClientDetail,
  UpdateStatusRequest
} from '../models';

export interface SeasonStats {
  totalClients: number;
  taxesCompletedPercent: number;
  projectedEarnings: number;
  earningsToDate: number;
}

export interface PaymentClient {
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

export interface PaymentsTotals {
  federalTaxes: number;
  stateTaxes: number;
  totalTaxes: number;
  federalCommission: number;
  stateCommission: number;
  totalCommission: number;
  clientReceives: number;
}

export interface PaymentsSummaryResponse {
  clients: PaymentClient[];
  totals: PaymentsTotals;
  clientCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Get clients with server-side filtering
   * @param status - Can be a special filter string:
   *   - 'group_pending', 'group_in_review', 'group_completed', 'group_needs_attention'
   *   - 'ready_to_present', 'incomplete'
   */
  getClients(
    status?: string,
    search?: string,
    cursor?: string,
    limit = 20
  ): Observable<AdminClientListResponse> {
    const params: any = { limit: limit.toString() };
    if (status) params.status = status;
    if (search) params.search = search;
    if (cursor) params.cursor = cursor;

    return this.http.get<AdminClientListResponse>(`${this.apiUrl}/admin/clients`, { params }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  getClient(clientId: string): Observable<AdminClientDetail> {
    return this.http.get<AdminClientDetail>(
      `${this.apiUrl}/admin/clients/${clientId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateClient(clientId: string, data: Partial<AdminClientDetail>): Observable<AdminClientDetail> {
    return this.http.patch<AdminClientDetail>(
      `${this.apiUrl}/admin/clients/${clientId}`,
      data
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateStatus(clientId: string, data: UpdateStatusRequest): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/admin/clients/${clientId}/status`,
      data
    ).pipe(
      catchError(this.handleError)
    );
  }

  markPaid(clientId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/admin/clients/${clientId}/mark-paid`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  deleteClient(clientId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/clients/${clientId}`).pipe(
      catchError(this.handleError)
    );
  }

  exportToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/admin/clients/export`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  getSeasonStats(): Observable<SeasonStats> {
    return this.http.get<SeasonStats>(`${this.apiUrl}/admin/stats/season`).pipe(
      catchError(this.handleError)
    );
  }

  getPaymentsSummary(): Observable<PaymentsSummaryResponse> {
    return this.http.get<PaymentsSummaryResponse>(`${this.apiUrl}/admin/payments`).pipe(
      catchError(this.handleError)
    );
  }

  // DEPRECATED: updateAdminStep removed - use updateStatus with internalStatus instead

  setProblem(
    clientId: string,
    problemData: {
      hasProblem: boolean;
      problemType?: string;
      problemDescription?: string;
    }
  ): Observable<{ message: string; hasProblem: boolean }> {
    return this.http.patch<{ message: string; hasProblem: boolean }>(
      `${this.apiUrl}/admin/clients/${clientId}/problem`,
      problemData
    ).pipe(
      catchError(this.handleError)
    );
  }

  sendClientNotification(
    clientId: string,
    notifyData: {
      title: string;
      message: string;
      sendEmail?: boolean;
    }
  ): Observable<{ message: string; emailSent: boolean }> {
    return this.http.post<{ message: string; emailSent: boolean }>(
      `${this.apiUrl}/admin/clients/${clientId}/notify`,
      notifyData
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Admin error:', error);
    return throwError(() => error);
  }
}
