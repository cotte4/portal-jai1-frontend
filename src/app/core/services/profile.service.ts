import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
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
      is_draft: data.isDraft
    };

    console.log('Sending profile data to:', `${this.apiUrl}/profile/complete`);
    console.log('Data:', apiData);

    return this.http.post<{ profile: ClientProfile; message: string }>(
      `${this.apiUrl}/profile/complete`,
      apiData
    ).pipe(
      catchError(this.handleError)
    );
  }

  getDraft(): Observable<ClientProfile> {
    return this.http.get<ClientProfile>(`${this.apiUrl}/profile/draft`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Profile error:', error);
    return throwError(() => error);
  }
}
