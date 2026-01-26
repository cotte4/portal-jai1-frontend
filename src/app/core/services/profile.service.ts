import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProfileResponse,
  CompleteProfileRequest,
  ClientProfile
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/profile`).pipe(
      catchError(this.handleError)
    );
  }

  completeProfile(data: CompleteProfileRequest): Observable<{ profile: ClientProfile; message: string }> {
    // Convert to snake_case for API
    const apiData = {
      ssn: data.ssn,
      date_of_birth: data.dateOfBirth,
      address: {
        street: data.address.street,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip
      },
      bank: {
        name: data.bank.name,
        routing_number: data.bank.routingNumber,
        account_number: data.bank.accountNumber
      },
      work_state: data.workState,
      employer_name: data.employerName,
      turbotax_email: data.turbotaxEmail,
      turbotax_password: data.turbotaxPassword,
      phone: data.phone,
      is_draft: data.isDraft,
      payment_method: data.paymentMethod || 'bank_deposit'
    };

    // Note: Don't log apiData - contains SSN, bank info, TurboTax credentials

    return this.http.post<{ profile: ClientProfile; message: string }>(
      `${this.apiUrl}/profile/complete`,
      apiData
    ).pipe(
      timeout(30000), // 30 second timeout to prevent indefinite hanging
      catchError(this.handleError)
    );
  }

  getDraft(): Observable<ClientProfile> {
    return this.http.get<ClientProfile>(`${this.apiUrl}/profile/draft`).pipe(
      catchError(this.handleError)
    );
  }

  updateUserInfo(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: string;
    preferredLanguage?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  }): Observable<{ user: any; address?: any; dateOfBirth?: string | null; message: string }> {
    return this.http.patch<{ user: any; address?: any; dateOfBirth?: string | null; message: string }>(
      `${this.apiUrl}/profile/user-info`,
      data
    ).pipe(
      timeout(8000), // 8 second timeout to prevent indefinite hanging
      catchError(this.handleError)
    );
  }

  uploadProfilePicture(file: File): Observable<{ profilePictureUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ profilePictureUrl: string }>(
      `${this.apiUrl}/profile/picture`,
      formData
    ).pipe(
      timeout(30000), // 30 second timeout for uploads
      catchError(this.handleError)
    );
  }

  deleteProfilePicture(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/profile/picture`
    ).pipe(
      catchError(this.handleError)
    );
  }

  updateLanguage(language: string): Observable<{ user: any; message: string }> {
    return this.http.patch<{ user: any; message: string }>(
      `${this.apiUrl}/profile/user-info`,
      { preferredLanguage: language }
    ).pipe(
      timeout(8000),
      catchError(this.handleError)
    );
  }

  /**
   * Mark onboarding as complete in the backend.
   * This ensures the hasProfile flag is set to true so the user
   * doesn't see onboarding again on subsequent logins.
   */
  markOnboardingComplete(): Observable<{ success: boolean; profileComplete: boolean; message: string }> {
    return this.http.post<{ success: boolean; profileComplete: boolean; message: string }>(
      `${this.apiUrl}/profile/mark-onboarding-complete`,
      {}
    ).pipe(
      timeout(10000), // 10 second timeout
      catchError(this.handleError)
    );
  }

  /**
   * Update sensitive profile fields (SSN, bank info, TurboTax credentials)
   * Only available for users who have already completed their profile
   */
  updateSensitiveProfile(data: {
    ssn?: string;
    bankName?: string;
    bankRoutingNumber?: string;
    bankAccountNumber?: string;
    turbotaxEmail?: string;
    turbotaxPassword?: string;
  }): Observable<{
    profile: { ssn: string | null; turbotaxEmail: string | null; turbotaxPassword: string | null };
    bank: { name: string | null; routingNumber: string | null; accountNumber: string | null };
    message: string;
  }> {
    // Note: Don't log data - contains SSN, bank info, TurboTax credentials
    return this.http.patch<{
      profile: { ssn: string | null; turbotaxEmail: string | null; turbotaxPassword: string | null };
      bank: { name: string | null; routingNumber: string | null; accountNumber: string | null };
      message: string;
    }>(
      `${this.apiUrl}/profile/sensitive`,
      data
    ).pipe(
      timeout(15000), // 15 second timeout
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Profile error:', error);

    // Extract error message from HTTP response
    let errorMessage = 'Error al procesar la solicitud';

    if (error.name === 'TimeoutError') {
      errorMessage = 'La solicitud tardó demasiado. Por favor intenta de nuevo.';
    } else if (error.error?.message) {
      // NestJS error response format
      errorMessage = Array.isArray(error.error.message)
        ? error.error.message[0]
        : error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.statusText) {
      errorMessage = error.statusText;
    }

    return throwError(() => ({ message: errorMessage, originalError: error }));
  }
}
