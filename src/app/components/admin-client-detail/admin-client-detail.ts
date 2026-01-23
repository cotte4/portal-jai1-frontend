import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { DocumentService } from '../../core/services/document.service';
import { TicketService } from '../../core/services/ticket.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AdminClientDetail as ClientDetail,
  CaseStatus,
  FederalStatusNew,
  StateStatusNew,
  StatusAlarm,
  Document,
  Ticket,
  UpdateStatusRequest,
  ProblemType,
  ValidTransitionsResponse,
  InvalidTransitionError
} from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-handler';

@Component({
  selector: 'app-admin-client-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-client-detail.html',
  styleUrl: './admin-client-detail.css'
})
export class AdminClientDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);
  private documentService = inject(DocumentService);
  private ticketService = inject(TicketService);
  private dataRefreshService = inject(DataRefreshService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  clientId: string = '';
  client: ClientDetail | null = null;
  tickets: Ticket[] = [];
  statusComment: string = '';
  newMessage: string = '';
  selectedTicketId: string | null = null;

  isLoading: boolean = true;
  isSaving: boolean = false;
  isMarkingPaid: boolean = false;
  isDeleting: boolean = false;
  isSavingFederal: boolean = false;
  isSavingState: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // Ticket loading states
  isLoadingTickets: boolean = false;
  isSendingMessage: boolean = false;
  ticketErrorMessage: string = '';
  ticketSuccessMessage: string = '';

  // Status options
  problemTypeOptions = Object.values(ProblemType);

  // NEW STATUS SYSTEM (v2) options
  caseStatusOptions = Object.values(CaseStatus);
  federalStatusNewOptions = Object.values(FederalStatusNew);
  stateStatusNewOptions = Object.values(StateStatusNew);

  // NEW STATUS SYSTEM (v2) state
  selectedCaseStatus: CaseStatus | null = null;
  selectedFederalStatusNew: FederalStatusNew | null = null;
  selectedStateStatusNew: StateStatusNew | null = null;

  // Alarms
  taxCaseAlarms: StatusAlarm[] = [];
  hasAlarm: boolean = false;
  hasCriticalAlarm: boolean = false;

  // Phase-based status tracking
  taxesFiled: boolean = false;
  taxesFiledAt: string = '';
  isSavingPreFiling: boolean = false;
  isMarkingFiled: boolean = false;
  federalComment: string = '';
  stateComment: string = '';

  // Federal/State tracking (v2 only)
  federalEstimatedDate: string = '';
  stateEstimatedDate: string = '';
  federalActualRefund: number | null = null;
  stateActualRefund: number | null = null;
  federalDepositDate: string = '';
  stateDepositDate: string = '';

  // Problem tracking
  showProblemModal: boolean = false;
  hasProblem: boolean = false;
  selectedProblemType: ProblemType | null = null;
  problemDescription: string = '';

  // Document tabs
  selectedDocumentTab: 'all' | 'w2' | 'payment_proof' | 'other' = 'all';

  // Notification
  showNotifyModal: boolean = false;
  notifyTitle: string = '';
  notifyMessage: string = '';
  notifySendEmail: boolean = false;

  // Status Update Confirmation (deprecated - kept for backward compatibility)
  showStatusConfirmModal: boolean = false;

  // Credentials visibility toggles
  showTurbotaxCredentials: boolean = false;
  showIrsCredentials: boolean = false;
  showStateCredentials: boolean = false;

  // Credentials edit modal
  showCredentialsModal: boolean = false;
  isSavingCredentials: boolean = false;
  editTurbotaxEmail: string = '';
  editTurbotaxPassword: string = '';
  editIrsUsername: string = '';
  editIrsPassword: string = '';
  editStateUsername: string = '';
  editStatePassword: string = '';

  // Confirmation modals
  showMarkPaidConfirm: boolean = false;
  showMarkFiledConfirm: boolean = false;

  // Status transition validation
  validTransitions: ValidTransitionsResponse | null = null;
  validCaseStatusTransitions: string[] = [];
  validFederalStatusTransitions: string[] = [];
  validStateStatusTransitions: string[] = [];

  // Override modal for invalid transitions
  showOverrideModal: boolean = false;
  overrideReason: string = '';
  pendingStatusUpdate: { type: 'case' | 'federal' | 'state'; updateData: UpdateStatusRequest } | null = null;
  overrideError: InvalidTransitionError | null = null;

  ngOnInit() {
    this.clientId = this.route.snapshot.params['id'];
    this.loadClientData();
    // Tickets will be loaded after client data is loaded (need userId, not clientId)

    // Auto-refresh on navigation (dynamic route)
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.startsWith('/admin/client/'))
      ).subscribe(() => {
        const newClientId = this.route.snapshot.params['id'];
        if (newClientId !== this.clientId) {
          this.clientId = newClientId;
        }
        this.loadClientData();
      })
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/admin/client').subscribe(() => this.loadClientData())
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadClientData() {
    this.isLoading = true;
    this.adminService.getClient(this.clientId).subscribe({
      next: (data) => {
        this.client = data;
        if (data.taxCases && data.taxCases.length > 0) {
          const taxCase = data.taxCases[0];
          this.hasProblem = taxCase.hasProblem || false;
          this.selectedProblemType = taxCase.problemType || null;
          this.problemDescription = taxCase.problemDescription || '';
          // Derive taxesFiled from caseStatus (v2)
          this.taxesFiled = taxCase.caseStatus === CaseStatus.TAXES_FILED;
          this.taxesFiledAt = this.taxesFiled && taxCase.caseStatusChangedAt ? this.formatDateForInput(taxCase.caseStatusChangedAt) : '';
          // Load federal/state tracking data (v2)
          this.federalEstimatedDate = taxCase.federalEstimatedDate ? this.formatDateForInput(taxCase.federalEstimatedDate) : '';
          this.stateEstimatedDate = taxCase.stateEstimatedDate ? this.formatDateForInput(taxCase.stateEstimatedDate) : '';
          this.federalActualRefund = taxCase.federalActualRefund || null;
          this.stateActualRefund = taxCase.stateActualRefund || null;
          this.federalDepositDate = taxCase.federalDepositDate ? this.formatDateForInput(taxCase.federalDepositDate) : '';
          this.stateDepositDate = taxCase.stateDepositDate ? this.formatDateForInput(taxCase.stateDepositDate) : '';
          // Load comment fields
          this.federalComment = '';
          this.stateComment = '';
          // NEW STATUS SYSTEM (v2)
          this.selectedCaseStatus = taxCase.caseStatus || null;
          this.selectedFederalStatusNew = taxCase.federalStatusNew || null;
          this.selectedStateStatusNew = taxCase.stateStatusNew || null;
          // Alarms
          this.taxCaseAlarms = taxCase.alarms || [];
          this.hasAlarm = taxCase.hasAlarm || false;
          this.hasCriticalAlarm = taxCase.hasCriticalAlarm || false;
        }
        this.isLoading = false;
        this.cdr.markForCheck();
        // Load tickets using the user ID (not profile ID)
        if (data.user?.id) {
          this.loadTickets(data.user.id);
        }
        // Load valid transitions for status dropdowns
        this.loadValidTransitions();
      },
      error: (error) => {
        this.errorMessage = getErrorMessage(error, 'Error al cargar cliente');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadValidTransitions() {
    this.adminService.getValidTransitions(this.clientId).subscribe({
      next: (transitions) => {
        this.validTransitions = transitions;
        this.validCaseStatusTransitions = transitions.caseStatus.validTransitions;
        this.validFederalStatusTransitions = transitions.federalStatusNew.validTransitions;
        this.validStateStatusTransitions = transitions.stateStatusNew.validTransitions;
        this.cdr.markForCheck();
      },
      error: () => {
        // Don't show error - transitions are optional enhancement
      }
    });
  }

  loadTickets(userId?: string) {
    const userIdToUse = userId || this.client?.user?.id;
    if (!userIdToUse) return;

    this.isLoadingTickets = true;
    this.ticketErrorMessage = '';
    this.ticketService.getTickets(undefined, userIdToUse).subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.isLoadingTickets = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.ticketErrorMessage = getErrorMessage(error, 'Error al cargar los tickets');
        this.isLoadingTickets = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Status Update - uses V2 status system (caseStatus, federalStatusNew, stateStatusNew)
  // Legacy methods kept for backward compatibility but no longer functional
  openStatusConfirmModal() {
    this.toastService.info('Use los controles de estado Federal/Estatal para actualizar el estado');
  }

  closeStatusConfirmModal() {
    this.showStatusConfirmModal = false;
  }

  confirmStatusUpdate() {
    // No longer used - status updates are done via phase-based methods
    this.toastService.info('Use los controles de estado Federal/Estatal para actualizar el estado');
  }

  updateStatus() {
    this.openStatusConfirmModal();
  }

  // Open confirmation modal for markPaid
  openMarkPaidConfirm() {
    this.showMarkPaidConfirm = true;
  }

  // Cancel markPaid confirmation
  cancelMarkPaid() {
    this.showMarkPaidConfirm = false;
  }

  // Actual markPaid action after confirmation
  confirmMarkPaid() {
    this.showMarkPaidConfirm = false;
    this.isMarkingPaid = true;
    this.adminService.markPaid(this.clientId).subscribe({
      next: () => {
        this.isMarkingPaid = false;
        this.toastService.success('Pago marcado como recibido');
        this.loadClientData();
      },
      error: (error) => {
        this.isMarkingPaid = false;
        this.toastService.error(getErrorMessage(error, 'Error al marcar pago'));
      }
    });
  }

  // Legacy method - now opens confirmation modal
  markPaid() {
    this.openMarkPaidConfirm();
  }

  deleteClient() {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
      return;
    }

    this.isDeleting = true;
    this.adminService.deleteClient(this.clientId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.toastService.success('Cliente eliminado correctamente');
        this.router.navigate(['/admin/dashboard']);
      },
      error: (error) => {
        this.isDeleting = false;
        this.toastService.error(getErrorMessage(error, 'Error al eliminar cliente'));
      }
    });
  }

  downloadDocument(doc: Document) {
    this.documentService.getDownloadUrl(doc.id).subscribe({
      next: (response) => {
        window.open(response.url, '_blank');
      },
      error: (error) => {
        this.errorMessage = getErrorMessage(error, 'Error al descargar documento');
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedTicketId || this.isSendingMessage) return;

    this.isSendingMessage = true;
    this.ticketErrorMessage = '';
    this.ticketService.addMessage(this.selectedTicketId, { message: this.newMessage }).subscribe({
      next: () => {
        this.newMessage = '';
        this.ticketSuccessMessage = 'Mensaje enviado';
        this.isSendingMessage = false;
        this.loadTickets();
        setTimeout(() => this.ticketSuccessMessage = '', 3000);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.ticketErrorMessage = getErrorMessage(error, 'Error al enviar el mensaje');
        this.isSendingMessage = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectTicket(ticketId: string) {
    this.selectedTicketId = ticketId;
    this.ticketErrorMessage = '';
    this.ticketSuccessMessage = '';
  }

  get selectedTicket(): Ticket | undefined {
    return this.tickets.find(t => t.id === this.selectedTicketId);
  }

  // DEPRECATED: These methods are kept for backward compatibility in templates
  // V2 status system uses caseStatus, federalStatusNew, stateStatusNew
  getInternalStatusLabel(status: any): string {
    // Legacy support - return generic label
    return status || 'Sin Estado';
  }

  getClientStatusLabel(status: any): string {
    // Legacy support - return generic label
    return status || 'Sin Estado';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(type: string): string {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  // Problem Modal Methods
  openProblemModal() {
    this.showProblemModal = true;
  }

  closeProblemModal() {
    this.showProblemModal = false;
  }

  toggleProblem() {
    this.isSaving = true;
    const problemData = {
      hasProblem: !this.hasProblem,
      problemType: !this.hasProblem ? this.selectedProblemType || undefined : undefined,
      problemDescription: !this.hasProblem ? this.problemDescription : undefined
    };

    this.adminService.setProblem(this.clientId, problemData).subscribe({
      next: () => {
        this.hasProblem = !this.hasProblem;
        if (!this.hasProblem) {
          this.selectedProblemType = null;
          this.problemDescription = '';
        }
        this.showProblemModal = false;
        this.isSaving = false;
        this.toastService.success(this.hasProblem ? 'Problema marcado' : 'Problema resuelto');
        this.loadClientData();
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(getErrorMessage(error, 'Error al actualizar problema'));
      }
    });
  }

  saveProblem() {
    if (!this.selectedProblemType) {
      this.toastService.warning('Seleccione un tipo de problema');
      return;
    }

    this.isSaving = true;
    const problemData = {
      hasProblem: true,
      problemType: this.selectedProblemType,
      problemDescription: this.problemDescription
    };

    this.adminService.setProblem(this.clientId, problemData).subscribe({
      next: () => {
        this.hasProblem = true;
        this.showProblemModal = false;
        this.isSaving = false;
        this.toastService.success('Problema registrado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(getErrorMessage(error, 'Error al guardar problema'));
      }
    });
  }

  resolveProblem() {
    this.isSaving = true;
    this.adminService.setProblem(this.clientId, { hasProblem: false }).subscribe({
      next: () => {
        this.hasProblem = false;
        this.selectedProblemType = null;
        this.problemDescription = '';
        this.showProblemModal = false;
        this.isSaving = false;
        this.toastService.success('Problema resuelto');
        this.loadClientData();
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(getErrorMessage(error, 'Error al resolver problema'));
      }
    });
  }

  getProblemTypeLabel(type: ProblemType | null): string {
    if (!type) return '';
    const labels: Record<ProblemType, string> = {
      [ProblemType.MISSING_DOCUMENTS]: 'Documentos faltantes',
      [ProblemType.INCORRECT_INFORMATION]: 'Informacion incorrecta',
      [ProblemType.IRS_VERIFICATION]: 'Verificacion IRS',
      [ProblemType.BANK_ISSUE]: 'Problema bancario',
      [ProblemType.STATE_ISSUE]: 'Problema estatal',
      [ProblemType.FEDERAL_ISSUE]: 'Problema federal',
      [ProblemType.CLIENT_UNRESPONSIVE]: 'Cliente no responde',
      [ProblemType.OTHER]: 'Otro'
    };
    return labels[type] || type;
  }

  // Notification Modal Methods
  openNotifyModal() {
    this.notifyTitle = '';
    this.notifyMessage = '';
    this.notifySendEmail = false;
    this.showNotifyModal = true;
  }

  closeNotifyModal() {
    this.showNotifyModal = false;
  }

  sendNotification() {
    if (!this.notifyTitle.trim() || !this.notifyMessage.trim()) {
      this.toastService.warning('Título y mensaje son requeridos');
      return;
    }

    this.isSaving = true;
    this.adminService.sendClientNotification(this.clientId, {
      title: this.notifyTitle,
      message: this.notifyMessage,
      sendEmail: this.notifySendEmail
    }).subscribe({
      next: (response) => {
        this.showNotifyModal = false;
        this.isSaving = false;
        this.toastService.success(
          response.emailSent
            ? 'Notificación enviada (app + email)'
            : 'Notificación enviada (solo app)'
        );
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(getErrorMessage(error, 'Error al enviar notificacion'));
      }
    });
  }

  formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }

  // Document filtering by type
  get filteredDocuments(): Document[] {
    if (!this.client?.documents) return [];
    if (this.selectedDocumentTab === 'all') return this.client.documents;
    return this.client.documents.filter(doc => doc.type === this.selectedDocumentTab);
  }

  getDocumentCountByType(type: 'all' | 'w2' | 'payment_proof' | 'other'): number {
    if (!this.client?.documents) return 0;
    if (type === 'all') return this.client.documents.length;
    return this.client.documents.filter(doc => doc.type === type).length;
  }

  selectDocumentTab(tab: 'all' | 'w2' | 'payment_proof' | 'other') {
    this.selectedDocumentTab = tab;
  }

  // Status history label transformation
  getHistoryStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Estado Inicial';

    // Check if it's a step change
    if (status.startsWith('step:')) {
      const step = status.replace('step:', '');
      return `Paso ${step}`;
    }

    // Check if status contains composite data (e.g., "taxesFiled: false, preFiling: awaiting_documents")
    if (status.includes(':') || status.includes(',')) {
      return this.parseCompositeStatus(status);
    }

    // NEW STATUS SYSTEM (v2) - Case Status
    const caseStatusLabels: Record<string, string> = {
      awaiting_form: 'Esperando Formulario',
      awaiting_docs: 'Esperando Documentos',
      preparing: 'Preparando Declaración',
      taxes_filed: 'Taxes Presentados',
      case_issues: 'Problemas en el Caso'
    };

    // NEW STATUS SYSTEM (v2) - Federal/State Status
    const federalStateLabels: Record<string, string> = {
      in_process: 'En Proceso',
      in_verification: 'En Verificación',
      verification_in_progress: 'Verificación en Progreso',
      verification_letter_sent: 'Carta de Verificación Enviada',
      check_in_transit: 'Cheque en Camino',
      issues: 'Problemas',
      taxes_sent: 'Reembolso Enviado',
      taxes_completed: 'Completado'
    };

    // Pre-filing status labels
    const preFilingLabels: Record<string, string> = {
      awaiting_registration: 'Esperando Registro',
      awaiting_documents: 'Esperando Documentos',
      documentation_complete: 'Documentación Completa'
    };

    // Old tax status labels
    const taxStatusLabels: Record<string, string> = {
      filed: 'Presentado',
      pending: 'Pendiente',
      processing: 'En Proceso',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      deposited: 'Depositado'
    };

    // Internal status labels (legacy)
    const internalLabels: Record<string, string> = {
      revision_de_registro: 'Revisión de Registro',
      esperando_datos: 'Esperando Datos',
      falta_documentacion: 'Falta Documentación',
      en_proceso: 'En Proceso',
      en_verificacion: 'En Verificación',
      resolviendo_verificacion: 'Resolviendo Verificación',
      inconvenientes: 'Inconvenientes',
      cheque_en_camino: 'Cheque en Camino',
      esperando_pago_comision: 'Esperando Pago Comisión',
      proceso_finalizado: 'Proceso Finalizado'
    };

    // Client status labels (legacy)
    const clientLabels: Record<string, string> = {
      esperando_datos: 'Esperando Datos',
      cuenta_en_revision: 'Cuenta en Revisión',
      taxes_en_proceso: 'Taxes en Proceso',
      taxes_en_camino: 'Taxes en Camino',
      taxes_depositados: 'Taxes Depositados',
      pago_realizado: 'Pago Realizado',
      en_verificacion: 'En Verificación',
      taxes_finalizados: 'Taxes Finalizados'
    };

    // Try all label mappings
    return caseStatusLabels[status] ||
           federalStateLabels[status] ||
           preFilingLabels[status] ||
           taxStatusLabels[status] ||
           internalLabels[status] ||
           clientLabels[status] ||
           this.formatStatusCode(status);
  }

  // Parse composite status strings (e.g., "taxesFiled: false, preFiling: awaiting_documents")
  private parseCompositeStatus(status: string): string {
    const parts: string[] = [];

    // Split by comma or semicolon
    const segments = status.split(/[,;]/).map(s => s.trim());

    for (const segment of segments) {
      // Check if it's a key-value pair
      if (segment.includes(':')) {
        const [key, value] = segment.split(':').map(s => s.trim());
        const formattedValue = this.formatStatusValue(key, value);
        if (formattedValue) {
          parts.push(formattedValue);
        }
      } else {
        // Just a value, format it
        parts.push(this.getHistoryStatusLabel(segment));
      }
    }

    return parts.length > 0 ? parts.join(' • ') : status;
  }

  // Format individual status values
  private formatStatusValue(key: string, value: string): string {
    const fieldLabels: Record<string, string> = {
      taxesFiled: 'Taxes Presentados',
      preFiling: 'Pre-Presentación',
      preFilingStatus: 'Pre-Presentación',
      caseStatus: 'Estado del Caso',
      federalStatus: 'Federal',
      stateStatus: 'Estatal',
      federalStatusNew: 'Federal',
      stateStatusNew: 'Estatal'
    };

    const fieldLabel = fieldLabels[key] || key;
    const valueLabel = this.getHistoryStatusLabel(value);

    // Handle boolean values
    if (value === 'true') return fieldLabel;
    if (value === 'false') return `${fieldLabel}: No`;

    return `${fieldLabel}: ${valueLabel}`;
  }

  // Format raw status codes to readable form
  private formatStatusCode(code: string): string {
    // Replace underscores with spaces and capitalize each word
    return code
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Credentials toggle methods
  toggleTurbotaxCredentials() {
    this.showTurbotaxCredentials = !this.showTurbotaxCredentials;
  }

  toggleIrsCredentials() {
    this.showIrsCredentials = !this.showIrsCredentials;
  }

  toggleStateCredentials() {
    this.showStateCredentials = !this.showStateCredentials;
  }

  // Credentials modal methods
  openCredentialsModal() {
    if (this.client?.profile) {
      this.editTurbotaxEmail = this.client.profile.turbotaxEmail || '';
      this.editTurbotaxPassword = this.client.profile.turbotaxPassword || '';
      this.editIrsUsername = this.client.profile.irsUsername || '';
      this.editIrsPassword = this.client.profile.irsPassword || '';
      this.editStateUsername = this.client.profile.stateUsername || '';
      this.editStatePassword = this.client.profile.statePassword || '';
    }
    this.showCredentialsModal = true;
  }

  closeCredentialsModal() {
    this.showCredentialsModal = false;
  }

  saveCredentials() {
    if (!this.client) return;

    this.isSavingCredentials = true;

    const updateData: any = {};

    // Only include fields that have values (send empty string to clear)
    if (this.editTurbotaxEmail !== (this.client.profile?.turbotaxEmail || '')) {
      updateData.turbotaxEmail = this.editTurbotaxEmail || null;
    }
    if (this.editTurbotaxPassword !== (this.client.profile?.turbotaxPassword || '')) {
      updateData.turbotaxPassword = this.editTurbotaxPassword || null;
    }
    if (this.editIrsUsername !== (this.client.profile?.irsUsername || '')) {
      updateData.irsUsername = this.editIrsUsername || null;
    }
    if (this.editIrsPassword !== (this.client.profile?.irsPassword || '')) {
      updateData.irsPassword = this.editIrsPassword || null;
    }
    if (this.editStateUsername !== (this.client.profile?.stateUsername || '')) {
      updateData.stateUsername = this.editStateUsername || null;
    }
    if (this.editStatePassword !== (this.client.profile?.statePassword || '')) {
      updateData.statePassword = this.editStatePassword || null;
    }

    // If no changes, close modal
    if (Object.keys(updateData).length === 0) {
      this.isSavingCredentials = false;
      this.showCredentialsModal = false;
      this.toastService.info('No hay cambios que guardar');
      return;
    }

    this.adminService.updateClient(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingCredentials = false;
        this.showCredentialsModal = false;
        this.toastService.success('Credenciales actualizadas correctamente');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingCredentials = false;
        this.toastService.error(getErrorMessage(error, 'Error al guardar credenciales'));
      }
    });
  }

  // ===== MARK TAXES AS FILED =====

  // Open confirmation modal for markTaxesAsFiled
  openMarkFiledConfirm() {
    if (!this.taxesFiledAt) {
      this.toastService.warning('Por favor seleccione la fecha de presentacion');
      return;
    }
    this.showMarkFiledConfirm = true;
  }

  // Cancel markTaxesAsFiled confirmation
  cancelMarkFiled() {
    this.showMarkFiledConfirm = false;
  }

  // Actual markTaxesAsFiled action after confirmation
  confirmMarkFiled() {
    this.showMarkFiledConfirm = false;
    this.isMarkingFiled = true;
    const updateData: UpdateStatusRequest = {
      caseStatus: CaseStatus.TAXES_FILED,
      federalStatusNew: FederalStatusNew.IN_PROCESS,
      stateStatusNew: StateStatusNew.IN_PROCESS
    };

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isMarkingFiled = false;
        this.taxesFiled = true;
        this.toastService.success('Taxes marcados como presentados');
        this.loadClientData();
      },
      error: (error) => {
        this.isMarkingFiled = false;
        this.toastService.error(getErrorMessage(error, 'Error al marcar como presentados'));
      }
    });
  }

  // Legacy method - now opens confirmation modal
  markTaxesAsFiled() {
    this.openMarkFiledConfirm();
  }

  // ===== STATUS SYSTEM (v2) METHODS =====

  getCaseStatusLabel(status: CaseStatus | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<CaseStatus, string> = {
      [CaseStatus.AWAITING_FORM]: 'Esperando Formulario',
      [CaseStatus.AWAITING_DOCS]: 'Esperando Documentos',
      [CaseStatus.PREPARING]: 'Preparando',
      [CaseStatus.TAXES_FILED]: 'Taxes Presentados',
      [CaseStatus.CASE_ISSUES]: 'Problemas'
    };
    return labels[status] || status;
  }

  getFederalStatusNewLabel(status: FederalStatusNew | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<FederalStatusNew, string> = {
      [FederalStatusNew.IN_PROCESS]: 'En Proceso',
      [FederalStatusNew.IN_VERIFICATION]: 'En Verificación',
      [FederalStatusNew.VERIFICATION_IN_PROGRESS]: 'Verificación en Progreso',
      [FederalStatusNew.VERIFICATION_LETTER_SENT]: 'Carta Enviada',
      [FederalStatusNew.CHECK_IN_TRANSIT]: 'Cheque en Camino',
      [FederalStatusNew.DEPOSIT_PENDING]: 'Depósito Pendiente',
      [FederalStatusNew.ISSUES]: 'Problemas',
      [FederalStatusNew.TAXES_SENT]: 'Reembolso Enviado',
      [FederalStatusNew.TAXES_COMPLETED]: 'Completado'
    };
    return labels[status] || status;
  }

  getStateStatusNewLabel(status: StateStatusNew | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<StateStatusNew, string> = {
      [StateStatusNew.IN_PROCESS]: 'En Proceso',
      [StateStatusNew.IN_VERIFICATION]: 'En Verificación',
      [StateStatusNew.VERIFICATION_IN_PROGRESS]: 'Verificación en Progreso',
      [StateStatusNew.VERIFICATION_LETTER_SENT]: 'Carta Enviada',
      [StateStatusNew.CHECK_IN_TRANSIT]: 'Cheque en Camino',
      [StateStatusNew.DEPOSIT_PENDING]: 'Depósito Pendiente',
      [StateStatusNew.ISSUES]: 'Problemas',
      [StateStatusNew.TAXES_SENT]: 'Reembolso Enviado',
      [StateStatusNew.TAXES_COMPLETED]: 'Completado'
    };
    return labels[status] || status;
  }

  getAlarmLevelClass(level: string): string {
    return level === 'critical' ? 'alarm-critical' : 'alarm-warning';
  }

  updateCaseStatus() {
    if (!this.selectedCaseStatus) return;
    const updateData: UpdateStatusRequest = {
      caseStatus: this.selectedCaseStatus
    };
    this.executeCaseStatusUpdate(updateData);
  }

  updateFederalStatusNew() {
    const updateData: UpdateStatusRequest = {};

    if (this.selectedFederalStatusNew) {
      updateData.federalStatusNew = this.selectedFederalStatusNew;
    }
    if (this.federalEstimatedDate) {
      updateData.federalEstimatedDate = this.federalEstimatedDate;
    }
    if (this.federalActualRefund !== null) {
      updateData.federalActualRefund = this.federalActualRefund;
    }
    if (this.federalDepositDate) {
      updateData.federalDepositDate = this.federalDepositDate;
    }
    if (this.federalComment) {
      updateData.federalComment = this.federalComment;
    }

    console.log('[FRONTEND] updateFederalStatusNew - Sending update:', {
      selectedFederalStatusNew: this.selectedFederalStatusNew,
      updateData: JSON.stringify(updateData)
    });

    this.executeFederalStatusUpdate(updateData);
  }

  updateStateStatusNew() {
    const updateData: UpdateStatusRequest = {};

    if (this.selectedStateStatusNew) {
      updateData.stateStatusNew = this.selectedStateStatusNew;
    }
    if (this.stateEstimatedDate) {
      updateData.stateEstimatedDate = this.stateEstimatedDate;
    }
    if (this.stateActualRefund !== null) {
      updateData.stateActualRefund = this.stateActualRefund;
    }
    if (this.stateDepositDate) {
      updateData.stateDepositDate = this.stateDepositDate;
    }
    if (this.stateComment) {
      updateData.stateComment = this.stateComment;
    }

    console.log('[FRONTEND] updateStateStatusNew - Sending update:', {
      selectedStateStatusNew: this.selectedStateStatusNew,
      updateData: JSON.stringify(updateData)
    });

    this.executeStateStatusUpdate(updateData);
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ===== STATUS TRANSITION VALIDATION =====

  /**
   * Check if a case status is a valid transition from current
   */
  isCaseStatusValid(status: CaseStatus): boolean {
    if (!this.validCaseStatusTransitions.length) return true;
    return this.validCaseStatusTransitions.includes(status);
  }

  /**
   * Check if a federal status is a valid transition from current
   */
  isFederalStatusValid(status: FederalStatusNew): boolean {
    if (!this.validFederalStatusTransitions.length) return true;
    return this.validFederalStatusTransitions.includes(status);
  }

  /**
   * Check if a state status is a valid transition from current
   */
  isStateStatusValid(status: StateStatusNew): boolean {
    if (!this.validStateStatusTransitions.length) return true;
    return this.validStateStatusTransitions.includes(status);
  }

  /**
   * Get filtered case status options (valid transitions only)
   */
  get filteredCaseStatusOptions(): CaseStatus[] {
    if (!this.validCaseStatusTransitions.length) {
      return this.caseStatusOptions;
    }
    return this.caseStatusOptions.filter(status =>
      this.validCaseStatusTransitions.includes(status)
    );
  }

  /**
   * Get filtered federal status options (valid transitions only)
   */
  get filteredFederalStatusOptions(): FederalStatusNew[] {
    if (!this.validFederalStatusTransitions.length) {
      return this.federalStatusNewOptions;
    }
    return this.federalStatusNewOptions.filter(status =>
      this.validFederalStatusTransitions.includes(status)
    );
  }

  /**
   * Get filtered state status options (valid transitions only)
   */
  get filteredStateStatusOptions(): StateStatusNew[] {
    if (!this.validStateStatusTransitions.length) {
      return this.stateStatusNewOptions;
    }
    return this.stateStatusNewOptions.filter(status =>
      this.validStateStatusTransitions.includes(status)
    );
  }

  // ===== OVERRIDE MODAL METHODS =====

  openOverrideModal(type: 'case' | 'federal' | 'state', updateData: UpdateStatusRequest, error: InvalidTransitionError) {
    this.pendingStatusUpdate = { type, updateData };
    this.overrideError = error;
    this.overrideReason = '';
    this.showOverrideModal = true;
  }

  closeOverrideModal() {
    this.showOverrideModal = false;
    this.overrideReason = '';
    this.pendingStatusUpdate = null;
    this.overrideError = null;
  }

  confirmOverride() {
    if (!this.pendingStatusUpdate || this.overrideReason.length < 10) {
      this.toastService.warning('La razon debe tener al menos 10 caracteres');
      return;
    }

    const { type, updateData } = this.pendingStatusUpdate;

    // Add force transition fields
    updateData.forceTransition = true;
    updateData.overrideReason = this.overrideReason;

    // Close modal first
    this.closeOverrideModal();

    // Retry the update with force
    switch (type) {
      case 'case':
        this.executeCaseStatusUpdate(updateData);
        break;
      case 'federal':
        this.executeFederalStatusUpdate(updateData);
        break;
      case 'state':
        this.executeStateStatusUpdate(updateData);
        break;
    }
  }

  /**
   * Handle status update errors - check for invalid transition
   */
  private handleStatusUpdateError(error: any, type: 'case' | 'federal' | 'state', updateData: UpdateStatusRequest): boolean {
    // Check if it's an invalid transition error
    const errorBody = error?.error;
    if (errorBody?.code === 'INVALID_STATUS_TRANSITION') {
      this.openOverrideModal(type, updateData, errorBody as InvalidTransitionError);
      return true;
    }
    return false;
  }

  // ===== UPDATED STATUS UPDATE METHODS WITH TRANSITION VALIDATION =====

  private executeCaseStatusUpdate(updateData: UpdateStatusRequest) {
    this.isSavingPreFiling = true;
    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingPreFiling = false;
        this.toastService.success('Estado del caso actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingPreFiling = false;
        if (!this.handleStatusUpdateError(error, 'case', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado'));
        }
      }
    });
  }

  private executeFederalStatusUpdate(updateData: UpdateStatusRequest) {
    this.isSavingFederal = true;
    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingFederal = false;
        this.federalComment = '';
        this.toastService.success('Estado Federal (v2) actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingFederal = false;
        if (!this.handleStatusUpdateError(error, 'federal', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado federal'));
        }
      }
    });
  }

  private executeStateStatusUpdate(updateData: UpdateStatusRequest) {
    this.isSavingState = true;
    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingState = false;
        this.stateComment = '';
        this.toastService.success('Estado Estatal (v2) actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingState = false;
        if (!this.handleStatusUpdateError(error, 'state', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado estatal'));
        }
      }
    });
  }
}
