import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { W2EstimateResponse, W2EstimateHistoryItem } from '../models';

@Injectable({
  providedIn: 'root'
})
export class CalculatorApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  estimateRefund(file: File): Observable<W2EstimateResponse> {
    const formData = new FormData();
    formData.append('w2File', file);

    return this.http.post<W2EstimateResponse>(
      `${this.apiUrl}/calculator/estimate`,
      formData
    ).pipe(
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
