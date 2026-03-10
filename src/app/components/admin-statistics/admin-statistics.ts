import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdminService, DashboardStats, SeasonStats } from '../../core/services/admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';

interface StatusBarItem {
  key: string;
  label: string;
  count: number;
  percent: number;
  colorClass: string;
}

@Component({
  selector: 'app-admin-statistics',
  imports: [CommonModule],
  templateUrl: './admin-statistics.html',
  styleUrl: './admin-statistics.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminStatistics implements OnInit, OnDestroy {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  themeService = inject(ThemeService);
  private authService = inject(AuthService);

  private subscriptions = new Subscription();

  isLoading = true;
  errorMessage: string = '';
  dashboardStats: DashboardStats | null = null;
  seasonStats: SeasonStats | null = null;

  get darkMode(): boolean {
    return this.themeService.darkMode();
  }

  // Sidebar
  sidebarCollapsed = typeof window !== 'undefined' && window.innerWidth <= 1024;

  // Status label maps
  private caseStatusLabels: Record<string, string> = {
    awaiting_form: 'Esperando Form',
    awaiting_docs: 'Esperando Docs',
    documentos_enviados: 'Docs Enviados',
    preparing: 'Preparando',
    taxes_filed: 'Presentados',
    case_issues: 'Con Problemas',
  };

  private federalStatusLabels: Record<string, string> = {
    taxes_en_proceso: 'En Proceso',
    en_verificacion: 'En Verificación',
    verificacion_en_progreso: 'Verificación en Progreso',
    cheque_en_camino: 'Cheque en Camino',
    problemas: 'Problemas',
    verificacion_rechazada: 'Verificación Rechazada',
    deposito_directo: 'Depósito Directo',
    comision_pendiente: 'Comisión Pendiente',
    taxes_completados: 'Taxes Completados',
  };

  private statusColorClasses: Record<string, string> = {
    taxes_en_proceso: 'bar-blue',
    en_verificacion: 'bar-yellow',
    verificacion_en_progreso: 'bar-yellow',
    cheque_en_camino: 'bar-green',
    problemas: 'bar-red',
    verificacion_rechazada: 'bar-red',
    deposito_directo: 'bar-green',
    comision_pendiente: 'bar-orange',
    taxes_completados: 'bar-teal',
    awaiting_form: 'bar-gray',
    awaiting_docs: 'bar-gray',
    documentos_enviados: 'bar-blue',
    preparing: 'bar-blue',
    taxes_filed: 'bar-green',
    case_issues: 'bar-red',
  };

  ngOnInit() {
    this.loadAll();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadAll() {
    this.isLoading = true;
    this.errorMessage = '';
    let pending = 2;
    const done = () => { if (--pending === 0) { this.isLoading = false; this.cdr.detectChanges(); } };

    this.adminService.getDashboardStats().subscribe({
      next: (stats) => { this.dashboardStats = stats; done(); },
      error: (err) => {
        this.errorMessage = `getDashboardStats falló: HTTP ${err?.status || 'desconocido'} — ${err?.error?.message || err?.message || 'sin detalle'}`;
        done();
      }
    });

    this.adminService.getSeasonStats().subscribe({
      next: (stats) => { this.seasonStats = stats; done(); },
      error: (err) => {
        if (!this.errorMessage) {
          this.errorMessage = `getSeasonStats falló: HTTP ${err?.status || 'desconocido'} — ${err?.error?.message || err?.message || 'sin detalle'}`;
        }
        done();
      }
    });
  }

  // Build bar chart data from a breakdown record
  buildBarItems(breakdown: Record<string, number>, labelMap: Record<string, string>): StatusBarItem[] {
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    if (total === 0) return [];

    return Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        key,
        label: labelMap[key] || key,
        count,
        percent: Math.round((count / total) * 100),
        colorClass: this.statusColorClasses[key] || 'bar-gray',
      }));
  }

  get caseStatusBars(): StatusBarItem[] {
    if (!this.dashboardStats) return [];
    return this.buildBarItems(this.dashboardStats.caseStatusBreakdown, this.caseStatusLabels);
  }

  get federalStatusBars(): StatusBarItem[] {
    if (!this.dashboardStats) return [];
    return this.buildBarItems(this.dashboardStats.federalStatusBreakdown, this.federalStatusLabels);
  }

  get stateStatusBars(): StatusBarItem[] {
    if (!this.dashboardStats) return [];
    return this.buildBarItems(this.dashboardStats.stateStatusBreakdown, this.federalStatusLabels);
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.detectChanges();
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
    this.cdr.detectChanges();
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/admin-login']),
      error: () => this.router.navigate(['/admin-login'])
    });
  }

  goToDashboard() { this.router.navigate(['/admin/dashboard']); }
  goToDelays() { this.router.navigate(['/admin/delays']); }
  goToPayments() { this.router.navigate(['/admin/payments']); }
  goToAccounts() { this.router.navigate(['/admin/accounts']); }
  goToReferrals() { this.router.navigate(['/admin/referrals']); }
  goToTickets() { this.router.navigate(['/admin/tickets']); }
  goToAlarms() { this.router.navigate(['/admin/alarms']); }
  goToJai1gents() { this.router.navigate(['/admin/jai1gents']); }
  goToIrsMonitor() { this.router.navigate(['/admin/irs-monitor']); }
  goToColoradoMonitor() { this.router.navigate(['/admin/colorado-monitor']); }

  trackByKey(index: number, item: StatusBarItem): string {
    return item.key;
  }
}
