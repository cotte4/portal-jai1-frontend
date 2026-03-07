import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ColoradoClient {
  taxCaseId: string;
  clientName: string;
  clientEmail: string;
  userId: string;
  ssnMasked: string | null;
  stateStatusNew: string | null;
  stateStatusNewChangedAt: string | null;
  stateActualRefund: number | null;
  paymentMethod: string | null;
  lastCheck: ColoradoCheck | null;
}

export interface ColoradoCheck {
  id: string;
  taxCaseId: string;
  coRawStatus: string;
  coDetails: string | null;
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

@Injectable({ providedIn: 'root' })
export class ColoradoMonitorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/colorado-monitor`;

  getFiledClients(): Observable<ColoradoClient[]> {
    return this.http
      .get<ColoradoClient[]>(`${this.apiUrl}/clients`)
      .pipe(catchError(this.handleError));
  }

  runCheck(taxCaseId: string): Observable<{ started: boolean }> {
    return this.http
      .post<{ started: boolean }>(`${this.apiUrl}/check/${taxCaseId}`, {})
      .pipe(catchError(this.handleError));
  }

  getChecksForClient(taxCaseId: string): Observable<ColoradoCheck[]> {
    return this.http
      .get<ColoradoCheck[]>(`${this.apiUrl}/checks/${taxCaseId}`)
      .pipe(catchError(this.handleError));
  }

  runCheckAll(): Observable<{ started: boolean }> {
    return this.http
      .post<{ started: boolean }>(`${this.apiUrl}/check-all`, {})
      .pipe(catchError(this.handleError));
  }

  getStats(): Observable<{ changesLast24h: number; coloradoFiledCount: number; totalFiledCount: number }> {
    return this.http
      .get<{ changesLast24h: number; coloradoFiledCount: number; totalFiledCount: number }>(`${this.apiUrl}/stats`)
      .pipe(catchError(this.handleError));
  }

  exportCsv(): void {
    const url = `${this.apiUrl}/export`;
    const a = document.createElement('a');
    a.download = `colorado-checks-${new Date().toISOString().slice(0, 10)}.csv`;
    this.http.get(url, { responseType: 'blob' }).subscribe(blob => {
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    });
  }

  approveCheck(checkId: string): Observable<{ applied: boolean; previousStatus?: string; newStatus?: string }> {
    return this.http
      .post<{ applied: boolean }>(`${this.apiUrl}/checks/${checkId}/approve`, {})
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

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message ?? error.message ?? 'Unknown error';
    return throwError(() => new Error(message));
  }
}
