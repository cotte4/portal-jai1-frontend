import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Document, DocumentType } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  upload(file: File, type: DocumentType, taxYear?: number): Observable<{ document: Document }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (taxYear) {
      formData.append('tax_year', taxYear.toString());
    }

    return this.http.post<{ document: Document }>(
      `${this.apiUrl}/documents/upload`,
      formData
    ).pipe(
      catchError(this.handleError)
    );
  }

  getDocuments(clientId?: string): Observable<Document[]> {
    let params = new HttpParams();
    if (clientId) {
      params = params.set('clientId', clientId);
    }
    return this.http.get<Document[]>(`${this.apiUrl}/documents`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getDownloadUrl(documentId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/documents/${documentId}/download`
    ).pipe(
      catchError(this.handleError)
    );
  }

  delete(documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${documentId}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Document error:', error);
    return throwError(() => error);
  }
}
