import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminService, SeasonStats } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AdminClientListItem, TaxStatus, PreFilingStatus, ClientCredentials } from '../../core/models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit, OnDestroy {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  allClients: AdminClientListItem[] = [];
  filteredClients: AdminClientListItem[] = [];
  selectedFilter: string = 'all';
  searchQuery: string = '';
  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  isRefreshing: boolean = false;
  isExporting: boolean = false;
  isLoadingStats: boolean = false;
  errorMessage: string = '';
  errorCode: string = '';

  // Season summary stats
  seasonStats: SeasonStats | null = null;
  nextCursor: string | undefined;
  hasMore: boolean = false;
  totalLoaded: number = 0;

  // Debounced search
  private searchSubject = new Subject<string>();

  stats = {
    total: 0,
    pending: 0,
    inReview: 0,
    completed: 0,
    needsAttention: 0
  };

  // Credentials modal
  showCredentialsModal: boolean = false;
  selectedClientCredentials: { clientName: string; credentials?: ClientCredentials } | null = null;

  // Sorting
  sortField: 'name' | 'federalRefund' | 'stateRefund' | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  // Status filter options - using new phase-based status system
  statusFilters = [
    // All
    { value: 'all', label: 'Todos', group: 'main' },
    // Group filters (match stats cards)
    { value: 'group_pending', label: '⏳ Pendientes (grupo)', group: 'group' },
    { value: 'group_in_review', label: '🔍 En Proceso (grupo)', group: 'group' },
    { value: 'group_completed', label: '✓ Completados (grupo)', group: 'group' },
    { value: 'group_needs_attention', label: '⚠️ Requieren Atencion (grupo)', group: 'group' },
    // Special filters
    { value: 'ready_to_present', label: '✓ Listos para Presentar', group: 'special' },
    { value: 'incomplete', label: '⚠ Incompletos', group: 'special' }
  ];

  ngOnInit() {
    this.loadClients();
    this.loadSeasonStats();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/admin/dashboard')
      ).subscribe(() => this.loadClients())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/admin/dashboard').subscribe(() => this.loadClients())
    );

    // Debounced search - auto-search after 300ms of no typing (server-side)
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.loadClients();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Load clients with server-side filtering
  loadClients(isRefresh: boolean = false) {
    if (isRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.errorCode = '';

    // Determine the status filter to pass to API (undefined for 'all')
    const statusFilter = this.selectedFilter === 'all' ? undefined : this.selectedFilter;
    const searchFilter = this.searchQuery || undefined;

    this.adminService.getClients(statusFilter as any, searchFilter, undefined, 100).subscribe({
      next: (response) => {
        this.filteredClients = response.clients;
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = response.clients.length;

        // For stats, we need to load all clients without filter (only on initial load or refresh)
        if (!statusFilter && !searchFilter) {
          this.allClients = response.clients;
          this.calculateStats();
        }

        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.errorCode = error?.status ? `HTTP ${error.status}` : 'NETWORK_ERROR';

        // Provide more helpful error messages based on status code
        if (error?.status === 401 || error?.status === 403) {
          this.errorMessage = 'Sesion expirada. Por favor, vuelve a iniciar sesion.';
        } else if (error?.status === 500) {
          this.errorMessage = 'Error del servidor. Por favor, intenta de nuevo mas tarde.';
        } else if (error?.status === 0 || !error?.status) {
          this.errorMessage = 'Error de conexion. Verifica tu conexion a internet.';
        } else {
          this.errorMessage = error?.error?.message || error?.message || 'Error al cargar clientes';
        }

        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    });

    // Also load stats separately (all clients without filters) if we have an active filter
    if (statusFilter || searchFilter) {
      this.loadStats();
    }
  }

  // Load stats separately (all clients without filters)
  private loadStats() {
    this.adminService.getClients(undefined, undefined, undefined, 100).subscribe({
      next: (response) => {
        this.allClients = response.clients;
        this.calculateStats();
        this.cdr.detectChanges();
      },
      error: () => {
        // Stats loading failure is non-critical, ignore
      }
    });
  }

  // Load season summary stats from backend
  loadSeasonStats() {
    this.isLoadingStats = true;
    this.adminService.getSeasonStats().subscribe({
      next: (stats) => {
        this.seasonStats = stats;
        this.isLoadingStats = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading season stats:', error);
        this.isLoadingStats = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Load more clients (pagination)
  loadMoreClients() {
    if (!this.hasMore || this.isLoadingMore || !this.nextCursor) return;

    this.isLoadingMore = true;

    // Pass the same filter when loading more
    const statusFilter = this.selectedFilter === 'all' ? undefined : this.selectedFilter;
    const searchFilter = this.searchQuery || undefined;

    this.adminService.getClients(statusFilter as any, searchFilter, this.nextCursor, 100).subscribe({
      next: (response) => {
        this.filteredClients = [...this.filteredClients, ...response.clients];
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = this.filteredClients.length;
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading more clients:', error);
        this.errorMessage = 'Error al cargar mas clientes';
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      }
    });
  }

  calculateStats() {
    // Reset stats
    this.stats.total = this.allClients.length;
    this.stats.pending = 0;
    this.stats.inReview = 0;
    this.stats.completed = 0;
    this.stats.needsAttention = 0;

    // Single pass through clients using new phase-based status system
    for (const client of this.allClients) {
      const taxesFiled = client.taxesFiled || false;
      const federalStatus = client.federalStatus;
      const stateStatus = client.stateStatus;

      if (!taxesFiled) {
        // Pending: not yet filed
        this.stats.pending++;
      } else if (federalStatus === TaxStatus.DEPOSITED || stateStatus === TaxStatus.DEPOSITED) {
        // Completed: at least one deposited
        this.stats.completed++;
      } else if (federalStatus === TaxStatus.REJECTED || stateStatus === TaxStatus.REJECTED) {
        // Needs Attention: rejected
        this.stats.needsAttention++;
      } else {
        // In Review: filed but not yet deposited or rejected
        this.stats.inReview++;
      }
    }
  }

  filterClients(filter: string) {
    this.selectedFilter = filter;
    this.loadClients(); // Server-side filtering
  }

  // Get info about current group filter (for active filter indicator)
  getActiveGroupFilterInfo(): { label: string; statuses: string[] } | null {
    const groupFilters: Record<string, { label: string; statuses: string[] }> = {
      'group_pending': {
        label: 'Pendientes',
        statuses: ['Sin Asignar', 'Esperando Datos', 'Revision de Registro']
      },
      'group_in_review': {
        label: 'En Proceso',
        statuses: ['En Proceso', 'En Verificacion', 'Resolviendo Verificacion']
      },
      'group_completed': {
        label: 'Completados',
        statuses: ['Proceso Finalizado', 'Cheque en Camino', 'Esperando Pago Comision']
      },
      'group_needs_attention': {
        label: 'Requieren Atencion',
        statuses: ['Falta Documentacion', 'Inconvenientes']
      }
    };
    return groupFilters[this.selectedFilter] || null;
  }

  // Called on every keystroke - triggers debounced search
  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
  }

  // Called on Enter key - immediate search
  onSearch() {
    this.loadClients(); // Server-side search
  }

  clearError() {
    this.errorMessage = '';
    this.errorCode = '';
  }

  refreshData() {
    this.loadClients(true);
    this.loadSeasonStats();
  }

  // DEPRECATED: Legacy method kept for backward compatibility in templates
  // New status system uses taxesFiled, federalStatus, stateStatus
  getStatusLabel(status: any): string {
    return status || 'Sin Asignar';
  }

  // DEPRECATED: Legacy method kept for backward compatibility in templates
  getStatusClass(status: any): string {
    return 'status-pending';
  }

  getInitials(firstName: string | undefined, lastName: string | undefined): string {
    const first = firstName?.charAt(0)?.toUpperCase() || '?';
    const last = lastName?.charAt(0)?.toUpperCase() || '?';
    return first + last;
  }

  viewClient(clientId: string) {
    this.router.navigate(['/admin/client', clientId]);
  }

  goToDelays() {
    this.router.navigate(['/admin/delays']);
  }

  goToPayments() {
    this.router.navigate(['/admin/payments']);
  }

  goToAccounts() {
    this.router.navigate(['/admin/accounts']);
  }

  goToReferrals() {
    this.router.navigate(['/admin/referrals']);
  }

  exportToExcel() {
    if (this.isExporting) return;

    this.isExporting = true;
    this.errorMessage = '';

    this.adminService.exportToExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || error?.message || 'Error al exportar';
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/admin-login']);
      },
      error: () => {
        this.router.navigate(['/admin-login']);
      }
    });
  }

  // ===== NEW STATUS SYSTEM METHODS =====

  getPreFilingStatusLabel(status: PreFilingStatus | null | undefined): string {
    if (!status) return 'Sin Estado';

    const labels: Record<PreFilingStatus, string> = {
      [PreFilingStatus.AWAITING_REGISTRATION]: 'Esperando Registro',
      [PreFilingStatus.AWAITING_DOCUMENTS]: 'Esperando Docs',
      [PreFilingStatus.DOCUMENTATION_COMPLETE]: 'Docs Completos'
    };
    return labels[status] || status;
  }

  getPreFilingStatusClass(status: PreFilingStatus | null | undefined): string {
    if (!status) return 'status-new';

    const classes: Record<PreFilingStatus, string> = {
      [PreFilingStatus.AWAITING_REGISTRATION]: 'status-pending',
      [PreFilingStatus.AWAITING_DOCUMENTS]: 'status-pending',
      [PreFilingStatus.DOCUMENTATION_COMPLETE]: 'status-approved'
    };
    return classes[status] || 'status-pending';
  }

  getTaxStatusLabel(status: TaxStatus | null | undefined): string {
    if (!status) return 'Sin Estado';

    const labels: Record<TaxStatus, string> = {
      [TaxStatus.FILED]: 'Presentado',
      [TaxStatus.PENDING]: 'Pendiente',
      [TaxStatus.PROCESSING]: 'Procesando',
      [TaxStatus.APPROVED]: 'Aprobado',
      [TaxStatus.REJECTED]: 'Rechazado',
      [TaxStatus.DEPOSITED]: 'Depositado'
    };
    return labels[status] || status;
  }

  getTaxStatusClass(status: TaxStatus | null | undefined): string {
    if (!status) return 'status-new';

    const classes: Record<TaxStatus, string> = {
      [TaxStatus.FILED]: 'status-in-review',
      [TaxStatus.PENDING]: 'status-pending',
      [TaxStatus.PROCESSING]: 'status-in-review',
      [TaxStatus.APPROVED]: 'status-approved',
      [TaxStatus.REJECTED]: 'status-needs-attention',
      [TaxStatus.DEPOSITED]: 'status-completed'
    };
    return classes[status] || 'status-pending';
  }

  // ===== CREDENTIALS MODAL =====

  openCredentialsModal(client: AdminClientListItem) {
    this.selectedClientCredentials = {
      clientName: `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Cliente',
      credentials: client.credentials
    };
    this.showCredentialsModal = true;
    this.cdr.detectChanges();
  }

  closeCredentialsModal() {
    this.showCredentialsModal = false;
    this.selectedClientCredentials = null;
    this.cdr.detectChanges();
  }

  copyToClipboard(value: string | null | undefined) {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      // Optional: show a brief notification
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  // ===== SORTING =====

  sortBy(field: 'name' | 'federalRefund' | 'stateRefund') {
    // If clicking the same field, toggle direction; otherwise set new field with default direction
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      // Name defaults to A-Z (asc), refunds default to highest first (desc)
      this.sortDirection = field === 'name' ? 'asc' : 'desc';
    }
    this.applySorting();
  }

  clearSort() {
    this.sortField = null;
    this.sortDirection = 'asc';
    // Reload to get original order
    this.loadClients();
  }

  private applySorting() {
    if (!this.sortField) return;

    this.filteredClients = [...this.filteredClients].sort((a, b) => {
      let comparison = 0;

      switch (this.sortField) {
        case 'name':
          const nameA = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.toLowerCase();
          const nameB = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;

        case 'federalRefund':
          const fedA = a.federalActualRefund ?? -Infinity;
          const fedB = b.federalActualRefund ?? -Infinity;
          comparison = fedA - fedB;
          break;

        case 'stateRefund':
          const stateA = a.stateActualRefund ?? -Infinity;
          const stateB = b.stateActualRefund ?? -Infinity;
          comparison = stateA - stateB;
          break;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.cdr.detectChanges();
  }
}
