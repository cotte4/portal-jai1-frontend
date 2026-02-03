import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, shareReplay } from 'rxjs';
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
  SetThresholdsRequest,
  AdvancedFilters,
  ValidTransitionsResponse
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
   * Get clients with server-side filtering and sorting
   * @param status - Can be a special filter string:
   *   - 'group_pending', 'group_in_review', 'group_completed', 'group_needs_attention'
   *   - 'ready_to_present', 'incomplete'
   *   - Or undefined/'all' for no filter
   * @param filters - Advanced filters for date range, status, etc.
   * @param sortBy - Column to sort by (createdAt, name, email)
   * @param sortOrder - Sort direction (asc, desc)
   */
  getClients(
    status?: Exclude<ClientStatusFilter, 'all'>,
    search?: string,
    cursor?: string,
    limit = 20,
    filters?: AdvancedFilters,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Observable<AdminClientListResponse> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (status) params['status'] = status;
    if (search) params['search'] = search;
    if (cursor) params['cursor'] = cursor;

    // Sorting
    if (sortBy) params['sortBy'] = sortBy;
    if (sortOrder) params['sortOrder'] = sortOrder;

    // Advanced filters
    if (filters) {
      if (filters.hasProblem !== null && filters.hasProblem !== undefined) {
        params['hasProblem'] = filters.hasProblem.toString();
      }
      if (filters.federalStatus) {
        params['federalStatus'] = filters.federalStatus;
      }
      if (filters.stateStatus) {
        params['stateStatus'] = filters.stateStatus;
      }
      if (filters.caseStatus) {
        params['caseStatus'] = filters.caseStatus;
      }
      if (filters.dateFrom) {
        params['dateFrom'] = filters.dateFrom;
      }
      if (filters.dateTo) {
        params['dateTo'] = filters.dateTo;
      }
    }

    return this.http.get<AdminClientListResponse>(`${this.apiUrl}/admin/clients`, { params }).pipe(
      catchError((error) => this.handleError(error)),
      shareReplay(1)
    );
  }

  getClient(clientId: string): Observable<AdminClientDetail> {
    return this.http.get<AdminClientDetail>(
      `${this.apiUrl}/admin/clients/${clientId}`
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  updateClient(clientId: string, data: Partial<AdminClientDetail>): Observable<AdminClientDetail> {
    return this.http.patch<AdminClientDetail>(
      `${this.apiUrl}/admin/clients/${clientId}`,
      data
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
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

  /**
   * Get valid status transitions for a client
   */
  getValidTransitions(clientId: string): Observable<ValidTransitionsResponse> {
    return this.http.get<ValidTransitionsResponse>(
      `${this.apiUrl}/admin/clients/${clientId}/valid-transitions`
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  markPaid(clientId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/admin/clients/${clientId}/mark-paid`,
      {}
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  markCommissionPaid(clientId: string, track: 'federal' | 'state'): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/admin/clients/${clientId}/commission`,
      { type: track }
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  deleteClient(clientId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/clients/${clientId}`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  exportToExcel(
    status?: string,
    search?: string,
    filters?: AdvancedFilters
  ): Observable<Blob> {
    const params: Record<string, string> = {};

    // Status filter
    if (status && status !== 'all') {
      params['status'] = status;
    }

    // Search filter
    if (search) {
      params['search'] = search;
    }

    // Advanced filters
    if (filters) {
      if (filters.hasProblem !== null && filters.hasProblem !== undefined) {
        params['hasProblem'] = filters.hasProblem.toString();
      }
      if (filters.federalStatus) {
        params['federalStatus'] = filters.federalStatus;
      }
      if (filters.stateStatus) {
        params['stateStatus'] = filters.stateStatus;
      }
      if (filters.caseStatus) {
        params['caseStatus'] = filters.caseStatus;
      }
      if (filters.dateFrom) {
        params['dateFrom'] = filters.dateFrom;
      }
      if (filters.dateTo) {
        params['dateTo'] = filters.dateTo;
      }
    }

    return this.http.get(`${this.apiUrl}/admin/clients/export`, {
      responseType: 'blob',
      params
    }).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  getSeasonStats(): Observable<SeasonStats> {
    return this.http.get<SeasonStats>(`${this.apiUrl}/admin/stats/season`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  getPaymentsSummary(): Observable<PaymentsSummaryResponse> {
    return this.http.get<PaymentsSummaryResponse>(`${this.apiUrl}/admin/payments`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  // NEW STATUS SYSTEM (v2): Get clients with alarms (deprecated - use getAlarmDashboard)
  getClientsWithAlarms(): Observable<AlarmsResponse> {
    return this.http.get<AlarmsResponse>(`${this.apiUrl}/admin/alarms`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  // ============= ALARM DASHBOARD =============

  /**
   * Get alarm dashboard with all cases that have active alarms
   */
  getAlarmDashboard(): Observable<AlarmDashboardResponse> {
    return this.http.get<AlarmDashboardResponse>(`${this.apiUrl}/admin/alarms/dashboard`).pipe(
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Acknowledge an alarm (mark as seen)
   */
  acknowledgeAlarm(alarmId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/${alarmId}/acknowledge`, {}).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Resolve an alarm with optional note
   */
  resolveAlarm(alarmId: string, note?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/${alarmId}/resolve`, { note }).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Get thresholds for a tax case (custom or defaults)
   */
  getAlarmThresholds(taxCaseId: string): Observable<ThresholdsResponse> {
    return this.http.get<ThresholdsResponse>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Set custom thresholds for a tax case
   */
  setAlarmThresholds(taxCaseId: string, thresholds: SetThresholdsRequest): Observable<ThresholdsResponse> {
    return this.http.patch<ThresholdsResponse>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`, thresholds).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Delete custom thresholds (revert to defaults)
   */
  deleteAlarmThresholds(taxCaseId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/admin/alarms/thresholds/${taxCaseId}`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Manually sync alarms for a tax case
   */
  syncAlarms(taxCaseId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/admin/alarms/sync/${taxCaseId}`, {}).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Get the status of the last alarm sync run
   */
  getAlarmSyncStatus(): Observable<{
    lastSyncAt: string | null;
    casesProcessed: number;
    alarmsTriggered: number;
    alarmsAutoResolved: number;
    errors: number;
    isRunning: boolean;
  }> {
    return this.http.get<any>(`${this.apiUrl}/admin/alarms/sync-status`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Manually trigger a full alarm sync for all eligible cases
   */
  triggerAlarmSyncAll(): Observable<{
    lastSyncAt: string | null;
    casesProcessed: number;
    alarmsTriggered: number;
    alarmsAutoResolved: number;
    errors: number;
    isRunning: boolean;
  }> {
    return this.http.post<any>(`${this.apiUrl}/admin/alarms/sync-all`, {}).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  // ============= CLIENT CREDENTIALS (SECURE ACCESS) =============

  /**
   * Get unmasked credentials for a single client (SECURITY: audit logged)
   * This reveals sensitive credentials and creates an audit trail
   */
  getClientCredentials(clientId: string): Observable<{
    revealedAt: string;
    revealedBy: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    credentials: {
      turbotaxEmail: string | null;
      turbotaxPassword: string | null;
      irsUsername: string | null;
      irsPassword: string | null;
      stateUsername: string | null;
      statePassword: string | null;
    };
  }> {
    return this.http.get<any>(`${this.apiUrl}/admin/clients/${clientId}/credentials`).pipe(
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Get the status of the missing docs cron job
   */
  getMissingDocsCronStatus(): Observable<{ enabled: boolean; lastUpdated: string | null }> {
    return this.http.get<{ enabled: boolean; lastUpdated: string | null }>(
      `${this.apiUrl}/admin/progress/cron/missing-docs/status`
    ).pipe(
      catchError(this.handleError),
      shareReplay(1)
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
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  /**
   * Reset W2 estimate for a client (allows them to recalculate)
   * Deletes W2Estimate, Document records, and storage files
   */
  resetW2Estimate(clientId: string): Observable<{ message: string; deletedEstimates: number; deletedDocuments: number }> {
    return this.http.delete<{ message: string; deletedEstimates: number; deletedDocuments: number }>(
      `${this.apiUrl}/admin/clients/${clientId}/w2-estimate`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get W2 estimate data for a client (for visual review key fields checklist)
   */
  getW2Estimate(clientId: string): Observable<{
    hasEstimate: boolean;
    estimate: {
      id: string;
      box2Federal: number;
      box17State: number;
      estimatedRefund: number;
      w2FileName: string;
      ocrConfidence: 'high' | 'medium' | 'low';
      createdAt: string;
    } | null;
  }> {
    return this.http.get<any>(`${this.apiUrl}/admin/clients/${clientId}/w2-estimate`).pipe(
      catchError(this.handleError),
      shareReplay(1)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Admin error:', error);
    return throwError(() => error);
  }
}
