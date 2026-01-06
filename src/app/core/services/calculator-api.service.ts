import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError, retry } from 'rxjs';
import { environment } from '../../../environments/environment';
import { W2EstimateResponse, W2EstimateHistoryItem } from '../models';

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
      retry({
        count: 2,
        delay: 1000,
        resetOnSuccess: true
      }),
      catchError(this.handleError)
    );
  }

  getEstimateHistory(): Observable<W2EstimateHistoryItem[]> {
    return this.http.get<W2EstimateHistoryItem[]>(
      `${this.apiUrl}/calculator/history`
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Calculator API error:', error);
    return throwError(() => error);
  }
}
