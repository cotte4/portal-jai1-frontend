import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminClientListItem, InternalStatus } from '../../core/models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  allClients: AdminClientListItem[] = []; // Full list for stats
  clients: AdminClientListItem[] = [];
  filteredClients: AdminClientListItem[] = [];
  selectedFilter: string = 'all';
  searchQuery: string = '';
  isLoading: boolean = false;
  isLoadingMore: boolean = false;
  errorMessage: string = '';
  nextCursor: string | undefined;
  hasMore: boolean = false;

  stats = {
    total: 0,
    pending: 0,
    inReview: 0,
    completed: 0,
    needsAttention: 0
  };

  // Status filter options
  statusFilters = [
    { value: 'all', label: 'Todos' },
    { value: 'sin_asignar', label: 'Sin Asignar' },
    { value: InternalStatus.REVISION_DE_REGISTRO, label: 'Revision de Registro' },
    { value: InternalStatus.ESPERANDO_DATOS, label: 'Esperando Datos' },
    { value: InternalStatus.FALTA_DOCUMENTACION, label: 'Falta Documentacion' },
    { value: InternalStatus.EN_PROCESO, label: 'En Proceso' },
    { value: InternalStatus.EN_VERIFICACION, label: 'En Verificacion' },
    { value: InternalStatus.CHEQUE_EN_CAMINO, label: 'Cheque en Camino' },
    { value: InternalStatus.PROCESO_FINALIZADO, label: 'Finalizado' }
  ];

  ngOnInit() {
    this.loadAllClients();
  }

  // Load all clients for both display and stats
  loadAllClients() {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.adminService.getClients(undefined, undefined, undefined, 100).subscribe({
      next: (response) => {
        this.allClients = response.clients;
        this.clients = response.clients;
        this.applyLocalFilter();
        this.calculateStats();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.errorMessage = error?.error?.message || error?.message || 'Error al cargar clientes';
        this.isLoading = false;
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
    } else if (this.selectedFilter === 'sin_asignar') {
      this.filteredClients = this.allClients.filter(c => 
        !c.internalStatus && this.matchesSearch(c)
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
    const clientsForStats = this.allClients.length > 0 ? this.allClients : this.clients;
    
    this.stats.total = clientsForStats.length;
    
    // Pending: includes null status (new clients), ESPERANDO_DATOS, REVISION_DE_REGISTRO
    this.stats.pending = clientsForStats.filter(c =>
      !c.internalStatus || // null status = new client = pending
      c.internalStatus === InternalStatus.ESPERANDO_DATOS ||
      c.internalStatus === InternalStatus.REVISION_DE_REGISTRO
    ).length;
    
    // In Review: EN_PROCESO, EN_VERIFICACION, RESOLVIENDO_VERIFICACION
    this.stats.inReview = clientsForStats.filter(c =>
      c.internalStatus === InternalStatus.EN_PROCESO ||
      c.internalStatus === InternalStatus.EN_VERIFICACION ||
      c.internalStatus === InternalStatus.RESOLVIENDO_VERIFICACION
    ).length;
    
    // Completed: PROCESO_FINALIZADO, CHEQUE_EN_CAMINO, ESPERANDO_PAGO_COMISION
    this.stats.completed = clientsForStats.filter(c =>
      c.internalStatus === InternalStatus.PROCESO_FINALIZADO ||
      c.internalStatus === InternalStatus.CHEQUE_EN_CAMINO ||
      c.internalStatus === InternalStatus.ESPERANDO_PAGO_COMISION
    ).length;
    
    // Needs Attention: FALTA_DOCUMENTACION, INCONVENIENTES
    this.stats.needsAttention = clientsForStats.filter(c =>
      c.internalStatus === InternalStatus.FALTA_DOCUMENTACION ||
      c.internalStatus === InternalStatus.INCONVENIENTES
    ).length;
  }

  filterClients(filter: string) {
    this.selectedFilter = filter;
    this.applyLocalFilter();
  }

  onSearch() {
    this.applyLocalFilter();
  }

  refreshData() {
    this.loadAllClients();
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
    this.adminService.exportToExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al exportar';
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
