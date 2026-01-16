import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminClientListResponse,
  AdminClientDetail,
  UpdateStatusRequest,
  ClientStatusFilter,
  StatusAlarm,
  AlarmDashboardResponse,
  AlarmHistoryItem,
  AlarmType,
  AlarmLevel,
  AlarmResolution,
  ThresholdsResponse,
  SetThresholdsRequest
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

// NEW STATUS SYSTEM (v2): Alarms response
export interface AlarmsResponse {
  clients: {
    id: string;
    name: string;
    alarms: StatusAlarm[];
    federalStatusNew: string | null;
    stateStatusNew: string | null;
    federalStatusNewChangedAt: string | null;
    stateStatusNewChangedAt: string | null;
  }[];
  totalWithAlarms: number;
  totalCritical: number;
  totalWarning: number;
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
   *   - Or undefined/'all' for no filter
   */
  getClients(
    status?: Exclude<ClientStatusFilter, 'all'>,
    search?: string,
    cursor?: string,
    limit = 20
  ): Observable<AdminClientListResponse> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (status) params['status'] = status;
    if (search) params['search'] = search;
    if (cursor) params['cursor'] = cursor;

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

  // NEW STATUS SYSTEM (v2): Get clients with alarms (deprecated - use getAlarmDashboard)
  getClientsWithAlarms(): Observable<AlarmsResponse> {
    return this.http.get<AlarmsResponse>(`${this.apiUrl}/admin/alarms`).pipe(
      catchError(this.handleError)
    );
  }

  // ============= ALARM DASHBOARD =============

  /**
   * Get alarm dashboard with all cases that have active alarms
   */
  getAlarmDashboard(): Observable<AlarmDashboardResponse> {
    return this.http.get<AlarmDashboardResponse>(`${this.apiUrl}/admin/alarms/dashboard`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get alarm history with optional filters
   */
  getAlarmHistory(filters?: {
    taxCaseId?: string;
    alarmType?: AlarmType;
    alarmLevel?: AlarmLevel;
    resolution?: AlarmResolution;
    track?: 'federal' | 'state';
    fromDate?: string;
    toDate?: string;
  }): Observable<AlarmHistoryItem[]> {
    const params: Record<string, string> = {};
    if (filters?.taxCaseId) params['taxCaseId'] = filters.taxCaseId;
    if (filters?.alarmType) params['alarmType'] = filters.alarmType;
    if (filters?.alarmLevel) params['alarmLevel'] = filters.alarmLevel;
    if (filters?.resolution) params['resolution'] = filters.resolution;
    if (filters?.track) params['track'] = filters.track;
    if (filters?.fromDate) params['fromDate'] = filters.fromDate;
    if (filters?.toDate) params['toDate'] = filters.toDate;

    return this.http.get<AlarmHistoryItem[]>(`${this.apiUrl}/admin/alarms/history`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Acknowledge an alarm (mark as seen)
   */
  acknowledgeAlarm(alarmId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/${alarmId}/acknowledge`, {}).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Resolve an alarm with optional note
   */
  resolveAlarm(alarmId: string, note?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/${alarmId}/resolve`, { note }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get thresholds for a tax case (custom or defaults)
   */
  getAlarmThresholds(taxCaseId: string): Observable<ThresholdsResponse> {
    return this.http.get<ThresholdsResponse>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Set custom thresholds for a tax case
   */
  setAlarmThresholds(taxCaseId: string, thresholds: SetThresholdsRequest): Observable<ThresholdsResponse> {
    return this.http.patch<ThresholdsResponse>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`, thresholds).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Delete custom thresholds (revert to defaults)
   */
  deleteAlarmThresholds(taxCaseId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Manually sync alarms for a tax case
   */
  syncAlarms(taxCaseId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/sync/${taxCaseId}`, {}).pipe(
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

  // ============= MISSING DOCUMENTS CHECK =============

  /**
   * Trigger check for missing documents and send notifications to clients
   * @param daysThreshold - Days since registration before sending reminder (default: 3)
   * @param maxNotifications - Max notifications per client (default: 3)
   */
  checkMissingDocuments(daysThreshold = 3, maxNotifications = 3): Observable<{ message: string; notified: number; skipped: number }> {
    const params: Record<string, string> = {
      daysThreshold: daysThreshold.toString(),
      maxNotifications: maxNotifications.toString()
    };
    return this.http.post<{ message: string; notified: number; skipped: number }>(
      `${this.apiUrl}/admin/progress/check-missing-documents`,
      {},
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Send missing documents notification to a specific client
   */
  sendMissingDocsNotification(userId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/admin/progress/send-missing-docs-notification`,
      { userId }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get the status of the missing docs cron job
   */
  getMissingDocsCronStatus(): Observable<{ enabled: boolean; lastUpdated: string | null }> {
    return this.http.get<{ enabled: boolean; lastUpdated: string | null }>(
      `${this.apiUrl}/admin/progress/cron/missing-docs/status`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Enable or disable the missing docs cron job
   */
  setMissingDocsCronStatus(enabled: boolean): Observable<{ enabled: boolean }> {
    return this.http.patch<{ enabled: boolean }>(
      `${this.apiUrl}/admin/progress/cron/missing-docs/status`,
      { enabled }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Admin error:', error);
    return throwError(() => error);
  }
}
