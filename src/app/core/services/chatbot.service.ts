import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface ChatbotResponse {
  response: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly http = inject(HttpClient);

  // Use backend proxy to avoid CORS issues
  private readonly webhookUrl = `${environment.apiUrl}/chatbot`;

  /**
   * Send a message to the n8n chatbot webhook
   */
  sendMessage(message: string, conversationHistory: ChatMessage[] = []): Observable<string> {
    if (!message?.trim()) {
      return throwError(() => new Error('El mensaje no puede estar vacio'));
    }

    const payload = {
      message: message.trim(),
      history: conversationHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    };

    return this.http.post<ChatbotResponse>(this.webhookUrl, payload).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error);
        }
        return response.response || 'Lo siento, no pude procesar tu mensaje.';
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Centralized error handler
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let userMessage: string;

    if (error.status === 0) {
      userMessage = 'No se pudo conectar con el asistente. Verifica tu conexion a internet.';
    } else if (error.status === 429) {
      userMessage = 'Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.';
    } else if (error.status >= 500) {
      userMessage = 'El asistente no esta disponible en este momento. Intenta de nuevo mas tarde.';
    } else {
      userMessage = error.error?.message || 'Hubo un error al procesar tu mensaje.';
    }

    return throwError(() => new Error(userMessage));
  }
}
