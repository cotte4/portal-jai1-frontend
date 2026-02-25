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
  federalStatusNew: string | null;
  federalStatusNewChangedAt: string | null;
  estimatedRefund: number | null;
  federalActualRefund: number | null;
  irsRefundAmount: number | null;   // what will actually be sent to IRS WMR
  paymentMethod: string | null;
  lastCheck: IrsCheck | null;
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

  runCheck(taxCaseId: string): Observable<RunCheckResponse> {
    return this.http
      .post<RunCheckResponse>(`${this.apiUrl}/check/${taxCaseId}`, {})
      .pipe(catchError(this.handleError));
  }

  getChecksForClient(taxCaseId: string): Observable<IrsCheck[]> {
    return this.http
      .get<IrsCheck[]>(`${this.apiUrl}/checks/${taxCaseId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message ?? error.message ?? 'Unknown error';
    return throwError(() => new Error(message));
  }
}
