import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, filter, finalize, timeout, TimeoutError } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { DocumentService } from '../../core/services/document.service';
import { TicketService } from '../../core/services/ticket.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';
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
  private sanitizer = inject(DomSanitizer);
  themeService = inject(ThemeService);
  private subscriptions = new Subscription();

  // Dark Mode - managed by ThemeService
  get darkMode(): boolean {
    return this.themeService.darkMode();
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
    this.cdr.markForCheck();
  }

  clientId: string = '';
  client: ClientDetail | null = null;
  tickets: Ticket[] = [];
  selectedTicketFull: Ticket | null = null;  // Full ticket with messages
  isLoadingSelectedTicket: boolean = false;
  statusComment: string = '';
  newMessage: string = '';
  selectedTicketId: string | null = null;

  isLoading: boolean = true;
  isSaving: boolean = false;
  isMarkingPaid: boolean = false;
  isDeleting: boolean = false;
  isSavingFederal: boolean = false;
  isSavingState: boolean = false;
  isResettingEstimate: boolean = false;
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

  // Commission rates
  federalCommissionRate: number = 0.11;
  stateCommissionRate: number = 0.11;

  // Internal comments (admin-only)
  federalInternalComment: string = '';
  stateInternalComment: string = '';

  // Federal/State tracking (v2 only)
  federalEstimatedDate: string = '';
  stateEstimatedDate: string = '';
  federalActualRefund: number | null = null;
  stateActualRefund: number | null = null;
  federalRefundDirty: boolean = false;
  stateRefundDirty: boolean = false;
  federalDepositDate: string = '';
  stateDepositDate: string = '';

  // Problem tracking
  showProblemModal: boolean = false;
  hasProblem: boolean = false;
  selectedProblemType: ProblemType | null = null;
  problemDescription: string = '';

  // Document tabs
  selectedDocumentTab: 'all' | 'w2' | 'payment_proof' | 'commission_proof' | 'other' = 'all';

  // Profile and Documents Modal
  showProfileModal: boolean = false;
  showDocumentsModal: boolean = false;
  modalDocumentTab: 'all' | 'w2' | 'payment_proof' | 'commission_proof' | 'other' = 'all';

  // Visual Review Game
  showVisualReview: boolean = false;
  currentReviewStep: number = 1;
  reviewStepApproved: { [key: number]: boolean } = {};
  reviewCelebrating: boolean = false;
  showFinalDecision: boolean = false;

  // W2 Estimate data for visual review key fields checklist
  w2EstimateData: {
    hasEstimate: boolean;
    estimate: {
      id: string;
      box2Federal: number;
      box17State: number;
      estimatedRefund: number;
      w2FileName: string;
      ocrConfidence: 'high' | 'medium' | 'low';
      createdAt: string;
    } | null;
  } | null = null;
  isLoadingW2Estimate: boolean = false;
  // Key W2 fields verification checkboxes
  w2FieldsVerified: {
    box2Federal: boolean;
    box17State: boolean;
    estimatedRefund: boolean;
  } = {
    box2Federal: false,
    box17State: false,
    estimatedRefund: false
  };

  // Document Preview
  previewDocumentId: string | null = null;
  previewUrl: string | null = null;
  safePreviewUrl: SafeResourceUrl | null = null;
  previewType: 'pdf' | 'image' | 'unsupported' = 'unsupported';
  isLoadingPreview: boolean = false;
  currentPreviewDocument: Document | null = null;

  // Preview Viewer Controls
  previewZoom: number = 100;
  previewRotation: number = 0;
  isPreviewFullscreen: boolean = false;

  // Verification Panel (for visual review)
  verificationPanelExpanded: boolean = true;
  ssnCopied: boolean = false;

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

  // Per-track commission
  showFederalCommissionConfirm: boolean = false;
  showStateCommissionConfirm: boolean = false;
  isMarkingFederalCommission: boolean = false;
  isMarkingStateCommission: boolean = false;
  // Commission review notes
  federalCommissionReviewNote: string = '';
  stateCommissionReviewNote: string = '';

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
          this.federalActualRefund = taxCase.federalActualRefund != null ? Number(taxCase.federalActualRefund) : null;
          this.stateActualRefund = taxCase.stateActualRefund != null ? Number(taxCase.stateActualRefund) : null;
          this.federalRefundDirty = false;
          this.stateRefundDirty = false;
          // Load commission rates
          this.federalCommissionRate = taxCase.federalCommissionRate != null ? Number(taxCase.federalCommissionRate) : 0.11;
          this.stateCommissionRate = taxCase.stateCommissionRate != null ? Number(taxCase.stateCommissionRate) : 0.11;
          this.federalDepositDate = taxCase.federalDepositDate ? this.formatDateForInput(taxCase.federalDepositDate) : '';
          this.stateDepositDate = taxCase.stateDepositDate ? this.formatDateForInput(taxCase.stateDepositDate) : '';
          // Load comment fields
          this.federalComment = '';
          this.stateComment = '';
          // Load internal comments
          this.federalInternalComment = taxCase.federalInternalComment || '';
          this.stateInternalComment = taxCase.stateInternalComment || '';
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

  // Per-track commission methods
  get federalCommissionAmount(): number {
    const refund = this.client?.taxCases?.[0]?.federalActualRefund || 0;
    const rate = this.client?.taxCases?.[0]?.federalCommissionRate || 0.11;
    return Math.round(refund * rate * 100) / 100;
  }

  get stateCommissionAmount(): number {
    const refund = this.client?.taxCases?.[0]?.stateActualRefund || 0;
    const rate = this.client?.taxCases?.[0]?.stateCommissionRate || 0.11;
    return Math.round(refund * rate * 100) / 100;
  }

  // Commission status badge getters (3-state system)
  get federalCommissionBadge(): { text: string; class: string } {
    if (this.client?.taxCases?.[0]?.federalCommissionPaid) {
      return { text: 'Pagado', class: 'badge-paid' };
    }
    if (this.client?.taxCases?.[0]?.federalCommissionProofSubmitted) {
      return { text: 'Comprobante enviado', class: 'badge-proof-submitted' };
    }
    if (this.client?.taxCases?.[0]?.federalRefundReceived) {
      return { text: 'Pendiente', class: 'badge-unpaid' };
    }
    return { text: 'N/A', class: 'badge-na' };
  }

  get stateCommissionBadge(): { text: string; class: string } {
    if (this.client?.taxCases?.[0]?.stateCommissionPaid) {
      return { text: 'Pagado', class: 'badge-paid' };
    }
    if (this.client?.taxCases?.[0]?.stateCommissionProofSubmitted) {
      return { text: 'Comprobante enviado', class: 'badge-proof-submitted' };
    }
    if (this.client?.taxCases?.[0]?.stateRefundReceived) {
      return { text: 'Pendiente', class: 'badge-unpaid' };
    }
    return { text: 'N/A', class: 'badge-na' };
  }

  // Check if proof documents exist
  get hasFederalCommissionProof(): boolean {
    return !!this.client?.documents?.find(doc => doc.type === 'commission_proof_federal');
  }

  get hasStateCommissionProof(): boolean {
    return !!this.client?.documents?.find(doc => doc.type === 'commission_proof_state');
  }

  // Open commission proof document in new tab
  openCommissionProof(track: 'federal' | 'state') {
    const docType = track === 'federal' ? 'commission_proof_federal' : 'commission_proof_state';
    const proofDoc = this.client?.documents?.find(doc => doc.type === docType);
    if (proofDoc) {
      this.documentService.getDownloadUrl(proofDoc.id).subscribe({
        next: (response) => window.open(response.url, '_blank'),
        error: () => this.toastService.warning('Error al abrir el comprobante', 'Error'),
      });
    } else {
      this.toastService.warning('No se encontró el comprobante', 'Aviso');
    }
  }

  openFederalCommissionConfirm() {
    this.showFederalCommissionConfirm = true;
  }

  cancelFederalCommission() {
    this.showFederalCommissionConfirm = false;
  }

  confirmFederalCommission() {
    this.showFederalCommissionConfirm = false;
    this.isMarkingFederalCommission = true;

    const reviewNote = this.federalCommissionReviewNote.trim() || undefined;

    this.adminService.markCommissionPaid(this.clientId, 'federal', reviewNote).subscribe({
      next: () => {
        this.isMarkingFederalCommission = false;
        this.federalCommissionReviewNote = ''; // Reset note
        this.toastService.success('Comisión federal marcada como pagada');
        this.loadClientData();
      },
      error: (error) => {
        this.isMarkingFederalCommission = false;
        this.toastService.error(getErrorMessage(error, 'Error al marcar comisión federal'));
      }
    });
  }

  openStateCommissionConfirm() {
    this.showStateCommissionConfirm = true;
  }

  cancelStateCommission() {
    this.showStateCommissionConfirm = false;
  }

  confirmStateCommission() {
    this.showStateCommissionConfirm = false;
    this.isMarkingStateCommission = true;

    const reviewNote = this.stateCommissionReviewNote.trim() || undefined;

    this.adminService.markCommissionPaid(this.clientId, 'state', reviewNote).subscribe({
      next: () => {
        this.isMarkingStateCommission = false;
        this.stateCommissionReviewNote = ''; // Reset note
        this.toastService.success('Comisión estatal marcada como pagada');
        this.loadClientData();
      },
      error: (error) => {
        this.isMarkingStateCommission = false;
        this.toastService.error(getErrorMessage(error, 'Error al marcar comisión estatal'));
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
    const ticketId = this.selectedTicketId;

    this.ticketService.addMessage(ticketId, { message: this.newMessage }).subscribe({
      next: (updatedTicket) => {
        this.newMessage = '';
        this.ticketSuccessMessage = 'Mensaje enviado';
        this.isSendingMessage = false;
        // Update the selected ticket with the response (includes new message)
        this.selectedTicketFull = updatedTicket;
        this.loadTickets(); // Refresh list to update unread counts
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
    this.selectedTicketFull = null;
    this.isLoadingSelectedTicket = true;

    // Fetch full ticket with messages
    this.ticketService.getTicket(ticketId).subscribe({
      next: (ticket) => {
        this.selectedTicketFull = ticket;
        this.isLoadingSelectedTicket = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.ticketErrorMessage = getErrorMessage(error, 'Error al cargar el ticket');
        this.isLoadingSelectedTicket = false;
        this.cdr.markForCheck();
      }
    });
  }

  get selectedTicket(): Ticket | null {
    return this.selectedTicketFull;
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

  scrollToSection(section: 'profile' | 'documents') {
    const elementId = section === 'profile' ? 'profile-section' : 'documents-section';
    const element = document.getElementById(elementId);
    if (element) {
      // Account for sticky header (approx 70px) + some breathing room
      const headerOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
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
    // NOTE: IRS_VERIFICATION removed - verification is handled via status, not problem flags
    const labels: Record<ProblemType, string> = {
      [ProblemType.MISSING_DOCUMENTS]: 'Documentos faltantes',
      [ProblemType.INCORRECT_INFORMATION]: 'Informacion incorrecta',
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
    if (this.selectedDocumentTab === 'commission_proof') {
      return this.client.documents.filter(doc => doc.type === 'commission_proof_federal' || doc.type === 'commission_proof_state');
    }
    return this.client.documents.filter(doc => doc.type === this.selectedDocumentTab);
  }

  getDocumentCountByType(type: 'all' | 'w2' | 'payment_proof' | 'commission_proof' | 'other'): number {
    if (!this.client?.documents) return 0;
    if (type === 'all') return this.client.documents.length;
    if (type === 'commission_proof') {
      return this.client.documents.filter(doc => doc.type === 'commission_proof_federal' || doc.type === 'commission_proof_state').length;
    }
    return this.client.documents.filter(doc => doc.type === type).length;
  }

  selectDocumentTab(tab: 'all' | 'w2' | 'payment_proof' | 'commission_proof' | 'other') {
    this.selectedDocumentTab = tab;
  }

  // ===== PROFILE MODAL METHODS =====

  openProfileModal() {
    this.showProfileModal = true;
  }

  closeProfileModal() {
    this.showProfileModal = false;
  }

  // ===== DOCUMENTS MODAL METHODS =====

  openDocumentsModal() {
    this.modalDocumentTab = 'all';
    this.showDocumentsModal = true;
  }

  closeDocumentsModal() {
    this.showDocumentsModal = false;
  }

  get modalFilteredDocuments(): Document[] {
    if (!this.client?.documents) return [];
    if (this.modalDocumentTab === 'all') return this.client.documents;
    if (this.modalDocumentTab === 'commission_proof') {
      return this.client.documents.filter(doc => doc.type === 'commission_proof_federal' || doc.type === 'commission_proof_state');
    }
    return this.client.documents.filter(doc => doc.type === this.modalDocumentTab);
  }

  getDocumentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'w2': 'W2',
      'payment_proof': 'Comprobante',
      'consent_form': 'Consentimiento',
      'commission_proof_federal': 'Comision Federal',
      'commission_proof_state': 'Comision Estatal',
      'other': 'Otro'
    };
    return labels[type] || type;
  }

  // ===== 4-STEP PROGRESS TRACKING =====

  /**
   * Step 1: Formulario - Check if profile has been filled out
   * (has SSN or date of birth filled)
   */
  get isStep1Complete(): boolean {
    if (!this.client?.profile) return false;
    // Check if essential profile fields are filled
    return !!(this.client.profile.ssn || this.client.profile.dateOfBirth);
  }

  /**
   * Step 2: W2 - Check if client has uploaded at least one W2 document
   */
  get isStep2Complete(): boolean {
    if (!this.client?.documents) return false;
    return this.client.documents.some(doc => doc.type === 'w2');
  }

  /**
   * Step 3: Comprobante - Check if client has uploaded payment proof
   */
  get isStep3Complete(): boolean {
    if (!this.client?.documents) return false;
    return this.client.documents.some(doc => doc.type === 'payment_proof');
  }

  /**
   * Step 4: Consentimiento - Check if client has uploaded consent form
   */
  get isStep4Complete(): boolean {
    if (!this.client?.documents) return false;
    return this.client.documents.some(doc => doc.type === 'consent_form');
  }

  /**
   * Check if all 4 steps are complete
   */
  get allStepsComplete(): boolean {
    return this.isStep1Complete && this.isStep2Complete && this.isStep3Complete && this.isStep4Complete;
  }

  /**
   * Count of completed steps
   */
  get completedStepsCount(): number {
    let count = 0;
    if (this.isStep1Complete) count++;
    if (this.isStep2Complete) count++;
    if (this.isStep3Complete) count++;
    if (this.isStep4Complete) count++;
    return count;
  }

  // ===== VISUAL REVIEW GAME METHODS =====

  /**
   * Start the visual review game
   */
  startVisualReview() {
    this.showVisualReview = true;
    this.currentReviewStep = 1;
    this.reviewStepApproved = {};
    this.reviewCelebrating = false;
    this.showFinalDecision = false;
    this.verificationPanelExpanded = true; // Default expanded on document steps
    this.ssnCopied = false;
    this.clearPreview();
    // Reset W2 fields verification
    this.w2FieldsVerified = {
      box2Federal: false,
      box17State: false,
      estimatedRefund: false
    };
    // Load W2 estimate data for key fields checklist
    this.loadW2EstimateData();
  }

  /**
   * Load W2 estimate data for key fields checklist in visual review
   */
  loadW2EstimateData() {
    this.isLoadingW2Estimate = true;
    this.w2EstimateData = null;

    this.adminService.getW2Estimate(this.clientId).subscribe({
      next: (data) => {
        this.w2EstimateData = data;
        this.isLoadingW2Estimate = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.w2EstimateData = { hasEstimate: false, estimate: null };
        this.isLoadingW2Estimate = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Toggle W2 field verification checkbox
   */
  toggleW2FieldVerified(field: 'box2Federal' | 'box17State' | 'estimatedRefund') {
    this.w2FieldsVerified[field] = !this.w2FieldsVerified[field];
    this.cdr.markForCheck();
  }

  /**
   * Check if all W2 fields are verified
   */
  get allW2FieldsVerified(): boolean {
    return this.w2FieldsVerified.box2Federal &&
           this.w2FieldsVerified.box17State &&
           this.w2FieldsVerified.estimatedRefund;
  }

  /**
   * Get OCR confidence label in Spanish
   */
  getOcrConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
    const labels = {
      high: 'Alta',
      medium: 'Media',
      low: 'Baja'
    };
    return labels[confidence] || confidence;
  }

  /**
   * Get OCR confidence CSS class
   */
  getOcrConfidenceClass(confidence: 'high' | 'medium' | 'low'): string {
    return `confidence-${confidence}`;
  }

  /**
   * Close the visual review without completing
   */
  closeVisualReview() {
    this.showVisualReview = false;
    this.reviewCelebrating = false;
    this.showFinalDecision = false;
    this.clearPreview();
  }

  /**
   * Get the title for current review step
   */
  getReviewStepTitle(): string {
    const titles: { [key: number]: string } = {
      1: 'Verificando Formulario',
      2: 'Verificando W2',
      3: 'Verificando Comprobante',
      4: 'Verificando Consentimiento'
    };
    return titles[this.currentReviewStep] || '';
  }

  /**
   * Go to previous review step
   */
  previousReviewStep() {
    if (this.currentReviewStep > 1) {
      this.currentReviewStep--;
    }
  }

  /**
   * Approve current step and move to next
   */
  approveReviewStep() {
    this.reviewStepApproved[this.currentReviewStep] = true;

    if (this.currentReviewStep < 4) {
      // Move to next step with a small delay for animation
      setTimeout(() => {
        this.currentReviewStep++;
        this.clearPreview(); // Clear preview when changing steps
        this.autoSelectFirstDocument(); // Auto-select first doc of new step
        this.cdr.markForCheck();
      }, 300);
    } else {
      // All steps completed - show final decision
      setTimeout(() => {
        this.showFinalDecision = true;
        this.cdr.markForCheck();
      }, 300);
    }
  }

  /**
   * Accept the review - set status to "En Preparacion"
   */
  acceptReview() {
    this.showFinalDecision = false;
    this.reviewCelebrating = true;
    this.cdr.markForCheck();
  }

  /**
   * Reject the review - set status to "Problemas"
   */
  rejectReview() {
    this.showVisualReview = false;
    this.showFinalDecision = false;
    this.clearPreview();

    // Set status to "Problemas"
    this.selectedCaseStatus = CaseStatus.CASE_ISSUES;
    this.updateCaseStatus();

    this.toastService.warning('Caso marcado con problemas');
  }

  /**
   * Finish the visual review and update status
   */
  finishVisualReview() {
    this.showVisualReview = false;
    this.reviewCelebrating = false;
    this.showFinalDecision = false;
    this.clearPreview();

    // Auto-set status to "En Preparacion" after successful review
    if (this.selectedCaseStatus !== CaseStatus.PREPARING) {
      this.selectedCaseStatus = CaseStatus.PREPARING;
      this.updateCaseStatus();
    }

    this.toastService.success('¡Revision completada! Cliente listo para preparar.');
  }

  /**
   * Get documents filtered by type for the review
   */
  getDocumentsByType(type: string): Document[] {
    if (!this.client?.documents) return [];
    return this.client.documents.filter(doc => doc.type === type);
  }

  /**
   * Auto-select first document when entering a document step
   */
  autoSelectFirstDocument() {
    const stepDocTypes: { [key: number]: string } = {
      2: 'w2',
      3: 'payment_proof',
      4: 'consent_form'
    };

    const docType = stepDocTypes[this.currentReviewStep];
    if (docType) {
      const docs = this.getDocumentsByType(docType);
      if (docs.length > 0) {
        this.previewDocument(docs[0]);
      }
    }
  }

  /**
   * Preview a document
   */
  previewDocument(doc: Document) {
    if (this.previewDocumentId === doc.id) return; // Already previewing

    this.previewDocumentId = doc.id;
    this.currentPreviewDocument = doc;
    this.isLoadingPreview = true;
    this.previewUrl = null;

    // Determine preview type based on mime type
    if (doc.mimeType === 'application/pdf') {
      this.previewType = 'pdf';
    } else if (doc.mimeType.startsWith('image/')) {
      this.previewType = 'image';
    } else {
      this.previewType = 'unsupported';
    }

    // Get the download URL for preview
    this.documentService.getDownloadUrl(doc.id).subscribe({
      next: (response) => {
        this.previewUrl = response.url;
        // Sanitize URL for iframe/img src binding
        this.safePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(response.url);
        this.isLoadingPreview = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.previewType = 'unsupported';
        this.isLoadingPreview = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Clear the document preview
   */
  clearPreview() {
    this.previewDocumentId = null;
    this.previewUrl = null;
    this.safePreviewUrl = null;
    this.previewType = 'unsupported';
    this.isLoadingPreview = false;
    this.currentPreviewDocument = null;
    // Reset viewer controls
    this.previewZoom = 100;
    this.previewRotation = 0;
    this.isPreviewFullscreen = false;
  }

  // ===== PREVIEW VIEWER CONTROL METHODS =====

  /**
   * Zoom in the preview (max 200%)
   */
  zoomIn() {
    if (this.previewZoom < 200) {
      this.previewZoom = Math.min(200, this.previewZoom + 25);
      this.cdr.markForCheck();
    }
  }

  /**
   * Zoom out the preview (min 50%)
   */
  zoomOut() {
    if (this.previewZoom > 50) {
      this.previewZoom = Math.max(50, this.previewZoom - 25);
      this.cdr.markForCheck();
    }
  }

  /**
   * Reset zoom to 100%
   */
  resetZoom() {
    this.previewZoom = 100;
    this.cdr.markForCheck();
  }

  /**
   * Rotate the preview image 90 degrees clockwise
   */
  rotatePreview() {
    this.previewRotation = (this.previewRotation + 90) % 360;
    this.cdr.markForCheck();
  }

  /**
   * Toggle fullscreen mode for the preview panel
   */
  togglePreviewFullscreen() {
    this.isPreviewFullscreen = !this.isPreviewFullscreen;
    this.cdr.markForCheck();
  }

  /**
   * Exit fullscreen mode (for escape key or close button)
   */
  exitPreviewFullscreen() {
    this.isPreviewFullscreen = false;
    this.cdr.markForCheck();
  }

  /**
   * Get the transform style for the preview content
   */
  getPreviewTransform(): string {
    const transforms: string[] = [];
    if (this.previewZoom !== 100) {
      transforms.push(`scale(${this.previewZoom / 100})`);
    }
    if (this.previewRotation !== 0) {
      transforms.push(`rotate(${this.previewRotation}deg)`);
    }
    return transforms.length > 0 ? transforms.join(' ') : 'none';
  }

  /**
   * Download the currently previewed document
   */
  downloadPreviewDocument() {
    if (this.currentPreviewDocument) {
      this.downloadDocument(this.currentPreviewDocument);
    }
  }

  // ===== VERIFICATION PANEL METHODS =====

  /**
   * Toggle the verification panel expanded/collapsed state
   */
  toggleVerificationPanel() {
    this.verificationPanelExpanded = !this.verificationPanelExpanded;
    this.cdr.markForCheck();
  }

  /**
   * Get masked SSN (shows only last 4 digits)
   * Format: ***-**-1234
   */
  getMaskedSSN(): string {
    const ssn = this.client?.profile?.ssn;
    if (!ssn) return 'No disponible';
    // SSN format is typically XXX-XX-XXXX or XXXXXXXXX
    const cleanSSN = ssn.replace(/\D/g, '');
    if (cleanSSN.length >= 4) {
      return `***-**-${cleanSSN.slice(-4)}`;
    }
    return '***-**-****';
  }

  /**
   * Get the full (unmasked) SSN for copying
   */
  getFullSSN(): string {
    return this.client?.profile?.ssn || '';
  }

  /**
   * Copy SSN to clipboard
   */
  async copySSNToClipboard() {
    const ssn = this.getFullSSN();
    if (!ssn) {
      this.toastService.warning('No hay SSN disponible para copiar');
      return;
    }

    try {
      await navigator.clipboard.writeText(ssn);
      this.ssnCopied = true;
      this.toastService.success('SSN copiado al portapapeles');
      this.cdr.markForCheck();

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        this.ssnCopied = false;
        this.cdr.markForCheck();
      }, 2000);
    } catch (err) {
      this.toastService.error('Error al copiar SSN');
    }
  }

  /**
   * Get client full name for verification panel
   */
  getClientFullName(): string {
    if (!this.client?.user) return 'No disponible';
    const firstName = this.client.user.firstName || '';
    const lastName = this.client.user.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'No disponible';
  }

  /**
   * Get client full address for verification panel
   */
  getClientFullAddress(): string {
    const address = this.client?.profile?.address;
    if (!address) return 'No disponible';

    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zip) parts.push(address.zip);

    return parts.length > 0 ? parts.join(', ') : 'No disponible';
  }

  /**
   * Get employer name for verification panel
   */
  getEmployerName(): string {
    return this.client?.profile?.employerName || 'No disponible';
  }

  /**
   * Get work state for verification panel
   */
  getWorkState(): string {
    return this.client?.profile?.workState || 'No disponible';
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
      taxes_en_proceso: 'Taxes en Proceso',
      en_verificacion: 'En Verificacion',
      verificacion_en_progreso: 'Verificacion en Progreso',
      problemas: 'Problemas',
      verificacion_rechazada: 'Verificacion Rechazada',
      deposito_directo: 'Deposito Directo',
      cheque_en_camino: 'Cheque en Camino',
      comision_pendiente: 'Comision Pendiente',
      taxes_completados: 'Taxes Completados',
      // Legacy values for old status_history records
      in_process: 'En Proceso',
      in_verification: 'En Verificacion',
      verification_in_progress: 'Verificacion en Progreso',
      verification_letter_sent: 'Carta de Verificacion Enviada',
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
      federalStatusNew: FederalStatusNew.TAXES_EN_PROCESO,
      stateStatusNew: StateStatusNew.TAXES_EN_PROCESO
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
      [CaseStatus.DOCUMENTOS_ENVIADOS]: 'Documentos Enviados',
      [CaseStatus.PREPARING]: 'En Preparacion',
      [CaseStatus.TAXES_FILED]: 'Taxes Presentados',
      [CaseStatus.CASE_ISSUES]: 'Problemas'
    };
    return labels[status] || status;
  }

  getFederalStatusNewLabel(status: FederalStatusNew | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<FederalStatusNew, string> = {
      [FederalStatusNew.TAXES_EN_PROCESO]: 'Taxes en Proceso',
      [FederalStatusNew.EN_VERIFICACION]: 'En Verificacion',
      [FederalStatusNew.VERIFICACION_EN_PROGRESO]: 'Verificacion en Progreso',
      [FederalStatusNew.PROBLEMAS]: 'Problemas',
      [FederalStatusNew.VERIFICACION_RECHAZADA]: 'Verificacion Rechazada',
      [FederalStatusNew.DEPOSITO_DIRECTO]: 'Deposito Directo',
      [FederalStatusNew.CHEQUE_EN_CAMINO]: 'Cheque en Camino',
      [FederalStatusNew.COMISION_PENDIENTE]: 'Comision Pendiente',
      [FederalStatusNew.TAXES_COMPLETADOS]: 'Taxes Completados'
    };
    return labels[status] || status;
  }

  getStateStatusNewLabel(status: StateStatusNew | null): string {
    if (!status) return 'Sin estado';
    const labels: Record<StateStatusNew, string> = {
      [StateStatusNew.TAXES_EN_PROCESO]: 'Taxes en Proceso',
      [StateStatusNew.EN_VERIFICACION]: 'En Verificacion',
      [StateStatusNew.VERIFICACION_EN_PROGRESO]: 'Verificacion en Progreso',
      [StateStatusNew.PROBLEMAS]: 'Problemas',
      [StateStatusNew.VERIFICACION_RECHAZADA]: 'Verificacion Rechazada',
      [StateStatusNew.DEPOSITO_DIRECTO]: 'Deposito Directo',
      [StateStatusNew.CHEQUE_EN_CAMINO]: 'Cheque en Camino',
      [StateStatusNew.COMISION_PENDIENTE]: 'Comision Pendiente',
      [StateStatusNew.TAXES_COMPLETADOS]: 'Taxes Completados'
    };
    return labels[status] || status;
  }

  /**
   * Get description/tooltip for post-filing statuses
   * Key distinctions per engineer spec:
   * - en_verificacion: IRS flagged it, JAI1 hasn't acted yet
   * - verificacion_en_progreso: JAI1 has taken action, waiting for agency response
   * - cheque_en_camino: Physical check being mailed
   * - comision_pendiente: Client got refund but hasn't paid JAI1 fee
   * - deposito_directo: Refund sent via direct deposit
   */
  getStatusDescription(status: string | null): string {
    if (!status) return '';
    const descriptions: Record<string, string> = {
      'taxes_en_proceso': 'El IRS/Estado esta procesando la declaracion',
      'en_verificacion': 'IRS/Estado marco para verificacion - JAI1 aun NO ha actuado',
      'verificacion_en_progreso': 'JAI1 YA tomo accion (carta/documentos enviados) - esperando respuesta',
      'problemas': 'Problema que requiere atencion especial',
      'verificacion_rechazada': 'La verificacion fue rechazada por el IRS/Estado',
      'deposito_directo': 'Reembolso enviado por deposito directo',
      'cheque_en_camino': 'Cheque fisico en camino al cliente',
      'comision_pendiente': 'Cliente recibio reembolso - pendiente pago de comision',
      'taxes_completados': 'Proceso completado - cliente recibio y pago'
    };
    return descriptions[status] || '';
  }

  /**
   * Returns what the client sees for a given status.
   * Multiple admin statuses map to the same client view.
   */
  getClientVisibleLabel(status: string | null): string {
    if (!status) return '';
    // These are the ACTUAL labels the client sees (matches backend mapFederalStatusToClientDisplay)
    const clientLabels: Record<string, string> = {
      'taxes_en_proceso': 'Taxes en proceso',
      'en_verificacion': 'En verificacion',
      'verificacion_en_progreso': 'En verificacion',
      'problemas': 'Problemas',
      'verificacion_rechazada': 'Verificacion rechazada',
      'deposito_directo': 'Reembolso enviado',
      'cheque_en_camino': 'Reembolso enviado',
      'comision_pendiente': 'Comision pendiente de pago',
      'taxes_completados': 'Taxes completados'
    };
    return clientLabels[status] || '';
  }

  /**
   * Whether this status is purely for admin organization
   * (client sees the same thing as another status in the group).
   */
  isAdminOnlyStatus(status: string | null): boolean {
    if (!status) return false;
    // These statuses are internal - client sees a parent label instead
    const adminOnly = [
      'verificacion_en_progreso',
      'deposito_directo',
      'cheque_en_camino'
    ];
    return adminOnly.includes(status);
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
    if (this.federalRefundDirty && this.federalActualRefund !== null) {
      updateData.federalActualRefund = this.federalActualRefund;
    }
    if (this.federalDepositDate) {
      updateData.federalDepositDate = this.federalDepositDate;
    }
    if (this.federalComment) {
      updateData.federalComment = this.federalComment;
    }
    if (this.federalInternalComment) {
      updateData.federalInternalComment = this.federalInternalComment;
    }
    // Always send commission rate
    updateData.federalCommissionRate = this.federalCommissionRate;

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
    if (this.stateRefundDirty && this.stateActualRefund !== null) {
      updateData.stateActualRefund = this.stateActualRefund;
    }
    if (this.stateDepositDate) {
      updateData.stateDepositDate = this.stateDepositDate;
    }
    if (this.stateComment) {
      updateData.stateComment = this.stateComment;
    }
    if (this.stateInternalComment) {
      updateData.stateInternalComment = this.stateInternalComment;
    }
    // Always send commission rate
    updateData.stateCommissionRate = this.stateCommissionRate;

    this.executeStateStatusUpdate(updateData);
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ===== TICKET STATUS LABEL =====

  getTicketStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'open': 'Abierto',
      'in_progress': 'En Progreso',
      'closed': 'Cerrado'
    };
    return labels[status] || status;
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
   * Get filtered case status options for the dropdown
   * Excludes: awaiting_form, awaiting_docs, documentos_enviados (these are auto-determined by step progress)
   */
  get filteredCaseStatusOptions(): CaseStatus[] {
    const excludedStatuses = [
      CaseStatus.AWAITING_FORM,
      CaseStatus.AWAITING_DOCS,
      CaseStatus.DOCUMENTOS_ENVIADOS
    ];
    return this.caseStatusOptions.filter(status => !excludedStatuses.includes(status));
  }

  /**
   * Get all federal status options (admins can select any status)
   * Invalid transitions will trigger override modal on save
   */
  get filteredFederalStatusOptions(): FederalStatusNew[] {
    return this.federalStatusNewOptions;
  }

  /**
   * Check if a federal status is a valid transition from current
   */
  isValidFederalTransition(status: FederalStatusNew): boolean {
    if (!this.validFederalStatusTransitions.length) return true;
    return this.validFederalStatusTransitions.includes(status);
  }

  /**
   * Get all state status options (admins can select any status)
   * Invalid transitions will trigger override modal on save
   */
  get filteredStateStatusOptions(): StateStatusNew[] {
    return this.stateStatusNewOptions;
  }

  /**
   * Check if a state status is a valid transition from current
   */
  isValidStateTransition(status: StateStatusNew): boolean {
    if (!this.validStateStatusTransitions.length) return true;
    return this.validStateStatusTransitions.includes(status);
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
    this.cdr.markForCheck();

    this.adminService.updateStatus(this.clientId, updateData).pipe(
      timeout(30000), // 30 second timeout
      finalize(() => {
        this.isSavingPreFiling = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.toastService.success('Estado del caso actualizado');
        this.loadClientData();
      },
      error: (error) => {
        if (error instanceof TimeoutError) {
          this.toastService.error('La solicitud tardo demasiado. Intente de nuevo.');
          return;
        }
        if (!this.handleStatusUpdateError(error, 'case', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado'));
        }
      }
    });
  }

  private executeFederalStatusUpdate(updateData: UpdateStatusRequest) {
    this.isSavingFederal = true;
    this.cdr.markForCheck();

    this.adminService.updateStatus(this.clientId, updateData).pipe(
      timeout(30000), // 30 second timeout
      finalize(() => {
        this.isSavingFederal = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.federalComment = '';
        this.toastService.success('Estado Federal (v2) actualizado');
        this.loadClientData();
      },
      error: (error) => {
        if (error instanceof TimeoutError) {
          this.toastService.error('La solicitud tardo demasiado. Intente de nuevo.');
          return;
        }
        if (!this.handleStatusUpdateError(error, 'federal', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado federal'));
        }
      }
    });
  }

  private executeStateStatusUpdate(updateData: UpdateStatusRequest) {
    this.isSavingState = true;
    this.cdr.markForCheck();

    this.adminService.updateStatus(this.clientId, updateData).pipe(
      timeout(30000), // 30 second timeout
      finalize(() => {
        this.isSavingState = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.stateComment = '';
        this.toastService.success('Estado Estatal (v2) actualizado');
        this.loadClientData();
      },
      error: (error) => {
        if (error instanceof TimeoutError) {
          this.toastService.error('La solicitud tardo demasiado. Intente de nuevo.');
          return;
        }
        if (!this.handleStatusUpdateError(error, 'state', updateData)) {
          this.toastService.error(getErrorMessage(error, 'Error al actualizar estado estatal'));
        }
      }
    });
  }

  /**
   * Reset W2 estimate for a client
   * Allows them to recalculate their W2
   */
  resetW2Estimate() {
    if (!this.clientId || !confirm('¿Estás seguro de resetear el estimado W2? El cliente podrá recalcular su W2.')) {
      return;
    }

    this.isResettingEstimate = true;

    this.adminService.resetW2Estimate(this.clientId).subscribe({
      next: (result) => {
        this.isResettingEstimate = false;
        this.toastService.success(`W2 reseteado: ${result.deletedEstimates} estimado(s), ${result.deletedDocuments} documento(s)`);
        this.loadClientData(); // Refresh to show updated state
      },
      error: (error) => {
        this.isResettingEstimate = false;
        this.toastService.error(getErrorMessage(error, 'Error al resetear W2'));
      }
    });
  }
}
