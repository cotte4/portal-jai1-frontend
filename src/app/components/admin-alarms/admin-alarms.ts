import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import {
  AlarmDashboardItem,
  AlarmDashboardResponse,
  AlarmHistoryItem,
  AlarmResolution,
  AlarmType,
  AlarmLevel,
  ThresholdsResponse,
  SetThresholdsRequest,
  DEFAULT_ALARM_THRESHOLDS,
  StatusAlarm
} from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-handler';
import { ThemeService } from '../../core/services/theme.service';

type TabType = 'active' | 'history';

@Component({
  selector: 'app-admin-alarms',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-alarms.html',
  styleUrl: './admin-alarms.css'
})
export class AdminAlarms implements OnInit, OnDestroy {
  private router = inject(Router);
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private subscriptions = new Subscription();

  get darkMode() { return this.themeService.darkMode(); }

  // Tab state
  activeTab: TabType = 'active';

  // Loading states
  isLoading = false;
  hasLoaded = false;
  errorMessage = '';

  // Dashboard data
  dashboardItems: AlarmDashboardItem[] = [];
  filteredItems: AlarmDashboardItem[] = [];
  totalWithAlarms = 0;
  totalCritical = 0;
  totalWarning = 0;

  // History data
  historyItems: AlarmHistoryItem[] = [];
  filteredHistory: AlarmHistoryItem[] = [];
  isLoadingHistory = false;
  hasLoadedHistory = false;

  // Filters
  searchQuery = '';
  levelFilter: 'all' | 'critical' | 'warning' = 'all';
  historyResolutionFilter: AlarmResolution | 'all' = 'all';
  historyTrackFilter: 'all' | 'federal' | 'state' = 'all';

  // Thresholds modal
  showThresholdsModal = false;
  selectedTaxCaseId: string | null = null;
  selectedClientName = '';
  thresholdsData: ThresholdsResponse | null = null;
  isLoadingThresholds = false;
  isSavingThresholds = false;
  thresholdsForm: SetThresholdsRequest = {};

  // Resolve modal
  showResolveModal = false;
  selectedAlarmId: string | null = null;
  resolveNote = '';
  isResolving = false;

  // Default thresholds for reference
  defaults = DEFAULT_ALARM_THRESHOLDS;

  // Help banner
  showHelp = false;

  // Sync status
  lastSyncAt: string | null = null;
  syncStats: { casesProcessed: number; alarmsTriggered: number; alarmsAutoResolved: number; errors: number } | null = null;
  isSyncing = false;

  ngOnInit() {
    this.loadDashboard();
    this.loadSyncStatus();
  }

  // ===== TAB NAVIGATION =====

  switchTab(tab: TabType) {
    this.activeTab = tab;
    if (tab === 'history' && !this.hasLoadedHistory) {
      this.loadHistory();
    }
  }

  // ===== DASHBOARD =====

  loadDashboard() {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.adminService.getAlarmDashboard().pipe(
        finalize(() => {
          this.isLoading = false;
          this.hasLoaded = true;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (response: AlarmDashboardResponse) => {
          this.dashboardItems = response.items;
          this.totalWithAlarms = response.totalWithAlarms;
          this.totalCritical = response.totalCritical;
          this.totalWarning = response.totalWarning;
          this.applyFilters();
        },
        error: (error) => {
          this.errorMessage = getErrorMessage(error, 'Error al cargar alarmas');
        }
      })
    );
  }

  // ===== HISTORY =====

  loadHistory() {
    this.isLoadingHistory = true;

    const filters: any = {};
    if (this.historyResolutionFilter !== 'all') {
      filters.resolution = this.historyResolutionFilter;
    }
    if (this.historyTrackFilter !== 'all') {
      filters.track = this.historyTrackFilter;
    }

    this.subscriptions.add(
      this.adminService.getAlarmHistory(filters).pipe(
        finalize(() => {
          this.isLoadingHistory = false;
          this.hasLoadedHistory = true;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (items: AlarmHistoryItem[]) => {
          this.historyItems = items;
          this.applyHistoryFilters();
        },
        error: () => {
          // Error loading history - silently fail
        }
      })
    );
  }

  // ===== FILTERS =====

  applyFilters() {
    let items = [...this.dashboardItems];

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(item =>
        item.clientName.toLowerCase().includes(query) ||
        item.clientEmail.toLowerCase().includes(query)
      );
    }

    // Level filter
    if (this.levelFilter !== 'all') {
      items = items.filter(item => item.highestLevel === this.levelFilter);
    }

    this.filteredItems = items;
    this.cdr.detectChanges();
  }

