import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize, catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket, TicketMessage, TicketStatus, UserRole } from '../../core/models';

@Component({
  selector: 'app-admin-tickets',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-tickets.html',
  styleUrl: './admin-tickets.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTickets implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  // Expose enum to template
  readonly TicketStatus = TicketStatus;

  // Data
  allTickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  messages: TicketMessage[] = [];

  // UI State
  isLoading: boolean = true;
  hasLoaded: boolean = false;
  isSending: boolean = false;
  isUpdatingStatus: boolean = false;
  errorMessage: string = '';
  newMessage: string = '';
  selectedFilter: TicketStatus | 'all' = 'all';

  // Stats
  stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0
  };

  ngOnInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTickets(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Get all tickets (admin sees all)
    const statusFilter = this.selectedFilter === 'all' ? undefined : this.selectedFilter;

    this.ticketService.getTickets(statusFilter).pipe(
      catchError((error: Error) => {
        this.errorMessage = error?.message || 'Error al cargar tickets';
        console.error('Error loading tickets:', error);
        return of([] as Ticket[]);
      }),
      finalize(() => {
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (tickets: Ticket[]) => {
        this.filteredTickets = tickets ?? [];

        // If no filter, also update allTickets for stats
        if (this.selectedFilter === 'all') {
          this.allTickets = tickets ?? [];
          this.calculateStats();
        }
      }
    });

    // Load stats separately if filter is active
    if (this.selectedFilter !== 'all') {
      this.loadStats();
    }
  }

  private loadStats(): void {
    this.ticketService.getTickets().pipe(
      catchError(() => of([] as Ticket[]))
    ).subscribe({
      next: (tickets: Ticket[]) => {
        this.allTickets = tickets ?? [];
        this.calculateStats();
        this.cdr.detectChanges();
      }
    });
  }

  calculateStats(): void {
    this.stats.total = this.allTickets.length;
    this.stats.open = this.allTickets.filter(t => t.status === TicketStatus.OPEN).length;
    this.stats.inProgress = this.allTickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
    this.stats.closed = this.allTickets.filter(t => t.status === TicketStatus.CLOSED).length;
  }

  filterTickets(filter: TicketStatus | 'all'): void {
    this.selectedFilter = filter;
    this.loadTickets();
  }

  selectTicket(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.loadMessages(ticket.id);
    // Mark messages as read
    this.markAsRead(ticket.id);
  }

  private markAsRead(ticketId: string): void {
    this.ticketService.markMessagesAsRead(ticketId).pipe(
      catchError(() => of(null))
    ).subscribe({
      next: () => {
        // Update unread count in lists
        const ticketIndex = this.filteredTickets.findIndex(t => t.id === ticketId);
        if (ticketIndex !== -1) {
          this.filteredTickets[ticketIndex] = { ...this.filteredTickets[ticketIndex], unreadCount: 0 };
        }
        if (this.selectedTicket?.id === ticketId) {
          this.selectedTicket = { ...this.selectedTicket, unreadCount: 0 };
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadMessages(ticketId: string): void {
    if (!ticketId) return;

    this.ticketService.getTicket(ticketId).pipe(
      catchError((error: Error) => {
        this.errorMessage = 'Error al cargar mensajes';
        console.error('Error loading messages:', error);
        return of(null);
      })
    ).subscribe({
      next: (ticket: Ticket | null) => {
        if (ticket) {
          this.selectedTicket = ticket;
          this.messages = ticket.messages ?? [];
          this.scrollToBottom();
        }
        this.cdr.detectChanges();
      }
    });
  }

  sendMessage(): void {
    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage || !this.selectedTicket || this.isSending) return;

    this.isSending = true;
    this.errorMessage = '';

    this.ticketService.addMessage(this.selectedTicket.id, { message: trimmedMessage }).pipe(
      catchError((error: Error) => {
        this.errorMessage = 'Error al enviar mensaje';
        console.error('Error sending message:', error);
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

  updateTicketStatus(status: TicketStatus): void {
    if (!this.selectedTicket || this.isUpdatingStatus) return;

    this.isUpdatingStatus = true;
    this.errorMessage = '';

    this.ticketService.updateStatus(this.selectedTicket.id, status).pipe(
      catchError((error: Error) => {
        this.errorMessage = 'Error al actualizar estado';
        console.error('Error updating status:', error);
        return of(null);
      }),
      finalize(() => {
        this.isUpdatingStatus = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        if (response) {
          // Update the ticket in lists
          if (this.selectedTicket) {
            this.selectedTicket = { ...this.selectedTicket, status };

            const ticketIndex = this.filteredTickets.findIndex(t => t.id === this.selectedTicket?.id);
            if (ticketIndex !== -1) {
              this.filteredTickets[ticketIndex] = { ...this.filteredTickets[ticketIndex], status };
            }

            const allIndex = this.allTickets.findIndex(t => t.id === this.selectedTicket?.id);
            if (allIndex !== -1) {
              this.allTickets[allIndex] = { ...this.allTickets[allIndex], status };
            }

            this.calculateStats();
          }
        }
      }
    });
  }

  closeTicket(): void {
    this.updateTicketStatus(TicketStatus.CLOSED);
  }

  reopenTicket(): void {
    this.updateTicketStatus(TicketStatus.OPEN);
  }

  markInProgress(): void {
    this.updateTicketStatus(TicketStatus.IN_PROGRESS);
  }

  clearSelectedTicket(): void {
    this.selectedTicket = null;
    this.messages = [];
    this.newMessage = '';
  }

  // Helper methods
  getClientName(ticket: Ticket): string {
    // The ticket might include user info from backend
    const ticketAny = ticket as any;
    if (ticketAny.user) {
      const firstName = ticketAny.user.firstName || '';
      const lastName = ticketAny.user.lastName || '';
      return `${firstName} ${lastName}`.trim() || ticketAny.user.email || 'Cliente';
    }
    return 'Cliente';
  }

  getClientEmail(ticket: Ticket): string {
    const ticketAny = ticket as any;
    return ticketAny.user?.email || '';
  }

  getInitials(ticket: Ticket): string {
    const ticketAny = ticket as any;
    if (ticketAny.user) {
      const first = ticketAny.user.firstName?.charAt(0)?.toUpperCase() || '';
      const last = ticketAny.user.lastName?.charAt(0)?.toUpperCase() || '';
      return first + last || '??';
    }
    return '??';
  }

  isFromAdmin(message: TicketMessage): boolean {
    return message.sender?.role === UserRole.ADMIN;
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
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  formatFullDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  getStatusLabel(status: TicketStatus): string {
    const labels: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'Abierto',
      [TicketStatus.IN_PROGRESS]: 'En Progreso',
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

  hasUnread(ticket: Ticket): boolean {
    return (ticket.unreadCount || 0) > 0;
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

  private scrollToBottom(): void {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.conversation-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  refreshData(): void {
    this.loadTickets();
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  logout(): void {
    this.authService.logout().pipe(
      catchError(() => of(null))
    ).subscribe({
      next: () => this.router.navigate(['/admin-login'])
    });
  }

  // ===== TRACKBY FUNCTIONS =====

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
