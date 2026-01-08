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

  updateUserInfo(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  }): Observable<{ user: any; address?: any; dateOfBirth?: string | null; message: string }> {
    const url = `${this.apiUrl}/profile/user-info`;
    console.log('updateUserInfo called with:', data);

    // Use native fetch to bypass any HttpClient issues
    return new Observable(observer => {
      const token = localStorage.getItem('jai1_access_token');

      console.log('Making fetch request to:', url);

      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        console.log('Fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(result => {
        console.log('Fetch success:', result);
        observer.next(result);
        observer.complete();
      })
      .catch(error => {
        console.error('Fetch error:', error);
        observer.error(error);
      });
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Profile error:', error);
    return throwError(() => error);
  }
}
