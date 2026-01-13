import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminClientListResponse,
  AdminClientDetail,
  UpdateStatusRequest,
  InternalStatus
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getClients(
    status?: InternalStatus,
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

  updateAdminStep(clientId: string, step: number): Observable<{ message: string; step: number }> {
    return this.http.patch<{ message: string; step: number }>(
      `${this.apiUrl}/admin/clients/${clientId}/step`,
      { step }
    ).pipe(
      catchError(this.handleError)
    );
  }

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
