import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, retry, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { W2EstimateResponse, W2EstimateHistoryItem } from '../models';

// Timeout for OCR processing (30 seconds - OpenAI Vision can be slow)
const CALCULATOR_TIMEOUT_MS = 30000;

@Injectable({
  providedIn: 'root'
})
export class CalculatorApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private currentFile: File | null = null;

  /**
   * Store the current file being processed
   */
  setCurrentFile(file: File): void {
    console.log('=== CALCULATOR SERVICE: Storing file ===', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    this.currentFile = file;
  }

  /**
   * Get the current file being processed
   */
  getCurrentFile(): File | null {
    return this.currentFile;
  }

  /**
   * Clear the current file reference
   */
  clearCurrentFile(): void {
    console.log('=== CALCULATOR SERVICE: Clearing file ===');
    this.currentFile = null;
  }

  estimateRefund(file: File): Observable<W2EstimateResponse> {
    console.log('=== CALCULATOR SERVICE: Sending file to API ===', {
      name: file.name,
      size: file.size,
      type: file.type,
      apiUrl: `${this.apiUrl}/calculator/estimate`
    });

    const formData = new FormData();
    formData.append('w2File', file);

    return this.http.post<W2EstimateResponse>(
      `${this.apiUrl}/calculator/estimate`,
      formData
    ).pipe(
      timeout(CALCULATOR_TIMEOUT_MS),
      retry({
        count: 2,
        delay: 1000,
        resetOnSuccess: true
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getEstimateHistory(): Observable<W2EstimateHistoryItem[]> {
    return this.http.get<W2EstimateHistoryItem[]>(
      `${this.apiUrl}/calculator/history`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get the latest estimate from backend (syncs across devices)
   */
  getLatestEstimate(): Observable<W2EstimateResponse | null> {
    return this.http.get<W2EstimateResponse | null>(
      `${this.apiUrl}/calculator/latest`
    ).pipe(
      catchError(() => {
        // Return null if no estimate exists or error
        return new Observable<null>(subscriber => {
          subscriber.next(null);
          subscriber.complete();
        });
      })
    );
  }

  private handleError(error: HttpErrorResponse | TimeoutError): Observable<never> {
    console.error('Calculator API error:', error);

    // Handle timeout specifically
    if (error instanceof TimeoutError) {
      const timeoutError = new HttpErrorResponse({
        error: { message: 'El procesamiento tardó demasiado. Por favor, intentá de nuevo.' },
        status: 408,
        statusText: 'Request Timeout'
      });
      return throwError(() => timeoutError);
    }

    return throwError(() => error);
  }
}
