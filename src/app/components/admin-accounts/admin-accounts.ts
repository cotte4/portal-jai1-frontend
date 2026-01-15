import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ClientAccount {
  id: string;
  name: string;
  email: string;
  turbotaxEmail: string | null;
  turbotaxPassword: string | null;
  irsUsername: string | null;
  irsPassword: string | null;
  stateUsername: string | null;
  statePassword: string | null;
}

@Component({
  selector: 'app-admin-accounts',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-accounts.html',
  styleUrl: './admin-accounts.css'
})
export class AdminAccounts implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  accounts: ClientAccount[] = [];
  filteredAccounts: ClientAccount[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';

  // Password visibility toggles
  showPasswords: boolean = false;

  // Copy feedback
  copiedField: string | null = null;

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ClientAccount[]>(`${environment.apiUrl}/admin/accounts`).subscribe({
      next: (response) => {
        this.accounts = response;
        this.filteredAccounts = response;
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading accounts:', error);
        this.errorMessage = error?.error?.message || 'Error al cargar cuentas de clientes';
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
    });
  }

  filterAccounts() {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredAccounts = this.accounts;
    } else {
      this.filteredAccounts = this.accounts.filter(account =>
        account.name.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query)
      );
    }
  }

  togglePasswords() {
    this.showPasswords = !this.showPasswords;
  }

  maskPassword(value: string | null): string {
    if (!value) return '-';
    return this.showPasswords ? value : '********';
  }

  async copyToClipboard(value: string | null, fieldId: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = fieldId;
      setTimeout(() => {
        this.copiedField = null;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  getDisplayValue(value: string | null): string {
    return value || '-';
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    const first = parts[0]?.charAt(0)?.toUpperCase() || '?';
    const last = parts[1]?.charAt(0)?.toUpperCase() || '';
    return first + last;
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.loadAccounts();
  }
}