  applyHistoryFilters() {
    let items = [...this.historyItems];

    // Search by client name
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(item =>
        item.clientName.toLowerCase().includes(query)
      );
    }

    this.filteredHistory = items;
    this.cdr.detectChanges();
  }

  onSearchChange() {
    if (this.activeTab === 'active') {
      this.applyFilters();
    } else {
      this.applyHistoryFilters();
    }
  }

  onLevelFilterChange() {
    this.applyFilters();
  }

  onHistoryFiltersChange() {
    this.loadHistory();
  }

  // ===== ACTIONS =====

  viewClient(taxCaseId: string) {
    // Navigate to client detail - need to find the client ID from the taxCaseId
    // For now, navigate to a general view
    this.router.navigate(['/admin/client', taxCaseId]);
  }

  acknowledgeAlarm(alarmId: string, event: Event) {
    event.stopPropagation();

    this.subscriptions.add(
      this.adminService.acknowledgeAlarm(alarmId).subscribe({
        next: () => {
          // Refresh history
          if (this.hasLoadedHistory) {
            this.loadHistory();
          }
        },
        error: () => {
          // Error acknowledging alarm - silently fail
        }
      })
    );
  }

  openResolveModal(alarmId: string, event: Event) {
    event.stopPropagation();
    this.selectedAlarmId = alarmId;
    this.resolveNote = '';
    this.showResolveModal = true;
  }

  closeResolveModal() {
    this.showResolveModal = false;
    this.selectedAlarmId = null;
    this.resolveNote = '';
  }

  confirmResolve() {
    if (!this.selectedAlarmId) return;

    this.isResolving = true;
    this.subscriptions.add(
      this.adminService.resolveAlarm(this.selectedAlarmId, this.resolveNote || undefined).pipe(
        finalize(() => {
          this.isResolving = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: () => {
          this.closeResolveModal();
          this.loadHistory();
        },
        error: () => {
          // Error resolving alarm - silently fail
        }
      })
    );
  }

  // ===== THRESHOLDS MODAL =====

  openThresholdsModal(item: AlarmDashboardItem) {
    this.selectedTaxCaseId = item.taxCaseId;
    this.selectedClientName = item.clientName;
    this.showThresholdsModal = true;
    this.loadThresholds(item.taxCaseId);
  }

  closeThresholdsModal() {
    this.showThresholdsModal = false;
    this.selectedTaxCaseId = null;
    this.thresholdsData = null;
    this.thresholdsForm = {};
  }

  loadThresholds(taxCaseId: string) {
    this.isLoadingThresholds = true;

    this.subscriptions.add(
      this.adminService.getAlarmThresholds(taxCaseId).pipe(
        finalize(() => {
          this.isLoadingThresholds = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (data: ThresholdsResponse) => {
          this.thresholdsData = data;
          // Initialize form with current values
          this.thresholdsForm = {
            federalInProcessDays: data.thresholds.federalInProcessDays,
            stateInProcessDays: data.thresholds.stateInProcessDays,
            verificationTimeoutDays: data.thresholds.verificationTimeoutDays,
            letterSentTimeoutDays: data.thresholds.letterSentTimeoutDays,
            disableFederalAlarms: data.thresholds.disableFederalAlarms,
            disableStateAlarms: data.thresholds.disableStateAlarms,
            reason: data.reason || ''
          };
        },
        error: () => {
          // Error loading thresholds - silently fail
        }
      })
    );
  }

  saveThresholds() {
    if (!this.selectedTaxCaseId) return;

    this.isSavingThresholds = true;

    this.subscriptions.add(
      this.adminService.setAlarmThresholds(this.selectedTaxCaseId, this.thresholdsForm).pipe(
        finalize(() => {
          this.isSavingThresholds = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: () => {
          this.closeThresholdsModal();
          this.loadDashboard();
        },
        error: () => {
          // Error saving thresholds - silently fail
        }
      })
    );
  }

  resetToDefaults() {
    if (!this.selectedTaxCaseId) return;

    this.isSavingThresholds = true;

    this.subscriptions.add(
      this.adminService.deleteAlarmThresholds(this.selectedTaxCaseId).pipe(
        finalize(() => {
          this.isSavingThresholds = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: () => {
          this.closeThresholdsModal();
          this.loadDashboard();
        },
        error: () => {
          // Error resetting thresholds - silently fail
        }
      })
    );
  }

  // ===== SYNC STATUS =====

  loadSyncStatus() {
    this.subscriptions.add(
      this.adminService.getAlarmSyncStatus().subscribe({
        next: (status) => {
          this.lastSyncAt = status.lastSyncAt;
          this.syncStats = {
            casesProcessed: status.casesProcessed,
            alarmsTriggered: status.alarmsTriggered,
            alarmsAutoResolved: status.alarmsAutoResolved,
            errors: status.errors,
          };
          this.cdr.detectChanges();
        },
        error: () => {
          // Silently fail — sync status is non-critical
        }
      })
    );
  }

  triggerFullSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.cdr.detectChanges();

    this.subscriptions.add(
      this.adminService.triggerAlarmSyncAll().pipe(
        finalize(() => {
          this.isSyncing = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (status) => {
          this.lastSyncAt = status.lastSyncAt;
          this.syncStats = {
            casesProcessed: status.casesProcessed,
            alarmsTriggered: status.alarmsTriggered,
            alarmsAutoResolved: status.alarmsAutoResolved,
            errors: status.errors,
          };
          // Refresh dashboard after sync
          this.loadDashboard();
          if (this.hasLoadedHistory) {
            this.loadHistory();
          }
        },
        error: () => {
          // Silently fail
        }
      })
    );
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
  }

  // ===== HELPERS =====

  getAlarmActionHint(type: string): string {
    const hints: Record<string, string> = {
      possible_verification_federal: 'Verificar con el IRS si entro en verificacion',
      possible_verification_state: 'Verificar con el estado si entro en verificacion',
      verification_timeout: 'Llamar al IRS/estado para pedir actualizacion del caso',
      letter_sent_timeout: 'Hacer seguimiento de la carta enviada',
    };
    return hints[type] || '';
  }

  formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Nunca sincronizado';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  }

  getInitials(name: string): string {
    const parts = name.split(' ');
    const first = parts[0]?.charAt(0)?.toUpperCase() || '?';
    const last = parts[1]?.charAt(0)?.toUpperCase() || '';
    return first + last;
  }

  formatDate(date: string | null): string {
    if (!date) return '---';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  formatDateTime(date: string | null): string {
    if (!date) return '---';
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAlarmLevelClass(level: AlarmLevel | null): string {
    if (!level) return '';
    return level === 'critical' ? 'alarm-critical' : 'alarm-warning';
  }

  getAlarmTypeLabel(type: AlarmType): string {
    const labels: Record<AlarmType, string> = {
      possible_verification_federal: 'Posible Verificacion (Federal)',
      possible_verification_state: 'Posible Verificacion (Estatal)',
      verification_timeout: 'Verificacion Excedida',
      letter_sent_timeout: 'Carta Sin Respuesta'
    };
    return labels[type] || type;
  }

  getResolutionLabel(resolution: AlarmResolution): string {
    const labels: Record<AlarmResolution, string> = {
      active: 'Activa',
      acknowledged: 'Vista',
      resolved: 'Resuelta',
      auto_resolved: 'Auto-resuelta'
    };
    return labels[resolution] || resolution;
  }

  getResolutionClass(resolution: AlarmResolution): string {
    const classes: Record<AlarmResolution, string> = {
      active: 'resolution-active',
      acknowledged: 'resolution-acknowledged',
      resolved: 'resolution-resolved',
      auto_resolved: 'resolution-auto'
    };
    return classes[resolution] || '';
  }

  getStatusLabel(status: string | null): string {
    if (!status) return '---';
    const labels: Record<string, string> = {
      in_process: 'En Proceso',
      in_verification: 'En Verificacion',
      verification_in_progress: 'Verificacion en Progreso',
      check_in_transit: 'Cheque en Camino',
      issues: 'Problemas',
      taxes_sent: 'Reembolso Enviado',
      taxes_completed: 'Completado'
    };
    return labels[status] || status;
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  refreshData() {
    this.searchQuery = '';
    this.levelFilter = 'all';
    if (this.activeTab === 'active') {
      this.loadDashboard();
    } else {
      this.loadHistory();
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // ===== TRACKBY FUNCTIONS =====

  trackByTaxCaseId(index: number, item: AlarmDashboardItem): string {
    return item.taxCaseId;
  }

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }
}
