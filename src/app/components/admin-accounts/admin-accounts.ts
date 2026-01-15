import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
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
export class AdminAccounts implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  accounts: ClientAccount[] = [];
  filteredAccounts: ClientAccount[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';

  // Individual field reveal tracking (security: no global toggle)
  revealedFields: Set<string> = new Set();
  private revealTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Copy feedback
  copiedField: string | null = null;

  ngOnInit() {
    this.loadAccounts();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    // Clear all reveal timers and revealed fields on component destroy (security)
    this.revealTimers.forEach(timer => clearTimeout(timer));
    this.revealTimers.clear();
    this.revealedFields.clear();
  }

  loadAccounts() {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
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
      })
    );
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

  // Reveal a specific field temporarily (auto-hides after 5 seconds)
  revealField(fieldId: string, event: Event) {
    event.stopPropagation(); // Prevent triggering copy

    // Clear existing timer if re-clicking
    const existingTimer = this.revealTimers.get(fieldId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.revealedFields.add(fieldId);
    this.cdr.detectChanges();

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      this.revealedFields.delete(fieldId);
      this.revealTimers.delete(fieldId);
      this.cdr.detectChanges();
    }, 5000);

    this.revealTimers.set(fieldId, timer);
  }

  // Check if a specific field is currently revealed
  isFieldRevealed(fieldId: string): boolean {
    return this.revealedFields.has(fieldId);
  }

  // Mask password with individual field reveal support
  maskPassword(value: string | null, fieldId: string): string {
    if (!value) return '---';
    return this.isFieldRevealed(fieldId) ? value : '••••••••';
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
    return value || '---';
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

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }
}
