import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ticket, TicketStatus, CreateTicketRequest, AddMessageRequest } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  create(data: CreateTicketRequest): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.apiUrl}/tickets`, data).pipe(
      catchError(this.handleError)
    );
  }

  getTickets(status?: TicketStatus, userId?: string): Observable<Ticket[]> {
    const params: any = {};
    if (status) params.status = status;
    if (userId) params.userId = userId;

    return this.http.get<Ticket[]>(`${this.apiUrl}/tickets`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getTicket(ticketId: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.apiUrl}/tickets/${ticketId}`).pipe(
      catchError(this.handleError)
    );
  }

  addMessage(ticketId: string, data: AddMessageRequest): Observable<Ticket> {
    return this.http.post<Ticket>(
      `${this.apiUrl}/tickets/${ticketId}/messages`,
      data
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateStatus(ticketId: string, status: TicketStatus): Observable<Ticket> {
    return this.http.patch<Ticket>(
      `${this.apiUrl}/tickets/${ticketId}/status`,
      { status }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Ticket error:', error);
    return throwError(() => error);
  }
}
