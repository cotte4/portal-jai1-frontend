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
  InternalStatus,
  ClientStatus,
  TaxStatus,
  PreFilingStatus,
  Document,
  Ticket,
  UpdateStatusRequest,
  ProblemType
} from '../../core/models';

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
  selectedInternalStatus: InternalStatus = InternalStatus.REVISION_DE_REGISTRO;
  selectedClientStatus: ClientStatus = ClientStatus.ESPERANDO_DATOS;
  statusComment: string = '';
  newMessage: string = '';
  selectedTicketId: string | null = null;

  isLoading: boolean = true;
  isSaving: boolean = false;
  isMarkingPaid: boolean = false;
  isDeleting: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // Ticket loading states
  isLoadingTickets: boolean = false;
  isSendingMessage: boolean = false;
  ticketErrorMessage: string = '';
  ticketSuccessMessage: string = '';

  // Status options
  internalStatusOptions = Object.values(InternalStatus);
  clientStatusOptions = Object.values(ClientStatus);
  taxStatusOptions = Object.values(TaxStatus);
  preFilingStatusOptions = Object.values(PreFilingStatus);
  problemTypeOptions = Object.values(ProblemType);

  // NEW: Phase-based status tracking
  taxesFiled: boolean = false;
  taxesFiledAt: string = '';
  selectedPreFilingStatus: PreFilingStatus = PreFilingStatus.AWAITING_REGISTRATION;
  preFilingComment: string = '';
  isSavingPreFiling: boolean = false;
  isMarkingFiled: boolean = false;
  federalComment: string = '';
  stateComment: string = '';

  // Federal/State tracking
  selectedFederalStatus: TaxStatus | null = null;
  selectedStateStatus: TaxStatus | null = null;
  federalEstimatedDate: string = '';
  stateEstimatedDate: string = '';
  federalActualRefund: number | null = null;
  stateActualRefund: number | null = null;
  federalDepositDate: string = '';
  stateDepositDate: string = '';
  isSavingFederalState: boolean = false;

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

  // Status Update Confirmation
  showStatusConfirmModal: boolean = false;
  pendingInternalStatus: InternalStatus | null = null;
  pendingClientStatus: ClientStatus | null = null;

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
          this.selectedInternalStatus = taxCase.internalStatus;
          this.selectedClientStatus = taxCase.clientStatus;
          this.hasProblem = taxCase.hasProblem || false;
          this.selectedProblemType = taxCase.problemType || null;
          this.problemDescription = taxCase.problemDescription || '';
          // Load phase-based status data
          this.taxesFiled = taxCase.taxesFiled || false;
          this.taxesFiledAt = taxCase.taxesFiledAt ? this.formatDateForInput(taxCase.taxesFiledAt) : '';
          this.selectedPreFilingStatus = taxCase.preFilingStatus || PreFilingStatus.AWAITING_REGISTRATION;
          // Load federal/state tracking data
          this.selectedFederalStatus = taxCase.federalStatus || null;
          this.selectedStateStatus = taxCase.stateStatus || null;
          this.federalEstimatedDate = taxCase.federalEstimatedDate ? this.formatDateForInput(taxCase.federalEstimatedDate) : '';
          this.stateEstimatedDate = taxCase.stateEstimatedDate ? this.formatDateForInput(taxCase.stateEstimatedDate) : '';
          this.federalActualRefund = taxCase.federalActualRefund || null;
          this.stateActualRefund = taxCase.stateActualRefund || null;
          this.federalDepositDate = taxCase.federalDepositDate ? this.formatDateForInput(taxCase.federalDepositDate) : '';
          this.stateDepositDate = taxCase.stateDepositDate ? this.formatDateForInput(taxCase.stateDepositDate) : '';
          // Load comment fields
          this.federalComment = '';
          this.stateComment = '';
          this.preFilingComment = '';
        }
        this.isLoading = false;
        this.cdr.markForCheck();
        // Load tickets using the user ID (not profile ID)
        if (data.user?.id) {
          this.loadTickets(data.user.id);
        }
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar cliente';
        this.isLoading = false;
        this.cdr.markForCheck();
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
        this.ticketErrorMessage = 'Error al cargar los tickets';
        this.isLoadingTickets = false;
        console.error('Error loading tickets:', error);
        this.cdr.markForCheck();
      }
    });
  }

  // Status Update Confirmation Modal Methods
  openStatusConfirmModal() {
    if (!this.client?.taxCases?.[0]) return;

    const currentInternalStatus = this.client.taxCases[0].internalStatus;
    const currentClientStatus = this.client.taxCases[0].clientStatus;

    // Check if status has actually changed
    if (this.selectedInternalStatus === currentInternalStatus &&
        this.selectedClientStatus === currentClientStatus) {
      this.toastService.warning('No hay cambios en el estado');
      return;
    }

    this.pendingInternalStatus = this.selectedInternalStatus;
    this.pendingClientStatus = this.selectedClientStatus;
    this.showStatusConfirmModal = true;
  }

  closeStatusConfirmModal() {
    this.showStatusConfirmModal = false;
    this.pendingInternalStatus = null;
    this.pendingClientStatus = null;
  }

  confirmStatusUpdate() {
    if (!this.client) return;

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request: UpdateStatusRequest = {
      internalStatus: this.selectedInternalStatus,
      clientStatus: this.selectedClientStatus,
      comment: this.statusComment || undefined
    };

    this.adminService.updateStatus(this.clientId, request).subscribe({
      next: () => {
        this.statusComment = '';
        this.isSaving = false;
        this.showStatusConfirmModal = false;
        this.pendingInternalStatus = null;
        this.pendingClientStatus = null;
        this.toastService.success('Estado actualizado correctamente');
        this.loadClientData();
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(error.message || 'Error al actualizar estado');
      }
    });
  }

  updateStatus() {
    this.openStatusConfirmModal();
  }

  markPaid() {
    this.isMarkingPaid = true;
    this.adminService.markPaid(this.clientId).subscribe({
      next: () => {
        this.isMarkingPaid = false;
        this.toastService.success('Pago marcado como recibido');
        this.loadClientData();
      },
      error: (error) => {
        this.isMarkingPaid = false;
        this.toastService.error(error.message || 'Error al marcar pago');
      }
    });
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
        this.toastService.error(error.message || 'Error al eliminar cliente');
      }
    });
  }

  downloadDocument(doc: Document) {
    this.documentService.getDownloadUrl(doc.id).subscribe({
      next: (response) => {
        window.open(response.url, '_blank');
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al descargar documento';
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
        this.ticketErrorMessage = 'Error al enviar el mensaje';
        this.isSendingMessage = false;
        console.error('Error sending message:', error);
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

  getInternalStatusLabel(status: InternalStatus): string {
    const labels: Record<InternalStatus, string> = {
      [InternalStatus.REVISION_DE_REGISTRO]: 'Revision de Registro',
      [InternalStatus.ESPERANDO_DATOS]: 'Esperando Datos',
      [InternalStatus.FALTA_DOCUMENTACION]: 'Falta Documentacion',
      [InternalStatus.EN_PROCESO]: 'En Proceso',
      [InternalStatus.EN_VERIFICACION]: 'En Verificacion',
      [InternalStatus.RESOLVIENDO_VERIFICACION]: 'Resolviendo Verificacion',
      [InternalStatus.INCONVENIENTES]: 'Inconvenientes',
      [InternalStatus.CHEQUE_EN_CAMINO]: 'Cheque en Camino',
      [InternalStatus.ESPERANDO_PAGO_COMISION]: 'Esperando Pago Comision',
      [InternalStatus.PROCESO_FINALIZADO]: 'Proceso Finalizado'
    };
    return labels[status] || status;
  }

  getClientStatusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      [ClientStatus.ESPERANDO_DATOS]: 'Esperando Datos',
      [ClientStatus.CUENTA_EN_REVISION]: 'Cuenta en Revision',
      [ClientStatus.TAXES_EN_PROCESO]: 'Taxes en Proceso',
      [ClientStatus.TAXES_EN_CAMINO]: 'Taxes en Camino',
      [ClientStatus.TAXES_DEPOSITADOS]: 'Taxes Depositados',
      [ClientStatus.PAGO_REALIZADO]: 'Pago Realizado',
      [ClientStatus.EN_VERIFICACION]: 'En Verificacion',
      [ClientStatus.TAXES_FINALIZADOS]: 'Taxes Finalizados'
    };
    return labels[status] || status;
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
        this.toastService.error(error.message || 'Error al actualizar problema');
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
        this.toastService.error(error.message || 'Error al guardar problema');
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
        this.toastService.error(error.message || 'Error al resolver problema');
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
        this.toastService.error(error.message || 'Error al enviar notificación');
      }
    });
  }

  // Federal/State Status Methods
  getTaxStatusLabel(status: TaxStatus | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<TaxStatus, string> = {
      [TaxStatus.FILED]: 'Presentado',
      [TaxStatus.PENDING]: 'Pendiente',
      [TaxStatus.PROCESSING]: 'En Proceso',
      [TaxStatus.APPROVED]: 'Aprobado',
      [TaxStatus.REJECTED]: 'Rechazado',
      [TaxStatus.DEPOSITED]: 'Depositado'
    };
    return labels[status] || status;
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
    if (!status) return 'Nuevo';

    // Check if it's a step change
    if (status.startsWith('step:')) {
      const step = status.replace('step:', '');
      return `Paso ${step}`;
    }

    // Internal status labels
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

    // Client status labels
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

    return internalLabels[status] || clientLabels[status] || status;
  }

  updateFederalStatus() {
    this.isSavingFederalState = true;
    const updateData: any = {};

    if (this.selectedFederalStatus) {
      updateData.federalStatus = this.selectedFederalStatus;
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

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingFederalState = false;
        this.toastService.success('Estado Federal actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingFederalState = false;
        this.toastService.error(error.message || 'Error al actualizar estado federal');
      }
    });
  }

  updateStateStatus() {
    this.isSavingFederalState = true;
    const updateData: any = {};

    if (this.selectedStateStatus) {
      updateData.stateStatus = this.selectedStateStatus;
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

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingFederalState = false;
        this.toastService.success('Estado Estatal actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingFederalState = false;
        this.toastService.error(error.message || 'Error al actualizar estado estatal');
      }
    });
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
        this.toastService.error(error.message || 'Error al guardar credenciales');
      }
    });
  }

  // ===== PHASE-BASED STATUS METHODS =====

  getPreFilingStatusLabel(status: PreFilingStatus | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<PreFilingStatus, string> = {
      [PreFilingStatus.AWAITING_REGISTRATION]: 'Esperando Registro',
      [PreFilingStatus.AWAITING_DOCUMENTS]: 'Esperando Documentos',
      [PreFilingStatus.DOCUMENTATION_COMPLETE]: 'Documentacion Completa'
    };
    return labels[status] || status;
  }

  updatePreFilingStatus() {
    this.isSavingPreFiling = true;
    const updateData: any = {
      preFilingStatus: this.selectedPreFilingStatus
    };

    if (this.preFilingComment) {
      updateData.comment = this.preFilingComment;
    }

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingPreFiling = false;
        this.preFilingComment = '';
        this.toastService.success('Estado pre-presentacion actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingPreFiling = false;
        this.toastService.error(error.message || 'Error al actualizar estado');
      }
    });
  }

  markTaxesAsFiled() {
    if (!this.taxesFiledAt) {
      this.toastService.warning('Por favor seleccione la fecha de presentacion');
      return;
    }

    this.isMarkingFiled = true;
    const updateData: any = {
      taxesFiled: true,
      taxesFiledAt: this.taxesFiledAt,
      // Set initial federal/state status to 'filed'
      federalStatus: TaxStatus.FILED,
      stateStatus: TaxStatus.FILED
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
        this.toastService.error(error.message || 'Error al marcar como presentados');
      }
    });
  }

  // Updated federal status with comment
  updateFederalStatusWithComment() {
    this.isSavingFederalState = true;
    const updateData: any = {};

    if (this.selectedFederalStatus) {
      updateData.federalStatus = this.selectedFederalStatus;
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

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingFederalState = false;
        this.federalComment = '';
        this.toastService.success('Estado Federal actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingFederalState = false;
        this.toastService.error(error.message || 'Error al actualizar estado federal');
      }
    });
  }

  // Updated state status with comment
  updateStateStatusWithComment() {
    this.isSavingFederalState = true;
    const updateData: any = {};

    if (this.selectedStateStatus) {
      updateData.stateStatus = this.selectedStateStatus;
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

    this.adminService.updateStatus(this.clientId, updateData).subscribe({
      next: () => {
        this.isSavingFederalState = false;
        this.stateComment = '';
        this.toastService.success('Estado Estatal actualizado');
        this.loadClientData();
      },
      error: (error) => {
        this.isSavingFederalState = false;
        this.toastService.error(error.message || 'Error al actualizar estado estatal');
      }
    });
  }
}
