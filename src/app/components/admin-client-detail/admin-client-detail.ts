import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ElementRef, ViewChild, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { DocumentService } from '../../core/services/document.service';
import { TicketService } from '../../core/services/ticket.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective, CardAnimateDirective } from '../../shared/directives';
import {
  AdminClientDetail as ClientDetail,
  InternalStatus,
  ClientStatus,
  Document,
  Ticket,
  UpdateStatusRequest,
  ProblemType
} from '../../core/models';

@Component({
  selector: 'app-admin-client-detail',
  imports: [CommonModule, FormsModule, HoverScaleDirective, CardAnimateDirective],
  templateUrl: './admin-client-detail.html',
  styleUrl: './admin-client-detail.css'
})
export class AdminClientDetail implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);
  private documentService = inject(DocumentService);
  private ticketService = inject(TicketService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  @ViewChild('clientHeader') clientHeader!: ElementRef;
  @ViewChild('stepControlSection') stepControlSection!: ElementRef;
  @ViewChild('actionButtons') actionButtons!: ElementRef;
  @ViewChildren('detailSection') detailSections!: QueryList<ElementRef>;
  @ViewChildren('historyItem') historyItems!: QueryList<ElementRef>;
  @ViewChild('messagesSection') messagesSection!: ElementRef;

  private animationsInitialized = false;
  activeTab: string = 'profile';

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
  problemTypeOptions = Object.values(ProblemType);

  // Step control
  currentStep: number = 1;
  stepLabels = ['Recepcion', 'Revision', 'Proceso', 'Verificacion', 'Finalizado'];

  // Problem tracking
  showProblemModal: boolean = false;
  hasProblem: boolean = false;
  selectedProblemType: ProblemType | null = null;
  problemDescription: string = '';

  // Notification
  showNotifyModal: boolean = false;
  notifyTitle: string = '';
  notifyMessage: string = '';
  notifySendEmail: boolean = false;

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

  ngAfterViewInit() {
    // Initialize entrance animations after view is ready
    setTimeout(() => this.initEntranceAnimations(), 100);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  private initEntranceAnimations() {
    if (this.animationsInitialized || this.isLoading) return;
    this.animationsInitialized = true;

    // Animate client header
    if (this.clientHeader?.nativeElement) {
      this.animationService.slideIn(this.clientHeader.nativeElement, 'up', {
        duration: 0.5,
        distance: 30
      });
    }

    // Animate step control section
    if (this.stepControlSection?.nativeElement) {
      this.animationService.slideIn(this.stepControlSection.nativeElement, 'up', {
        delay: 0.15,
        duration: 0.5,
        distance: 30
      });
    }

    // Animate action buttons
    if (this.actionButtons?.nativeElement) {
      this.animationService.fadeIn(this.actionButtons.nativeElement, {
        delay: 0.25
      });
    }

    // Animate detail sections with stagger
    setTimeout(() => {
      if (this.detailSections && this.detailSections.length > 0) {
        const sections = this.detailSections.map(s => s.nativeElement);
        this.animationService.staggerIn(sections, {
          direction: 'up',
          stagger: 0.15,
          delay: 0.3,
          distance: 30
        });
      }
    }, 50);

    // Animate messages section
    if (this.messagesSection?.nativeElement) {
      this.animationService.slideIn(this.messagesSection.nativeElement, 'right', {
        delay: 0.4,
        distance: 30
      });
    }
  }

  private animateTimelineItems() {
    // Animate history timeline items with stagger
    setTimeout(() => {
      if (this.historyItems && this.historyItems.length > 0) {
        const items = this.historyItems.map(h => h.nativeElement);
        this.animationService.staggerIn(items, {
          direction: 'left',
          stagger: 0.1,
          distance: 20
        });
      }
    }, 100);
  }

  animateStatusChange(element: HTMLElement) {
    // Pulse animation when status changes
    this.animationService.pulse(element, {
      scale: 1.05,
      duration: 0.2,
      repeat: 2
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    // Re-trigger section animations on tab switch
    setTimeout(() => {
      if (this.detailSections && this.detailSections.length > 0) {
        const sections = this.detailSections.map(s => s.nativeElement);
        this.animationService.staggerIn(sections, {
          direction: 'up',
          stagger: 0.1,
          distance: 20
        });
      }
    }, 50);
  }

  loadClientData() {
    this.isLoading = true;
    this.animationsInitialized = false; // Reset animations flag for fresh load
    this.adminService.getClient(this.clientId).subscribe({
      next: (data) => {
        this.client = data;
        if (data.taxCases && data.taxCases.length > 0) {
          const taxCase = data.taxCases[0];
          this.selectedInternalStatus = taxCase.internalStatus;
          this.selectedClientStatus = taxCase.clientStatus;
          this.currentStep = taxCase.adminStep || 1;
          this.hasProblem = taxCase.hasProblem || false;
          this.selectedProblemType = taxCase.problemType || null;
          this.problemDescription = taxCase.problemDescription || '';
        }
        this.isLoading = false;
        this.cdr.markForCheck();
        // Trigger entrance animations after data loads
        setTimeout(() => {
          this.initEntranceAnimations();
          this.animateTimelineItems();
        }, 100);
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

  updateStatus() {
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
        setTimeout(() => {
          this.successMessage = 'Estado actualizado correctamente';
          // Animate status change indicator
          const statusControl = document.querySelector('.status-control');
          if (statusControl) {
            this.animateStatusChange(statusControl as HTMLElement);
          }
          this.loadClientData();
        }, 0);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al actualizar estado';
        this.isSaving = false;
      }
    });
  }

  markPaid() {
    this.adminService.markPaid(this.clientId).subscribe({
      next: () => {
        this.successMessage = 'Pago marcado como recibido';
        this.loadClientData();
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al marcar pago';
      }
    });
  }

  deleteClient() {
    if (!confirm('Estas seguro de eliminar este cliente? Esta accion no se puede deshacer.')) {
      return;
    }

    this.adminService.deleteClient(this.clientId).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al eliminar cliente';
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

  // Step Control Methods
  setStep(step: number) {
    if (step < 1 || step > 5) return;
    this.isSaving = true;
    this.adminService.updateAdminStep(this.clientId, step).subscribe({
      next: () => {
        this.currentStep = step;
        this.successMessage = `Paso actualizado a: ${this.stepLabels[step - 1]}`;
        this.isSaving = false;
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al actualizar paso';
        this.isSaving = false;
      }
    });
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
        this.successMessage = this.hasProblem ? 'Problema marcado' : 'Problema resuelto';
        this.showProblemModal = false;
        this.isSaving = false;
        this.loadClientData();
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al actualizar problema';
        this.isSaving = false;
      }
    });
  }

  saveProblem() {
    if (!this.selectedProblemType) {
      this.errorMessage = 'Seleccione un tipo de problema';
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
        this.successMessage = 'Problema registrado';
        this.showProblemModal = false;
        this.isSaving = false;
        this.loadClientData();
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al guardar problema';
        this.isSaving = false;
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
        this.successMessage = 'Problema resuelto';
        this.showProblemModal = false;
        this.isSaving = false;
        this.loadClientData();
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al resolver problema';
        this.isSaving = false;
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
      this.errorMessage = 'Titulo y mensaje son requeridos';
      return;
    }

    this.isSaving = true;
    this.adminService.sendClientNotification(this.clientId, {
      title: this.notifyTitle,
      message: this.notifyMessage,
      sendEmail: this.notifySendEmail
    }).subscribe({
      next: (response) => {
        this.successMessage = response.emailSent
          ? 'Notificacion enviada (app + email)'
          : 'Notificacion enviada (solo app)';
        this.showNotifyModal = false;
        this.isSaving = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al enviar notificacion';
        this.isSaving = false;
      }
    });
  }
}
