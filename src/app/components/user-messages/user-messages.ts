import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, skip, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
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
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  userEmail: string = '';
  userId: string = '';
  tickets: Ticket[] = [];
  activeTicket: Ticket | null = null;
  messages: TicketMessage[] = [];
  newMessage: string = '';
  isLoading: boolean = true;
  hasLoaded: boolean = false;
  isSending: boolean = false;
  errorMessage: string = '';

  // For creating new ticket
  showNewTicketForm: boolean = false;
  newTicketSubject: string = '';
  newTicketMessage: string = '';

  private isLoadingInProgress: boolean = false;

  ngOnInit() {
    const user = this.authService.currentUser;
    const isAuth = this.authService.isAuthenticated;

    if (!isAuth) {
      this.router.navigate(['/login']);
      return;
    }

    if (user) {
      this.userEmail = user.email;
      this.userId = user.id;
    }

    // Load initial data
    this.loadTickets();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.includes('/messages')),
        skip(1)
      ).subscribe(() => {
        if (this.hasLoaded) {
          this.loadTickets();
        }
      })
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/messages').subscribe(() => {
        if (this.hasLoaded) {
          this.loadTickets();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadTickets() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    this.isLoading = true;
    this.errorMessage = '';

    this.ticketService.getTickets().pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (tickets) => {
        this.tickets = tickets || [];
        // Auto-select the most recent open ticket or first ticket
        if (this.tickets.length > 0) {
          const openTicket = this.tickets.find(t => t.status !== TicketStatus.CLOSED) || this.tickets[0];
          this.selectTicket(openTicket);
        } else {
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar los tickets: ' + (error?.message || 'Unknown');
        this.isLoading = false;
      }
    });
  }

  selectTicket(ticket: Ticket) {
    this.activeTicket = ticket;
    this.loadMessages(ticket.id);
  }

  loadMessages(ticketId: string) {
    this.isLoading = true;

    this.ticketService.getTicket(ticketId).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (ticket) => {
        if (ticket) {
          this.activeTicket = ticket;
          this.messages = ticket.messages || [];
        }
        this.scrollToBottom();
      },
      error: () => {
        this.errorMessage = 'Error al cargar los mensajes';
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
