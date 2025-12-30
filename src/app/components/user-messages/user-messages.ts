import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket, TicketMessage, TicketStatus, UserRole } from '../../core/models';

@Component({
  selector: 'app-user-messages',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-messages.html',
  styleUrl: './user-messages.css'
})
export class UserMessages implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private ticketService = inject(TicketService);

  userEmail: string = '';
  userId: string = '';
  tickets: Ticket[] = [];
  activeTicket: Ticket | null = null;
  messages: TicketMessage[] = [];
  newMessage: string = '';
  isLoading: boolean = true;
  isSending: boolean = false;
  errorMessage: string = '';

  // For creating new ticket
  showNewTicketForm: boolean = false;
  newTicketSubject: string = '';
  newTicketMessage: string = '';

  ngOnInit() {
    const user = this.authService.currentUser;
    if (user) {
      this.userEmail = user.email;
      this.userId = user.id;
    }
    this.loadTickets();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  loadTickets() {
    this.isLoading = true;
    this.ticketService.getTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        // Auto-select the most recent open ticket or first ticket
        if (tickets.length > 0) {
          const openTicket = tickets.find(t => t.status !== TicketStatus.CLOSED) || tickets[0];
          this.selectTicket(openTicket);
        } else {
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar los tickets';
        this.isLoading = false;
        console.error('Error loading tickets:', error);
      }
    });
  }

  selectTicket(ticket: Ticket) {
    this.activeTicket = ticket;
    this.loadMessages(ticket.id);
  }

  loadMessages(ticketId: string) {
    this.isLoading = true;
    this.ticketService.getTicket(ticketId).subscribe({
      next: (ticket) => {
        this.activeTicket = ticket;
        this.messages = ticket.messages || [];
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar los mensajes';
        this.isLoading = false;
        console.error('Error loading messages:', error);
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.activeTicket || this.isSending) return;

    this.isSending = true;
    this.ticketService.addMessage(this.activeTicket.id, { message: this.newMessage }).subscribe({
      next: (updatedTicket) => {
        this.messages = updatedTicket.messages || [];
        this.newMessage = '';
        this.isSending = false;
        this.scrollToBottom();
      },
      error: (error) => {
        this.errorMessage = 'Error al enviar el mensaje';
        this.isSending = false;
        console.error('Error sending message:', error);
      }
    });
  }

  createTicket() {
    if (!this.newTicketSubject.trim() || !this.newTicketMessage.trim()) return;

    this.isSending = true;
    this.ticketService.create({
      subject: this.newTicketSubject,
      message: this.newTicketMessage
    }).subscribe({
      next: (ticket) => {
        this.tickets.unshift(ticket);
        this.selectTicket(ticket);
        this.showNewTicketForm = false;
        this.newTicketSubject = '';
        this.newTicketMessage = '';
        this.isSending = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al crear el ticket';
        this.isSending = false;
        console.error('Error creating ticket:', error);
      }
    });
  }

  cancelNewTicket() {
    this.showNewTicketForm = false;
    this.newTicketSubject = '';
    this.newTicketMessage = '';
  }

  isFromAdmin(message: TicketMessage): boolean {
    return message.sender?.role === UserRole.ADMIN;
  }

  isMyMessage(message: TicketMessage): boolean {
    return message.senderId === this.userId;
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }

    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short'
    });
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const currentDate = new Date(this.messages[index].createdAt).toDateString();
    const previousDate = new Date(this.messages[index - 1].createdAt).toDateString();
    return currentDate !== previousDate;
  }

  getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'Abierto',
      [TicketStatus.IN_PROGRESS]: 'En progreso',
      [TicketStatus.CLOSED]: 'Cerrado'
    };
    return labels[status] || status;
  }

  getStatusClass(status: TicketStatus): string {
    const classes: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'status-open',
      [TicketStatus.IN_PROGRESS]: 'status-progress',
      [TicketStatus.CLOSED]: 'status-closed'
    };
    return classes[status] || '';
  }

  private scrollToBottom() {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-list');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
