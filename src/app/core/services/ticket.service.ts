import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ticket, TicketStatus, CreateTicketRequest, AddMessageRequest } from '../models';

// Response type for status updates
interface UpdateStatusResponse {
  id: string;
  status: string;
  message: string;
}

// Response type for delete operations
interface DeleteResponse {
  message: string;
}

// Response type for mark messages as read
interface MarkReadResponse {
  markedCount: number;
}

// Custom error class for better error handling
export class TicketServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly originalError: HttpErrorResponse
  ) {
    super(message);
    this.name = 'TicketServiceError';
  }
}

// Retry configuration
const RETRY_CONFIG = {
  count: 2,
  delay: 1000,
  // Only retry on network errors or 5xx server errors
  shouldRetry: (error: HttpErrorResponse): boolean => {
    return error.status === 0 || (error.status >= 500 && error.status < 600);
  }
};

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Create a new ticket
   */
  create(data: CreateTicketRequest): Observable<Ticket> {
    if (!data.subject?.trim()) {
      return throwError(() => new Error('Subject is required'));
    }

    return this.http.post<Ticket>(`${this.apiUrl}/tickets`, data).pipe(
      retry({
        count: RETRY_CONFIG.count,
        delay: (error, retryCount) => {
          if (!RETRY_CONFIG.shouldRetry(error)) {
            throw error;
          }
          return timer(RETRY_CONFIG.delay * retryCount);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'crear ticket'))
    );
  }

  /**
   * Get all tickets with optional filters
   */
  getTickets(status?: TicketStatus, userId?: string): Observable<Ticket[]> {
    let params = new HttpParams();

    if (status) {
      params = params.set('status', status);
    }
    if (userId) {
      params = params.set('user_id', userId);
    }

    return this.http.get<Ticket[]>(`${this.apiUrl}/tickets`, { params }).pipe(
      retry({
        count: RETRY_CONFIG.count,
        delay: (error, retryCount) => {
          if (!RETRY_CONFIG.shouldRetry(error)) {
            throw error;
          }
          return timer(RETRY_CONFIG.delay * retryCount);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'cargar tickets'))
    );
  }

  /**
   * Get a single ticket by ID
   */
  getTicket(ticketId: string): Observable<Ticket> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }

    return this.http.get<Ticket>(`${this.apiUrl}/tickets/${ticketId}`).pipe(
      retry({
        count: RETRY_CONFIG.count,
        delay: (error, retryCount) => {
          if (!RETRY_CONFIG.shouldRetry(error)) {
            throw error;
          }
          return timer(RETRY_CONFIG.delay * retryCount);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'cargar ticket'))
    );
  }

  /**
   * Add a message to a ticket
   */
  addMessage(ticketId: string, data: AddMessageRequest): Observable<Ticket> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }
    if (!data.message?.trim()) {
      return throwError(() => new Error('Message is required'));
    }

    return this.http.post<Ticket>(
      `${this.apiUrl}/tickets/${ticketId}/messages`,
      data
    ).pipe(
      retry({
        count: RETRY_CONFIG.count,
        delay: (error, retryCount) => {
          if (!RETRY_CONFIG.shouldRetry(error)) {
            throw error;
          }
          return timer(RETRY_CONFIG.delay * retryCount);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'enviar mensaje'))
    );
  }

  /**
   * Update ticket status (admin only)
   */
  updateStatus(ticketId: string, status: TicketStatus): Observable<UpdateStatusResponse> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }
    if (!status) {
      return throwError(() => new Error('Status is required'));
    }

    return this.http.patch<UpdateStatusResponse>(
      `${this.apiUrl}/tickets/${ticketId}/status`,
      { status }
    ).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, 'actualizar estado'))
    );
  }

  /**
   * Soft-delete a ticket (user can delete own, admin can delete any)
   */
  deleteTicket(ticketId: string): Observable<DeleteResponse> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }

    return this.http.delete<DeleteResponse>(
      `${this.apiUrl}/tickets/${ticketId}`
    ).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, 'eliminar ticket'))
    );
  }

  /**
   * Soft-delete a specific message (admin only)
   */
  deleteMessage(ticketId: string, messageId: string): Observable<DeleteResponse> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }
    if (!messageId) {
      return throwError(() => new Error('Message ID is required'));
    }

    return this.http.delete<DeleteResponse>(
      `${this.apiUrl}/tickets/${ticketId}/messages/${messageId}`
    ).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, 'eliminar mensaje'))
    );
  }

  /**
   * Mark all messages in a ticket as read
   */
  markMessagesAsRead(ticketId: string): Observable<MarkReadResponse> {
    if (!ticketId) {
      return throwError(() => new Error('Ticket ID is required'));
    }

    return this.http.patch<MarkReadResponse>(
      `${this.apiUrl}/tickets/${ticketId}/messages/read`,
      {}
    ).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, 'marcar como leido'))
    );
  }

  /**
   * Centralized error handler with user-friendly messages
   */
  private handleError(error: HttpErrorResponse, action: string): Observable<never> {
    let userMessage: string;

    if (error.status === 0) {
      // Network error
      userMessage = `No se pudo ${action}. Verifica tu conexion a internet.`;
    } else if (error.status === 401) {
      userMessage = 'Sesion expirada. Por favor, inicia sesion nuevamente.';
    } else if (error.status === 403) {
      userMessage = 'No tienes permiso para realizar esta accion.';
    } else if (error.status === 404) {
      userMessage = 'El ticket no fue encontrado.';
    } else if (error.status >= 500) {
      userMessage = `Error del servidor al ${action}. Intenta de nuevo mas tarde.`;
    } else {
      // Use server error message if available
      userMessage = error.error?.message || `Error al ${action}.`;
    }

    return throwError(() => new TicketServiceError(userMessage, error.status, error));
  }
}
