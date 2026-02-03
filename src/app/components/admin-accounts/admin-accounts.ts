import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/utils/error-handler';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';

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

interface AccountsResponse {
  accounts: ClientAccount[];
  nextCursor: string | null;
  hasMore: boolean;
}

@Component({
  selector: 'app-admin-accounts',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-accounts.html',
  styleUrl: './admin-accounts.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAccounts implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private subscriptions = new Subscription();

  get darkMode() { return this.themeService.darkMode(); }

  accounts: ClientAccount[] = [];
  filteredAccounts: ClientAccount[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  errorMessage: string = '';

  // Pagination state
  nextCursor: string | null = null;
  hasMore: boolean = false;
  isLoadingMore: boolean = false;
  totalLoaded: number = 0;

  // Individual field reveal tracking (SECURITY: server-side reveal with audit logging)
  revealedCredentials: Map<string, any> = new Map(); // clientId -> credentials object
  revealedFields: Set<string> = new Set();
  private revealTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isRevealing: Map<string, boolean> = new Map(); // Track API calls in progress

  // Copy feedback
  copiedField: string | null = null;

  ngOnInit() {
    this.loadAccounts();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    // Clear all reveal timers and revealed credentials on component destroy (security)
    this.revealTimers.forEach(timer => clearTimeout(timer));
    this.revealTimers.clear();
    this.revealedFields.clear();
    this.revealedCredentials.clear();
    this.isRevealing.clear();
  }

  loadAccounts() {
    this.isLoading = true;
    this.errorMessage = '';
    // Reset pagination state on fresh load
    this.nextCursor = null;
    this.hasMore = false;
    this.accounts = [];

    this.subscriptions.add(
      this.http.get<AccountsResponse>(`${environment.apiUrl}/admin/accounts`).subscribe({
        next: (response) => {
          this.accounts = response.accounts;
          this.filteredAccounts = response.accounts;
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.totalLoaded = response.accounts.length;
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading accounts:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar cuentas de clientes');
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

  // Reveal credentials for a client (SECURITY: calls backend API with audit logging)
  revealField(fieldId: string, event: Event) {
    event.stopPropagation(); // Prevent triggering copy

    // Extract clientId from fieldId (format: clientId-field)
    const clientId = fieldId.split('-')[0];

    // If credentials already revealed for this client, just toggle the field visibility
    if (this.revealedCredentials.has(clientId)) {
      this.toggleFieldVisibility(fieldId);
      return;
    }

    // Prevent duplicate API calls
    if (this.isRevealing.get(clientId)) {
      return;
    }

    // Call backend to reveal credentials (with audit logging)
    this.isRevealing.set(clientId, true);

    this.subscriptions.add(
      this.adminService.getClientCredentials(clientId).subscribe({
        next: (response) => {
          // Store the unmasked credentials
          this.revealedCredentials.set(clientId, response.credentials);
          this.isRevealing.set(clientId, false);

          // Show toast notification that access was logged (SECURITY: user awareness)
          this.toastService.warning(
            'Acceso a credenciales registrado en auditoria',
            'Seguridad'
          );

          // Toggle the specific field visibility
          this.toggleFieldVisibility(fieldId);

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error revealing credentials:', error);
          this.isRevealing.set(clientId, false);
          this.toastService.error(
            'Error al revelar credenciales. Por favor intente de nuevo.',
            'Error'
          );
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Toggle visibility of a specific field (used after credentials are fetched)
  private toggleFieldVisibility(fieldId: string) {
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

    // Check if we have revealed credentials for this client
    const clientId = fieldId.split('-')[0];
    const field = fieldId.split('-').slice(1).join('-'); // Handle multi-part field names

    if (this.isFieldRevealed(fieldId) && this.revealedCredentials.has(clientId)) {
      // Map fieldId suffix to credential field name
      const fieldMap: Record<string, string> = {
        'ttPass': 'turbotaxPassword',
        'irsPass': 'irsPassword',
        'statePass': 'statePassword'
      };

      const credentialField = fieldMap[field];
      if (credentialField) {
        const credentials = this.revealedCredentials.get(clientId);
        return credentials[credentialField] || '---';
      }
    }

    return '••••••••';
  }

  async copyToClipboard(value: string | null, fieldId: string) {
    if (!value) return;

    // For password fields, get the actual value from revealed credentials
    const clientId = fieldId.split('-')[0];
    const field = fieldId.split('-').slice(1).join('-');

    let actualValue = value;

    // If it's a password field and we have revealed credentials, use those
    if (value === '••••••••' && this.revealedCredentials.has(clientId)) {
      const fieldMap: Record<string, string> = {
        'ttPass': 'turbotaxPassword',
        'irsPass': 'irsPassword',
        'statePass': 'statePassword'
      };

      const credentialField = fieldMap[field];
      if (credentialField) {
        const credentials = this.revealedCredentials.get(clientId);
        actualValue = credentials[credentialField] || value;
      }
    }

    try {
      await navigator.clipboard.writeText(actualValue);
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

  // Load more accounts (pagination)
  loadMoreAccounts() {
    if (!this.hasMore || this.isLoadingMore || !this.nextCursor) return;

    this.isLoadingMore = true;

    this.subscriptions.add(
      this.http.get<AccountsResponse>(`${environment.apiUrl}/admin/accounts`, {
        params: { cursor: this.nextCursor, limit: '50' }
      }).subscribe({
        next: (response) => {
          this.accounts = [...this.accounts, ...response.accounts];
          // Re-apply filter if search is active
          if (this.searchQuery.trim()) {
            this.filterAccounts();
          } else {
            this.filteredAccounts = this.accounts;
          }
          this.nextCursor = response.nextCursor;
          this.hasMore = response.hasMore;
          this.totalLoaded = this.accounts.length;
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading more accounts:', error);
          this.errorMessage = getErrorMessage(error, 'Error al cargar mas cuentas');
          this.isLoadingMore = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }
}
