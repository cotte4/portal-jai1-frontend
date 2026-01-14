import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AdminClientListItem, InternalStatus } from '../../core/models';

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
  errorMessage: string = '';
  errorCode: string = '';
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

  // Status filter options - organized by groups then individual statuses
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
    { value: 'incomplete', label: '⚠ Incompletos', group: 'special' },
    { value: 'sin_asignar', label: 'Sin Asignar', group: 'special' },
    // Individual statuses (all 10)
    { value: InternalStatus.REVISION_DE_REGISTRO, label: 'Revision de Registro', group: 'status' },
    { value: InternalStatus.ESPERANDO_DATOS, label: 'Esperando Datos', group: 'status' },
    { value: InternalStatus.FALTA_DOCUMENTACION, label: 'Falta Documentacion', group: 'status' },
    { value: InternalStatus.EN_PROCESO, label: 'En Proceso', group: 'status' },
    { value: InternalStatus.EN_VERIFICACION, label: 'En Verificacion', group: 'status' },
    { value: InternalStatus.RESOLVIENDO_VERIFICACION, label: 'Resolviendo Verificacion', group: 'status' },
    { value: InternalStatus.INCONVENIENTES, label: 'Inconvenientes', group: 'status' },
    { value: InternalStatus.CHEQUE_EN_CAMINO, label: 'Cheque en Camino', group: 'status' },
    { value: InternalStatus.ESPERANDO_PAGO_COMISION, label: 'Esperando Pago Comision', group: 'status' },
    { value: InternalStatus.PROCESO_FINALIZADO, label: 'Finalizado', group: 'status' }
  ];

  ngOnInit() {
    this.loadAllClients();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/admin/dashboard')
      ).subscribe(() => this.loadAllClients())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/admin/dashboard').subscribe(() => this.loadAllClients())
    );

    // Debounced search - auto-search after 300ms of no typing
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.applyLocalFilter();
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Load all clients for both display and stats
  loadAllClients(isRefresh: boolean = false) {
    if (isRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.errorCode = '';

    this.adminService.getClients(undefined, undefined, undefined, 100).subscribe({
      next: (response) => {
        this.allClients = response.clients;
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = response.clients.length;
        this.applyLocalFilter();
        this.calculateStats();
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
  }

  // Load more clients (pagination)
  loadMoreClients() {
    if (!this.hasMore || this.isLoadingMore || !this.nextCursor) return;

    this.isLoadingMore = true;

    this.adminService.getClients(undefined, undefined, this.nextCursor, 100).subscribe({
      next: (response) => {
        this.allClients = [...this.allClients, ...response.clients];
        this.nextCursor = response.nextCursor;
        this.hasMore = response.hasMore;
        this.totalLoaded = this.allClients.length;
        this.applyLocalFilter();
        this.calculateStats();
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

  // Apply filter locally instead of making API calls
  applyLocalFilter() {
    if (this.selectedFilter === 'all') {
      this.filteredClients = this.searchQuery
        ? this.allClients.filter(c => this.matchesSearch(c))
        : this.allClients;
    } else if (this.selectedFilter === 'ready_to_present') {
      this.filteredClients = this.allClients.filter(c =>
        c.isReadyToPresent && this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'incomplete') {
      this.filteredClients = this.allClients.filter(c =>
        !c.isReadyToPresent && this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'sin_asignar') {
      this.filteredClients = this.allClients.filter(c =>
        !c.internalStatus && this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'group_pending') {
      // Matches stats.pending calculation
      this.filteredClients = this.allClients.filter(c =>
        (!c.internalStatus ||
          c.internalStatus === InternalStatus.ESPERANDO_DATOS ||
          c.internalStatus === InternalStatus.REVISION_DE_REGISTRO) &&
        this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'group_in_review') {
      // Matches stats.inReview calculation
      this.filteredClients = this.allClients.filter(c =>
        (c.internalStatus === InternalStatus.EN_PROCESO ||
          c.internalStatus === InternalStatus.EN_VERIFICACION ||
          c.internalStatus === InternalStatus.RESOLVIENDO_VERIFICACION) &&
        this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'group_completed') {
      // Matches stats.completed calculation
      this.filteredClients = this.allClients.filter(c =>
        (c.internalStatus === InternalStatus.PROCESO_FINALIZADO ||
          c.internalStatus === InternalStatus.CHEQUE_EN_CAMINO ||
          c.internalStatus === InternalStatus.ESPERANDO_PAGO_COMISION) &&
        this.matchesSearch(c)
      );
    } else if (this.selectedFilter === 'group_needs_attention') {
      // Matches stats.needsAttention calculation
      this.filteredClients = this.allClients.filter(c =>
        (c.internalStatus === InternalStatus.FALTA_DOCUMENTACION ||
          c.internalStatus === InternalStatus.INCONVENIENTES) &&
        this.matchesSearch(c)
      );
    } else {
      this.filteredClients = this.allClients.filter(c =>
        c.internalStatus === this.selectedFilter && this.matchesSearch(c)
      );
    }
  }

  matchesSearch(client: AdminClientListItem): boolean {
    if (!this.searchQuery) return true;
    const query = this.searchQuery.toLowerCase();
    return (
      client.user?.email?.toLowerCase().includes(query) ||
      client.user?.firstName?.toLowerCase().includes(query) ||
      client.user?.lastName?.toLowerCase().includes(query)
    );
  }

  calculateStats() {
    // Reset stats
    this.stats.total = this.allClients.length;
    this.stats.pending = 0;
    this.stats.inReview = 0;
    this.stats.completed = 0;
    this.stats.needsAttention = 0;

    // Single pass through clients for better performance
    for (const client of this.allClients) {
      const status = client.internalStatus;

      if (!status ||
          status === InternalStatus.ESPERANDO_DATOS ||
          status === InternalStatus.REVISION_DE_REGISTRO) {
        // Pending: null status (new clients), ESPERANDO_DATOS, REVISION_DE_REGISTRO
        this.stats.pending++;
      } else if (status === InternalStatus.EN_PROCESO ||
                 status === InternalStatus.EN_VERIFICACION ||
                 status === InternalStatus.RESOLVIENDO_VERIFICACION) {
        // In Review: EN_PROCESO, EN_VERIFICACION, RESOLVIENDO_VERIFICACION
        this.stats.inReview++;
      } else if (status === InternalStatus.PROCESO_FINALIZADO ||
                 status === InternalStatus.CHEQUE_EN_CAMINO ||
                 status === InternalStatus.ESPERANDO_PAGO_COMISION) {
        // Completed: PROCESO_FINALIZADO, CHEQUE_EN_CAMINO, ESPERANDO_PAGO_COMISION
        this.stats.completed++;
      } else if (status === InternalStatus.FALTA_DOCUMENTACION ||
                 status === InternalStatus.INCONVENIENTES) {
        // Needs Attention: FALTA_DOCUMENTACION, INCONVENIENTES
        this.stats.needsAttention++;
      }
    }
  }

  filterClients(filter: string) {
    this.selectedFilter = filter;
    this.applyLocalFilter();
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
    this.applyLocalFilter();
  }

  clearError() {
    this.errorMessage = '';
    this.errorCode = '';
  }

  refreshData() {
    this.loadAllClients(true);
  }

  getStatusLabel(status: InternalStatus | null | undefined): string {
    if (!status) return 'Sin Asignar';
    
    const labels: Record<InternalStatus, string> = {
      [InternalStatus.REVISION_DE_REGISTRO]: 'Revision Registro',
      [InternalStatus.ESPERANDO_DATOS]: 'Esperando Datos',
      [InternalStatus.FALTA_DOCUMENTACION]: 'Falta Docs',
      [InternalStatus.EN_PROCESO]: 'En Proceso',
      [InternalStatus.EN_VERIFICACION]: 'Verificacion',
      [InternalStatus.RESOLVIENDO_VERIFICACION]: 'Resolviendo',
      [InternalStatus.INCONVENIENTES]: 'Inconvenientes',
      [InternalStatus.CHEQUE_EN_CAMINO]: 'Cheque Camino',
      [InternalStatus.ESPERANDO_PAGO_COMISION]: 'Esperando Pago',
      [InternalStatus.PROCESO_FINALIZADO]: 'Finalizado'
    };
    return labels[status] || status;
  }

  getStatusClass(status: InternalStatus | null | undefined): string {
    if (!status) return 'status-new';
    
    const classes: Record<InternalStatus, string> = {
      [InternalStatus.REVISION_DE_REGISTRO]: 'status-pending',
      [InternalStatus.ESPERANDO_DATOS]: 'status-pending',
      [InternalStatus.FALTA_DOCUMENTACION]: 'status-needs-attention',
      [InternalStatus.EN_PROCESO]: 'status-in-review',
      [InternalStatus.EN_VERIFICACION]: 'status-in-review',
      [InternalStatus.RESOLVIENDO_VERIFICACION]: 'status-needs-attention',
      [InternalStatus.INCONVENIENTES]: 'status-needs-attention',
      [InternalStatus.CHEQUE_EN_CAMINO]: 'status-approved',
      [InternalStatus.ESPERANDO_PAGO_COMISION]: 'status-approved',
      [InternalStatus.PROCESO_FINALIZADO]: 'status-completed'
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
}
