import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminService, SeasonStats } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import {
  AdminClientListItem,
  CaseStatus,
  FederalStatusNew,
  StateStatusNew,
  StatusAlarm,
  ClientCredentials,
  ClientStatusFilter,
  AdvancedFilters
} from '../../core/models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboard implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private isInitialLoad = true; // Prevents URL sync on initial load from URL
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  allClients: AdminClientListItem[] = [];
  filteredClients: AdminClientListItem[] = [];
  selectedFilter: ClientStatusFilter = 'all';
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

  // Race condition prevention for stats loading
  private statsRequestId = 0;

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

  // Sorting (server-side for name/createdAt, client-side for refunds)
  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Missing docs check
  isCheckingMissingDocs: boolean = false;
  showMissingDocsModal: boolean = false;
  missingDocsResult: { notified: number; skipped: number } | null = null;

  // Missing docs cron status
  missingDocsCronEnabled: boolean = false;
  isLoadingCronStatus: boolean = false;
  isTogglingCron: boolean = false;
  showMissingDocsInfoModal: boolean = false;

  // Advanced filters
  showAdvancedFilters: boolean = false;
  advancedFilters: AdvancedFilters = {
    hasProblem: null,
    federalStatus: null,
    stateStatus: null,
    caseStatus: null,
    dateFrom: null,
    dateTo: null,
  };
  activeAdvancedFiltersCount: number = 0;

  // Dropdown options for advanced filters
  hasProblemOptions = [
    { value: null, label: 'Todos' },
    { value: true, label: 'Con Problemas' },
    { value: false, label: 'Sin Problemas' },
  ];

  federalStatusOptions = [
    { value: null, label: 'Todos' },
    { value: FederalStatusNew.IN_PROCESS, label: 'En Proceso' },
    { value: FederalStatusNew.IN_VERIFICATION, label: 'En Verificacion' },
    { value: FederalStatusNew.VERIFICATION_IN_PROGRESS, label: 'Verif. en Progreso' },
    { value: FederalStatusNew.VERIFICATION_LETTER_SENT, label: 'Carta Enviada' },
    { value: FederalStatusNew.CHECK_IN_TRANSIT, label: 'Cheque en Camino' },
    { value: FederalStatusNew.DEPOSIT_PENDING, label: 'Deposito Pendiente' },
    { value: FederalStatusNew.ISSUES, label: 'Problemas' },
    { value: FederalStatusNew.TAXES_SENT, label: 'Impuestos Enviados' },
    { value: FederalStatusNew.TAXES_COMPLETED, label: 'Completado' },
  ];

  stateStatusOptions = [
    { value: null, label: 'Todos' },
    { value: StateStatusNew.IN_PROCESS, label: 'En Proceso' },
    { value: StateStatusNew.IN_VERIFICATION, label: 'En Verificacion' },
    { value: StateStatusNew.VERIFICATION_IN_PROGRESS, label: 'Verif. en Progreso' },
    { value: StateStatusNew.VERIFICATION_LETTER_SENT, label: 'Carta Enviada' },
    { value: StateStatusNew.CHECK_IN_TRANSIT, label: 'Cheque en Camino' },
    { value: StateStatusNew.DEPOSIT_PENDING, label: 'Deposito Pendiente' },
    { value: StateStatusNew.ISSUES, label: 'Problemas' },
    { value: StateStatusNew.TAXES_SENT, label: 'Impuestos Enviados' },
    { value: StateStatusNew.TAXES_COMPLETED, label: 'Completado' },
  ];

  caseStatusOptions = [
    { value: null, label: 'Todos' },
    { value: CaseStatus.AWAITING_FORM, label: 'Esperando Form' },
    { value: CaseStatus.AWAITING_DOCS, label: 'Esperando Docs' },
    { value: CaseStatus.PREPARING, label: 'Preparando' },
    { value: CaseStatus.TAXES_FILED, label: 'Presentados' },
    { value: CaseStatus.CASE_ISSUES, label: 'Con Problemas' },
  ];

  // Status filter options - using new phase-based status system
  statusFilters: { value: ClientStatusFilter; label: string; group: string }[] = [
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
    // Read filters from URL params first
    this.loadFiltersFromUrl();

    this.loadClients();
    this.loadSeasonStats();
    this.loadMissingDocsCronStatus();

    // Mark initial load complete after first load
    this.refreshTimeout = setTimeout(() => { this.isInitialLoad = false; }, 100);

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.startsWith('/admin/dashboard'))
      ).subscribe(() => {
        this.loadFiltersFromUrl();
        this.loadClients();
      })
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
        this.syncFiltersToUrl();
        this.loadClients();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
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

    // Build advanced filters object (only include non-null values)
    const advFilters = this.buildActiveAdvancedFilters();

    this.adminService.getClients(statusFilter, searchFilter, undefined, 500, advFilters, this.sortColumn, this.sortDirection).subscribe({
      next: (response) => {
        this.filteredClients = response.clients;
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = response.clients.length;

        // For stats, we need to load all clients without any filter (only on initial load or refresh)
        // Don't recalculate if any filters are active
        if (!statusFilter && !searchFilter && !advFilters) {
          this.allClients = response.clients;
          this.calculateStats();
        }

        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
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

    // Also load stats separately (all clients without filters) if we have any active filter
    if (statusFilter || searchFilter || advFilters) {
      this.loadStats();
    }
  }

  // Load stats separately (all clients without filters)
  private loadStats() {
    const currentRequestId = ++this.statsRequestId;
    this.adminService.getClients(undefined, undefined, undefined, 500).subscribe({
      next: (response) => {
        // Only update if this is still the latest request (prevents race condition)
        if (currentRequestId !== this.statsRequestId) return;
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
      error: () => {
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
    const advFilters = this.buildActiveAdvancedFilters();

    this.adminService.getClients(statusFilter, searchFilter, this.nextCursor, 500, advFilters, this.sortColumn, this.sortDirection).subscribe({
      next: (response) => {
        this.filteredClients = [...this.filteredClients, ...response.clients];
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = this.filteredClients.length;
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      },
      error: () => {
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

    // Single pass through clients using new phase-based status system (v2)
    for (const client of this.allClients) {
      const taxesFiled = client.caseStatus === CaseStatus.TAXES_FILED;
      const federalStatusNew = client.federalStatusNew;
      const stateStatusNew = client.stateStatusNew;

      if (!taxesFiled) {
        // Pending: not yet filed
        this.stats.pending++;
      } else if (federalStatusNew === FederalStatusNew.TAXES_COMPLETED || stateStatusNew === StateStatusNew.TAXES_COMPLETED) {
        // Completed: at least one completed
        this.stats.completed++;
      } else if (federalStatusNew === FederalStatusNew.ISSUES || stateStatusNew === StateStatusNew.ISSUES) {
        // Needs Attention: has issues
        this.stats.needsAttention++;
      } else {
        // In Review: filed but not yet completed or with issues
        this.stats.inReview++;
      }
    }
  }

  filterClients(filter: ClientStatusFilter) {
    this.selectedFilter = filter;
    this.syncFiltersToUrl();
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
    this.syncFiltersToUrl();
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

  // V2 status label mapping
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Sin Asignar';

    const labels: Record<string, string> = {
      // FederalStatusNew / StateStatusNew
      'in_process': 'En Proceso',
      'in_verification': 'En Verificación',
      'verification_in_progress': 'Verif. en Progreso',
      'verification_letter_sent': 'Carta Enviada',
      'deposit_pending': 'Depósito Pendiente',
      'check_in_transit': 'Cheque en Camino',
      'issues': 'Problemas',
      'taxes_sent': 'Reembolso Enviado',
      'taxes_completed': 'Completado',
      // CaseStatus
      'awaiting_form': 'Esperando Form',
      'awaiting_docs': 'Esperando Docs',
      'preparing': 'Preparando',
      'taxes_filed': 'Presentados',
      'case_issues': 'Con Problemas',
    };

    return labels[status] || status;
  }

  // V2 status CSS class mapping
  getStatusClass(status: string | null | undefined): string {
    if (!status) return 'status-pending';

    const classes: Record<string, string> = {
      'in_process': 'status-in-progress',
      'in_verification': 'status-in-progress',
      'verification_in_progress': 'status-in-progress',
      'verification_letter_sent': 'status-warning',
      'deposit_pending': 'status-approved',
      'check_in_transit': 'status-approved',
      'issues': 'status-rejected',
      'taxes_sent': 'status-approved',
      'taxes_completed': 'status-completed',
      'awaiting_form': 'status-pending',
      'awaiting_docs': 'status-pending',
      'preparing': 'status-in-progress',
      'taxes_filed': 'status-approved',
      'case_issues': 'status-rejected',
    };

    return classes[status] || 'status-pending';
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

  goToTickets() {
    this.router.navigate(['/admin/tickets']);
  }

  goToAlarms() {
    this.router.navigate(['/admin/alarms']);
  }

  goToJai1gents() {
    this.router.navigate(['/admin/jai1gents']);
  }

  exportToExcel() {
    if (this.isExporting) return;

    this.isExporting = true;
    this.errorMessage = '';

    // Pass current filters to export
    const statusFilter = this.selectedFilter === 'all' ? undefined : this.selectedFilter;
    const searchFilter = this.searchQuery || undefined;
    const advFilters = this.buildActiveAdvancedFilters();

    this.adminService.exportToExcel(statusFilter, searchFilter, advFilters).subscribe({
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
    }).catch(() => {
      // Clipboard operation failed silently
    });
  }

  // ===== SORTING (Server-side) =====

  sortBy(column: string) {
    // If clicking the same column, toggle direction; otherwise set new column with default direction
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      // Name/email defaults to A-Z (asc), dates default to newest first (desc)
      this.sortDirection = (column === 'name' || column === 'email') ? 'asc' : 'desc';
    }
    // Reload with server-side sorting
    this.syncFiltersToUrl();
    this.loadClients();
  }

  clearSort() {
    this.sortColumn = 'createdAt';
    this.sortDirection = 'desc';
    this.syncFiltersToUrl();
    this.loadClients();
  }

  // ===== NEW STATUS SYSTEM (v2) METHODS =====

  getCaseStatusLabel(status: CaseStatus | null | undefined): string {
    if (!status) return 'Sin estado';
    const labels: Record<CaseStatus, string> = {
      [CaseStatus.AWAITING_FORM]: 'Esperando Form',
      [CaseStatus.AWAITING_DOCS]: 'Esperando Docs',
      [CaseStatus.PREPARING]: 'Preparando',
      [CaseStatus.TAXES_FILED]: 'Presentados',
      [CaseStatus.CASE_ISSUES]: 'Problemas'
    };
    return labels[status] || status;
  }

  getFederalStatusNewLabel(status: FederalStatusNew | null | undefined): string {
    if (!status) return 'Sin estado';
    const labels: Record<FederalStatusNew, string> = {
      [FederalStatusNew.IN_PROCESS]: 'En Proceso',
      [FederalStatusNew.IN_VERIFICATION]: 'Verificación',
      [FederalStatusNew.VERIFICATION_IN_PROGRESS]: 'Verif. Progreso',
      [FederalStatusNew.VERIFICATION_LETTER_SENT]: 'Carta Enviada',
      [FederalStatusNew.CHECK_IN_TRANSIT]: 'Cheque Camino',
      [FederalStatusNew.DEPOSIT_PENDING]: 'Depósito Pendiente',
      [FederalStatusNew.ISSUES]: 'Problemas',
      [FederalStatusNew.TAXES_SENT]: 'Enviado',
      [FederalStatusNew.TAXES_COMPLETED]: 'Completado'
    };
    return labels[status] || status;
  }

  getStateStatusNewLabel(status: StateStatusNew | null | undefined): string {
    if (!status) return 'Sin estado';
    const labels: Record<StateStatusNew, string> = {
      [StateStatusNew.IN_PROCESS]: 'En Proceso',
      [StateStatusNew.IN_VERIFICATION]: 'Verificación',
      [StateStatusNew.VERIFICATION_IN_PROGRESS]: 'Verif. Progreso',
      [StateStatusNew.VERIFICATION_LETTER_SENT]: 'Carta Enviada',
      [StateStatusNew.CHECK_IN_TRANSIT]: 'Cheque Camino',
      [StateStatusNew.DEPOSIT_PENDING]: 'Depósito Pendiente',
      [StateStatusNew.ISSUES]: 'Problemas',
      [StateStatusNew.TAXES_SENT]: 'Enviado',
      [StateStatusNew.TAXES_COMPLETED]: 'Completado'
    };
    return labels[status] || status;
  }

  getAlarmIndicator(client: AdminClientListItem): string {
    if (client.hasCriticalAlarm) return '🔴';
    if (client.hasAlarm) return '🟡';
    return '';
  }

  hasAnyAlarm(client: AdminClientListItem): boolean {
    return client.hasAlarm || false;
  }

  // ===== ADVANCED FILTERS =====

  toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.cdr.detectChanges();
  }

  applyAdvancedFilters() {
    // Validate date range
    if (this.advancedFilters.dateFrom && this.advancedFilters.dateTo) {
      const from = new Date(this.advancedFilters.dateFrom);
      const to = new Date(this.advancedFilters.dateTo);
      if (from > to) {
        this.errorMessage = 'La fecha "Desde" no puede ser mayor que la fecha "Hasta"';
        this.cdr.detectChanges();
        return;
      }
    }
    this.errorMessage = '';
    this.updateActiveFiltersCount();
    this.syncFiltersToUrl();
    this.loadClients();
  }

  clearAdvancedFilters() {
    this.advancedFilters = {
      hasProblem: null,
      federalStatus: null,
      stateStatus: null,
      caseStatus: null,
      dateFrom: null,
      dateTo: null,
    };
    this.activeAdvancedFiltersCount = 0;
    this.syncFiltersToUrl();
    this.loadClients();
  }

  private buildActiveAdvancedFilters(): AdvancedFilters | undefined {
    const filters: AdvancedFilters = {};
    let hasAnyFilter = false;

    if (this.advancedFilters.hasProblem !== null) {
      filters.hasProblem = this.advancedFilters.hasProblem;
      hasAnyFilter = true;
    }
    if (this.advancedFilters.federalStatus) {
      filters.federalStatus = this.advancedFilters.federalStatus;
      hasAnyFilter = true;
    }
    if (this.advancedFilters.stateStatus) {
      filters.stateStatus = this.advancedFilters.stateStatus;
      hasAnyFilter = true;
    }
    if (this.advancedFilters.caseStatus) {
      filters.caseStatus = this.advancedFilters.caseStatus;
      hasAnyFilter = true;
    }
    if (this.advancedFilters.dateFrom) {
      filters.dateFrom = this.advancedFilters.dateFrom;
      hasAnyFilter = true;
    }
    if (this.advancedFilters.dateTo) {
      filters.dateTo = this.advancedFilters.dateTo;
      hasAnyFilter = true;
    }

    return hasAnyFilter ? filters : undefined;
  }

  private updateActiveFiltersCount() {
    let count = 0;
    if (this.advancedFilters.hasProblem !== null) count++;
    if (this.advancedFilters.federalStatus) count++;
    if (this.advancedFilters.stateStatus) count++;
    if (this.advancedFilters.caseStatus) count++;
    if (this.advancedFilters.dateFrom) count++;
    if (this.advancedFilters.dateTo) count++;
    this.activeAdvancedFiltersCount = count;
  }

  // ===== COMBINED FILTER INDICATOR =====

  /**
   * Get total count of all active filters (group + search + advanced)
   */
  getTotalActiveFiltersCount(): number {
    let count = 0;
    if (this.selectedFilter !== 'all') count++;
    if (this.searchQuery) count++;
    count += this.activeAdvancedFiltersCount;
    return count;
  }

  /**
   * Get list of active filter labels for display
   */
  getActiveFilterLabels(): { key: string; label: string }[] {
    const labels: { key: string; label: string }[] = [];

    // Group filter
    if (this.selectedFilter !== 'all') {
      const filterOption = this.statusFilters.find(f => f.value === this.selectedFilter);
      if (filterOption) {
        labels.push({ key: 'group', label: filterOption.label });
      }
    }

    // Search
    if (this.searchQuery) {
      labels.push({ key: 'search', label: `"${this.searchQuery}"` });
    }

    // Advanced filters
    if (this.advancedFilters.hasProblem !== null) {
      labels.push({
        key: 'hasProblem',
        label: this.advancedFilters.hasProblem ? 'Con problemas' : 'Sin problemas'
      });
    }
    if (this.advancedFilters.federalStatus) {
      const statusLabel = this.getFederalStatusNewLabel(this.advancedFilters.federalStatus as any);
      labels.push({ key: 'federalStatus', label: `Federal: ${statusLabel}` });
    }
    if (this.advancedFilters.stateStatus) {
      const statusLabel = this.getStateStatusNewLabel(this.advancedFilters.stateStatus as any);
      labels.push({ key: 'stateStatus', label: `Estatal: ${statusLabel}` });
    }
    if (this.advancedFilters.caseStatus) {
      const statusLabel = this.getCaseStatusLabel(this.advancedFilters.caseStatus as any);
      labels.push({ key: 'caseStatus', label: `Caso: ${statusLabel}` });
    }
    if (this.advancedFilters.dateFrom || this.advancedFilters.dateTo) {
      const from = this.advancedFilters.dateFrom || '...';
      const to = this.advancedFilters.dateTo || '...';
      labels.push({ key: 'dateRange', label: `${from} a ${to}` });
    }

    return labels;
  }

  /**
   * Remove a specific filter by key
   */
  removeFilter(key: string) {
    switch (key) {
      case 'group':
        this.selectedFilter = 'all';
        break;
      case 'search':
        this.searchQuery = '';
        break;
      case 'hasProblem':
        this.advancedFilters.hasProblem = null;
        break;
      case 'federalStatus':
        this.advancedFilters.federalStatus = null;
        break;
      case 'stateStatus':
        this.advancedFilters.stateStatus = null;
        break;
      case 'caseStatus':
        this.advancedFilters.caseStatus = null;
        break;
      case 'dateRange':
        this.advancedFilters.dateFrom = null;
        this.advancedFilters.dateTo = null;
        break;
    }
    this.updateActiveFiltersCount();
    this.syncFiltersToUrl();
    this.loadClients();
  }

  /**
   * Clear all filters at once
   */
  clearAllFilters() {
    this.selectedFilter = 'all';
    this.searchQuery = '';
    this.advancedFilters = {
      hasProblem: null,
      federalStatus: null,
      stateStatus: null,
      caseStatus: null,
      dateFrom: null,
      dateTo: null,
    };
    this.activeAdvancedFiltersCount = 0;
    this.syncFiltersToUrl();
    this.loadClients();
  }

  // ===== URL FILTER PERSISTENCE =====

  /**
   * Read filters from URL query params and apply them
   */
  private loadFiltersFromUrl() {
    const params = this.route.snapshot.queryParams;

    // Status filter
    if (params['status']) {
      this.selectedFilter = params['status'] as ClientStatusFilter;
    }

    // Search
    if (params['search']) {
      this.searchQuery = params['search'];
    }

    // Sorting
    if (params['sortBy']) {
      this.sortColumn = params['sortBy'];
    }
    if (params['sortOrder'] === 'asc' || params['sortOrder'] === 'desc') {
      this.sortDirection = params['sortOrder'];
    }

    // Advanced filters
    if (params['hasProblem'] === 'true' || params['hasProblem'] === 'false') {
      this.advancedFilters.hasProblem = params['hasProblem'] === 'true';
    }
    if (params['federalStatus']) {
      this.advancedFilters.federalStatus = params['federalStatus'] as any;
    }
    if (params['stateStatus']) {
      this.advancedFilters.stateStatus = params['stateStatus'] as any;
    }
    if (params['caseStatus']) {
      this.advancedFilters.caseStatus = params['caseStatus'] as any;
    }
    if (params['dateFrom']) {
      this.advancedFilters.dateFrom = params['dateFrom'];
    }
    if (params['dateTo']) {
      this.advancedFilters.dateTo = params['dateTo'];
    }

    // Update advanced filters count
    this.updateActiveFiltersCount();
  }

  /**
   * Sync current filters to URL query params (without page reload)
   */
  private syncFiltersToUrl() {
    // Skip during initial load to avoid unnecessary navigation
    if (this.isInitialLoad) return;

    const params: Record<string, string> = {};

    // Status filter
    if (this.selectedFilter && this.selectedFilter !== 'all') {
      params['status'] = this.selectedFilter;
    }

    // Search
    if (this.searchQuery) {
      params['search'] = this.searchQuery;
    }

    // Sorting (only if not default)
    if (this.sortColumn !== 'createdAt' || this.sortDirection !== 'desc') {
      params['sortBy'] = this.sortColumn;
      params['sortOrder'] = this.sortDirection;
    }

    // Advanced filters
    if (this.advancedFilters.hasProblem !== null && this.advancedFilters.hasProblem !== undefined) {
      params['hasProblem'] = this.advancedFilters.hasProblem.toString();
    }
    if (this.advancedFilters.federalStatus) {
      params['federalStatus'] = this.advancedFilters.federalStatus;
    }
    if (this.advancedFilters.stateStatus) {
      params['stateStatus'] = this.advancedFilters.stateStatus;
    }
    if (this.advancedFilters.caseStatus) {
      params['caseStatus'] = this.advancedFilters.caseStatus;
    }
    if (this.advancedFilters.dateFrom) {
      params['dateFrom'] = this.advancedFilters.dateFrom;
    }
    if (this.advancedFilters.dateTo) {
      params['dateTo'] = this.advancedFilters.dateTo;
    }

    // Update URL without triggering navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true, // Replace current history entry instead of adding new one
    });
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByFilterValue(index: number, filter: { value: string }): string {
    return filter.value;
  }

  // ===== MISSING DOCUMENTS CHECK =====

  checkMissingDocuments() {
    if (this.isCheckingMissingDocs) return;

    this.isCheckingMissingDocs = true;
    this.missingDocsResult = null;

    this.adminService.checkMissingDocuments(3, 3).subscribe({
      next: (result) => {
        this.missingDocsResult = { notified: result.notified, skipped: result.skipped };
        this.showMissingDocsModal = true;
        this.isCheckingMissingDocs = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Error al verificar documentos faltantes';
        this.isCheckingMissingDocs = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeMissingDocsModal() {
    this.showMissingDocsModal = false;
    this.missingDocsResult = null;
    this.cdr.detectChanges();
  }

  // ===== MISSING DOCS CRON CONTROL =====

  loadMissingDocsCronStatus() {
    this.isLoadingCronStatus = true;
    this.adminService.getMissingDocsCronStatus().subscribe({
      next: (status) => {
        this.missingDocsCronEnabled = status.enabled;
        this.isLoadingCronStatus = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingCronStatus = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleMissingDocsCron() {
    if (this.isTogglingCron) return;

    this.isTogglingCron = true;
    const newStatus = !this.missingDocsCronEnabled;

    this.adminService.setMissingDocsCronStatus(newStatus).subscribe({
      next: (result) => {
        this.missingDocsCronEnabled = result.enabled;
        this.isTogglingCron = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Error al cambiar estado del cron';
        this.isTogglingCron = false;
        this.cdr.detectChanges();
      }
    });
  }
}
