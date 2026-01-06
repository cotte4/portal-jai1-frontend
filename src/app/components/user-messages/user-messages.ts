import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, skip } from 'rxjs';
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
  isSending: boolean = false;
  errorMessage: string = '';

  // For creating new ticket
  showNewTicketForm: boolean = false;
  newTicketSubject: string = '';
  newTicketMessage: string = '';

  private isInitialized = false;

  ngOnInit() {
    console.log('[UserMessages] ngOnInit - loading tickets');
    const user = this.authService.currentUser;
    const isAuth = this.authService.isAuthenticated;
    console.log('[UserMessages] Auth check - user:', user?.email, 'isAuthenticated:', isAuth);

    if (!isAuth) {
      console.log('[UserMessages] NOT AUTHENTICATED - redirecting to login');
      this.router.navigate(['/login']);
      return;
    }

    if (user) {
      this.userEmail = user.email;
      this.userId = user.id;
    }

    // Load initial data - isInitialized will be set after load completes
    this.loadTickets(true);

    // Auto-refresh on navigation - skip(1) to ignore the initial navigation that created this component
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.includes('/messages')),
        skip(1)
      ).subscribe(() => {
        if (!this.isLoading) {
          console.log('[UserMessages] NavigationEnd detected, refreshing');
          this.loadTickets();
        }
      })
    );

    // Allow other components to trigger refresh - only after initial load is complete
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/messages').subscribe(() => {
        if (this.isInitialized && !this.isLoading) {
          console.log('[UserMessages] DataRefreshService triggered, refreshing');
          this.loadTickets();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadTickets(isInitialLoad = false) {
    console.log('[UserMessages] loadTickets called, isInitialLoad:', isInitialLoad);
    this.isLoading = true;
    this.errorMessage = '';

    // Safety timeout - stop loading after 20 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'Tiempo de espera agotado. Intenta de nuevo.';
        console.warn('[UserMessages] Safety timeout triggered');
        if (isInitialLoad) {
          this.isInitialized = true;
        }
      }
    }, 20000);

    console.log('[UserMessages] About to call ticketService.getTickets()');
    this.ticketService.getTickets().subscribe({
      next: (tickets) => {
        console.log('[UserMessages] Tickets API response:', tickets);
        console.log('[UserMessages] Tickets loaded:', tickets?.length || 0);
        clearTimeout(safetyTimeout);
        this.tickets = tickets || [];
        console.log('[UserMessages] this.tickets set to:', this.tickets.length);
        // Auto-select the most recent open ticket or first ticket
        if (this.tickets.length > 0) {
          const openTicket = this.tickets.find(t => t.status !== TicketStatus.CLOSED) || this.tickets[0];
          console.log('[UserMessages] Selecting ticket:', openTicket?.id);
          this.selectTicket(openTicket, isInitialLoad);
        } else {
          this.isLoading = false;
          console.log('[UserMessages] No tickets, showing empty state');
          if (isInitialLoad) {
            this.isInitialized = true;
          }
          this.cdr.detectChanges(); // Force Angular to update the view
        }
      },
      error: (error) => {
        clearTimeout(safetyTimeout);
        this.errorMessage = 'Error al cargar los tickets: ' + (error?.message || 'Unknown');
        this.isLoading = false;
        console.error('[UserMessages] Subscribe error:', error);
        if (isInitialLoad) {
          this.isInitialized = true;
        }
        this.cdr.detectChanges(); // Force Angular to update the view
      }
    });
  }

  selectTicket(ticket: Ticket, isInitialLoad = false) {
    this.activeTicket = ticket;
    this.loadMessages(ticket.id, isInitialLoad);
  }

  loadMessages(ticketId: string, isInitialLoad = false) {
    console.log('[UserMessages] loadMessages called for ticket:', ticketId, 'isInitialLoad:', isInitialLoad);
    this.isLoading = true;

    // Safety timeout for loading messages
    const safetyTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'Tiempo de espera agotado cargando mensajes.';
        console.warn('[UserMessages] loadMessages safety timeout triggered');
        if (isInitialLoad) {
          this.isInitialized = true;
        }
      }
    }, 20000);

    console.log('[UserMessages] Making API call to get ticket:', ticketId);
    this.ticketService.getTicket(ticketId).subscribe({
      next: (ticket) => {
        console.log('[UserMessages] API response received for ticket');
        clearTimeout(safetyTimeout);
        if (ticket) {
          console.log('[UserMessages] Messages loaded:', ticket.messages?.length || 0);
          this.activeTicket = ticket;
          this.messages = ticket.messages || [];
        } else {
          console.warn('[UserMessages] Ticket response was null/undefined');
        }
        this.isLoading = false;
        this.scrollToBottom();
        // Mark as initialized AFTER the full load sequence completes
        if (isInitialLoad) {
          console.log('[UserMessages] Initial load complete, setting isInitialized = true');
          this.isInitialized = true;
        }
        this.cdr.detectChanges(); // Force Angular to update the view
      },
      error: (error) => {
        console.error('[UserMessages] getTicket API error:', error);
        clearTimeout(safetyTimeout);
        this.errorMessage = 'Error al cargar los mensajes';
        this.isLoading = false;
        if (isInitialLoad) {
          this.isInitialized = true;
        }
        this.cdr.detectChanges(); // Force Angular to update the view
      },
      complete: () => {
        console.log('[UserMessages] getTicket observable completed');
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
