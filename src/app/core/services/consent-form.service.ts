import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConsentFormStatusResponse,
  ConsentFormPrefilledResponse,
  SignConsentFormResponse,
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ConsentFormService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Get consent form status
   */
  getStatus(): Observable<ConsentFormStatusResponse> {
    return this.http.get<ConsentFormStatusResponse>(
      `${this.apiUrl}/consent-form/status`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get pre-filled client data for the consent form
   */
  getPrefilled(): Observable<ConsentFormPrefilledResponse> {
    return this.http.get<ConsentFormPrefilledResponse>(
      `${this.apiUrl}/consent-form/prefilled`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Sign the consent form with client signature and form data
   * @param signature Base64 encoded PNG signature image
   * @param formData Client form data (name, dni, address, city, email)
   */
  sign(signature: string, formData: {
    fullName: string;
    dniPassport: string;
    street: string;
    city: string;
    email: string;
  }): Observable<SignConsentFormResponse> {
    return this.http.post<SignConsentFormResponse>(
      `${this.apiUrl}/consent-form/sign`,
      { signature, ...formData }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get download URL for signed consent form
   */
  getDownloadUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/consent-form/download`
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Consent form error:', error);
    return throwError(() => error);
  }
}
