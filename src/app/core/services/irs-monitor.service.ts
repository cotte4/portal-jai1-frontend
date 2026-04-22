import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IrsClient {
  taxCaseId: string;
  taxYear: number;
  clientName: string;
  clientEmail: string;
  userId: string;
  ssnMasked: string | null;
  ssnFull: string | null;
  federalStatusNew: string | null;
  federalStatusNewChangedAt: string | null;
  estimatedRefund: number | null;
  federalActualRefund: number | null;
  irsRefundAmount: number | null;
  paymentMethod: string | null;
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  lastCheck: IrsCheck | null;
  irsMonitorEnabled: boolean;
  irsMonitorIntervalHours: number;
}

export interface IrsCheck {
  id: string;
  taxCaseId: string;
  irsRawStatus: string;
  irsDetails: string | null;
  screenshotPath: string | null;
  mappedStatus: string | null;
  statusChanged: boolean;
  previousStatus: string | null;
  checkResult: 'success' | 'not_found' | 'error' | 'timeout';
  triggeredBy: 'manual' | 'schedule';
  triggeredByUserId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface RunCheckResponse {
  success: boolean;
  statusChanged: boolean;
  previousStatus: string | null;
  newStatus: string | null;
  rawStatus: string;
  error?: string;
  check: IrsCheck;
}

@Injectable({ providedIn: 'root' })
export class IrsMonitorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/irs-monitor`;

  getFiledClients(): Observable<IrsClient[]> {
    return this.http
      .get<IrsClient[]>(`${this.apiUrl}/clients`)
      .pipe(catchError(this.handleError));
  }

  runCheck(taxCaseId: string): Observable<{ started: boolean }> {
    return this.http
      .post<{ started: boolean }>(`${this.apiUrl}/check/${taxCaseId}`, {})
      .pipe(catchError(this.handleError));
  }

  getChecksForClient(taxCaseId: string): Observable<IrsCheck[]> {
    return this.http
      .get<IrsCheck[]>(`${this.apiUrl}/checks/${taxCaseId}`)
      .pipe(catchError(this.handleError));
  }

  toggleMonitor(taxCaseId: string, enabled: boolean, intervalHours?: number): Observable<{ taxCaseId: string; irsMonitorEnabled: boolean; irsMonitorIntervalHours: number }> {
    return this.http
      .patch<{ taxCaseId: string; irsMonitorEnabled: boolean; irsMonitorIntervalHours: number }>(
        `${this.apiUrl}/clients/${taxCaseId}/monitor`,
        { enabled, intervalHours },
      )
      .pipe(catchError(this.handleError));
  }

  runCheckAll(): Observable<{ started: boolean }> {
    return this.http
      .post<{ started: boolean }>(`${this.apiUrl}/check-all`, {})
      .pipe(catchError(this.handleError));
  }

  getStats(): Observable<{ changesLast24h: number }> {
    return this.http
      .get<{ changesLast24h: number }>(`${this.apiUrl}/stats`)
      .pipe(catchError(this.handleError));
  }

  exportCsv(): void {
    const url = `${this.apiUrl}/export`;
    // Trigger browser download via hidden anchor
    const a = document.createElement('a');
    a.href = url;
    a.download = `irs-checks-${new Date().toISOString().slice(0, 10)}.csv`;
    // Auth header can't be set on anchor — use fetch + blob instead
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => {
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    });
  }

  approveCheck(checkId: string, clientComment?: string, internalComment?: string): Observable<{ applied: boolean; previousStatus?: string; newStatus?: string }> {
    return this.http
      .post<{ applied: boolean }>(`${this.apiUrl}/checks/${checkId}/approve`, { clientComment, internalComment })
      .pipe(catchError(this.handleError));
  }

  dismissCheck(checkId: string): Observable<{ dismissed: boolean }> {
    return this.http
      .post<{ dismissed: boolean }>(`${this.apiUrl}/checks/${checkId}/dismiss`, {})
      .pipe(catchError(this.handleError));
  }

  getScreenshotUrl(checkId: string): Observable<{ url: string }> {
    return this.http
      .get<{ url: string }>(`${this.apiUrl}/screenshot/${checkId}`)
      .pipe(catchError(this.handleError));
  }

  getSchedulerStatus(): Observable<{ active: boolean }> {
    return this.http
      .get<{ active: boolean }>(`${this.apiUrl}/scheduler/status`)
      .pipe(catchError(this.handleError));
  }

  startScheduler(): Observable<{ active: boolean }> {
    return this.http
      .post<{ active: boolean }>(`${this.apiUrl}/scheduler/start`, {})
      .pipe(catchError(this.handleError));
  }

  stopScheduler(): Observable<{ active: boolean }> {
    return this.http
      .post<{ active: boolean }>(`${this.apiUrl}/scheduler/stop`, {})
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message ?? error.message ?? 'Unknown error';
    return throwError(() => new Error(message));
  }
}
