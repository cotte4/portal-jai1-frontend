import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter, skip, finalize, catchError, of, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
export class UserMessages implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private ticketService = inject(TicketService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

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

  // For delete confirmation
  showDeleteConfirm: boolean = false;
  ticketToDelete: Ticket | null = null;
  isDeleting: boolean = false;

  private isLoadingInProgress: boolean = false;
  private safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Register cleanup for safety timeout when component is destroyed
    this.destroyRef.onDestroy(() => {
      if (this.safetyTimeoutId) {
        clearTimeout(this.safetyTimeoutId);
        this.safetyTimeoutId = null;
      }
    });
  }

  ngOnInit(): void {
    const user = this.authService.currentUser;
    const isAuth = this.authService.isAuthenticated;

    if (!isAuth) {
      this.router.navigate(['/login']);
      return;
    }

    if (user) {
      this.userEmail = user.email;
      this.userId = user.id;
      // We have user info - show UI shell immediately
      this.hasLoaded = true;
      this.cdr.detectChanges();
    }

    // Load initial data (will update in background)
    this.loadTickets();

    // Auto-refresh on navigation - using takeUntilDestroyed for automatic cleanup
    this.router.events.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      filter(event => event.urlAfterRedirects.includes('/messages')),
      skip(1)
    ).subscribe(() => {
      if (this.hasLoaded) {
        this.loadTickets();
      }
    });

    // Allow other components to trigger refresh - using takeUntilDestroyed for automatic cleanup
    this.dataRefreshService.onRefresh('/messages').pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.hasLoaded) {
        this.loadTickets();
      }
    });

    // Auto-polling every 60 seconds for new messages
    // This is a simpler alternative to WebSocket - see PRD for reasoning
    interval(60000).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.hasLoaded && !this.isLoadingInProgress) {
        this.refreshActiveTicket();
      }
    });
  }

  /**
   * Silently refresh the active ticket to check for new messages
   * Does not show loading spinner to avoid UI disruption
   */
  private refreshActiveTicket(): void {
    if (!this.activeTicket) return;

    this.ticketService.getTicket(this.activeTicket.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(null))
    ).subscribe({
      next: (ticket) => {
        if (ticket && ticket.messages) {
          const hadNewMessages = ticket.messages.length > this.messages.length;
          this.messages = ticket.messages;
          this.activeTicket = ticket;

          // Only scroll if there are new messages
          if (hadNewMessages) {
            this.scrollToBottom();
          }
          this.cdr.detectChanges();
        }
      }
    });
  }

  loadTickets(): void {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    this.isLoading = true;
    this.errorMessage = '';

    this.ticketService.getTickets().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((error: Error) => {
        this.errorMessage = 'Error al cargar los tickets: ' + (error?.message || 'Error desconocido');
        this.isLoading = false;
        return of([] as Ticket[]);
      }),
      finalize(() => {
        this.hasLoaded = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (tickets: Ticket[]) => {
        this.tickets = tickets ?? [];
        // Auto-select the most recent open ticket or first ticket
        if (this.tickets.length > 0) {
          const openTicket = this.tickets.find(t => t.status !== TicketStatus.CLOSED) ?? this.tickets[0];
          this.selectTicket(openTicket);
        } else {
          this.isLoading = false;
        }
      }
    });

    // Safety timeout - ensure content shows after 5 seconds
    // Clear any existing timeout before setting a new one
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
    }
    this.safetyTimeoutId = setTimeout(() => {
      if (!this.hasLoaded) {
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }
      this.safetyTimeoutId = null;
    }, 5000);
  }

  selectTicket(ticket: Ticket): void {
    this.activeTicket = ticket;
    this.loadMessages(ticket.id);
    // Mark messages as read when opening a ticket
    this.markAsRead(ticket.id);
  }

  /**
   * Mark all messages in the ticket as read
   */
  private markAsRead(ticketId: string): void {
    this.ticketService.markMessagesAsRead(ticketId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(null))
    ).subscribe({
      next: () => {
        // Update unread count in the ticket list
        const ticketIndex = this.tickets.findIndex(t => t.id === ticketId);
        if (ticketIndex !== -1) {
          this.tickets[ticketIndex] = { ...this.tickets[ticketIndex], unreadCount: 0 };
        }
        if (this.activeTicket?.id === ticketId) {
          this.activeTicket = { ...this.activeTicket, unreadCount: 0 };
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadMessages(ticketId: string): void {
    if (!ticketId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.ticketService.getTicket(ticketId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.errorMessage = 'Error al cargar los mensajes';
        return of(null);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (ticket: Ticket | null) => {
        if (ticket) {
          this.activeTicket = ticket;
          this.messages = ticket.messages ?? [];
        }
        this.scrollToBottom();
      }
    });
  }

  sendMessage(): void {
    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage || !this.activeTicket || this.isSending) return;

    this.isSending = true;
    this.errorMessage = '';

    this.ticketService.addMessage(this.activeTicket.id, { message: trimmedMessage }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.errorMessage = 'Error al enviar el mensaje';
        return of(null);
      }),
      finalize(() => {
        this.isSending = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (updatedTicket: Ticket | null) => {
        if (updatedTicket) {
          this.messages = updatedTicket.messages ?? [];
          this.newMessage = '';
          this.scrollToBottom();
        }
      }
    });
  }

  createTicket(): void {
    const trimmedSubject = this.newTicketSubject.trim();
    const trimmedMessage = this.newTicketMessage.trim();

    if (!trimmedSubject || !trimmedMessage) return;

    this.isSending = true;
    this.errorMessage = '';

    this.ticketService.create({
      subject: trimmedSubject,
      message: trimmedMessage
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.errorMessage = 'Error al crear el ticket';
        return of(null);
      }),
      finalize(() => {
        this.isSending = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (ticket: Ticket | null) => {
        if (ticket) {
          this.tickets.unshift(ticket);
          this.selectTicket(ticket);
          this.showNewTicketForm = false;
          this.newTicketSubject = '';
          this.newTicketMessage = '';
        }
      }
    });
  }

  cancelNewTicket(): void {
    this.showNewTicketForm = false;
    this.newTicketSubject = '';
    this.newTicketMessage = '';
    this.errorMessage = '';
  }

  /**
   * Show delete confirmation dialog
   */
  confirmDeleteTicket(ticket: Ticket, event: Event): void {
    event.stopPropagation();
    this.ticketToDelete = ticket;
    this.showDeleteConfirm = true;
  }

  /**
   * Cancel delete confirmation
   */
  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.ticketToDelete = null;
  }

  /**
   * Actually delete the ticket
   */
  deleteTicket(): void {
    if (!this.ticketToDelete || this.isDeleting) return;

    this.isDeleting = true;
    this.errorMessage = '';

    this.ticketService.deleteTicket(this.ticketToDelete.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.errorMessage = 'Error al eliminar el ticket';
        return of(null);
      }),
      finalize(() => {
        this.isDeleting = false;
        this.showDeleteConfirm = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response) {
          // Remove the ticket from the list
          const deletedId = this.ticketToDelete?.id;
          this.tickets = this.tickets.filter(t => t.id !== deletedId);

          // If the deleted ticket was active, clear it
          if (this.activeTicket?.id === deletedId) {
            this.activeTicket = null;
            this.messages = [];
            // Select next ticket if available
            if (this.tickets.length > 0) {
              this.selectTicket(this.tickets[0]);
            }
          }

          this.ticketToDelete = null;
        }
      }
    });
  }

  /**
   * Get total unread count across all tickets
   */
  getTotalUnreadCount(): number {
    return this.tickets.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
  }

  /**
   * Check if ticket has unread messages
   */
  hasUnread(ticket: Ticket): boolean {
    return (ticket.unreadCount || 0) > 0;
  }

  isFromAdmin(message: TicketMessage): boolean {
    return message.sender?.role === UserRole.ADMIN;
  }

  isMyMessage(message: TicketMessage): boolean {
    return message.senderId === this.userId;
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
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
    } catch {
      return '';
    }
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    if (index < 0 || index >= this.messages.length) return false;

    const currentMessage = this.messages[index];
    const previousMessage = this.messages[index - 1];

    if (!currentMessage?.createdAt || !previousMessage?.createdAt) return false;

    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();
    return currentDate !== previousDate;
  }

  getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'Abierto',
      [TicketStatus.IN_PROGRESS]: 'En progreso',
      [TicketStatus.CLOSED]: 'Cerrado'
    };
    return labels[status] ?? status;
  }

  getStatusClass(status: TicketStatus): string {
    const classes: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'status-open',
      [TicketStatus.IN_PROGRESS]: 'status-progress',
      [TicketStatus.CLOSED]: 'status-closed'
    };
    return classes[status] ?? '';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-list');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  logout(): void {
    this.authService.logout().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(null))
    ).subscribe({
      next: () => this.router.navigate(['/login'])
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
