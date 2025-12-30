import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { DocumentService } from '../../core/services/document.service';
import { TicketService } from '../../core/services/ticket.service';
import {
  AdminClientDetail as ClientDetail,
  InternalStatus,
  ClientStatus,
  Document,
  Ticket,
  UpdateStatusRequest
} from '../../core/models';

@Component({
  selector: 'app-admin-client-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-client-detail.html',
  styleUrl: './admin-client-detail.css'
})
export class AdminClientDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);
  private documentService = inject(DocumentService);
  private ticketService = inject(TicketService);

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

  // Status options
  internalStatusOptions = Object.values(InternalStatus);
  clientStatusOptions = Object.values(ClientStatus);

  ngOnInit() {
    this.clientId = this.route.snapshot.params['id'];
    this.loadClientData();
    this.loadTickets();
  }

  loadClientData() {
    this.isLoading = true;
    this.adminService.getClient(this.clientId).subscribe({
      next: (data) => {
        this.client = data;
        if (data.taxCases && data.taxCases.length > 0) {
          this.selectedInternalStatus = data.taxCases[0].internalStatus;
          this.selectedClientStatus = data.taxCases[0].clientStatus;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar cliente';
        this.isLoading = false;
      }
    });
  }

  loadTickets() {
    this.ticketService.getTickets(undefined, this.clientId).subscribe({
      next: (tickets) => {
        this.tickets = tickets;
      },
      error: () => {
        // Silent fail for tickets
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
        this.successMessage = 'Estado actualizado correctamente';
        this.statusComment = '';
        this.isSaving = false;
        this.loadClientData(); // Reload to get updated data
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
    if (!this.newMessage.trim() || !this.selectedTicketId) return;

    this.ticketService.addMessage(this.selectedTicketId, { message: this.newMessage }).subscribe({
      next: () => {
        this.newMessage = '';
        this.loadTickets();
        this.successMessage = 'Mensaje enviado';
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al enviar mensaje';
      }
    });
  }

  selectTicket(ticketId: string) {
    this.selectedTicketId = ticketId;
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
}
