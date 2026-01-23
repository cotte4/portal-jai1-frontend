import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, skip, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';
import { Ticket, TicketMessage, TicketStatus, UserRole } from '../../core/models';
import { gsap } from 'gsap';

@Component({
  selector: 'app-user-messages',
  imports: [CommonModule, FormsModule, HoverScaleDirective],
  templateUrl: './user-messages.html',
  styleUrl: './user-messages.css'
})
export class UserMessages implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private ticketService = inject(TicketService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
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
  private pageAnimated: boolean = false;
  private lastMessageCount: number = 0;

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

  ngAfterViewInit() {
    // Animations will be triggered after loading completes
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  private animatePageEntrance() {
    if (this.pageAnimated) return;
    this.pageAnimated = true;

    // Animate title section
    const titleSection = document.querySelector('.messages-title-section') as HTMLElement;
    if (titleSection) {
      this.animationService.slideIn(titleSection, 'down', { duration: 0.4 });
    }

    // Animate tickets sidebar
    const ticketsSidebar = document.querySelector('.tickets-sidebar') as HTMLElement;
    if (ticketsSidebar) {
      this.animationService.slideIn(ticketsSidebar, 'left', { delay: 0.2 });
    }

    // Animate chat container
    const chatContainer = document.querySelector('.chat-container') as HTMLElement;
    if (chatContainer) {
      this.animationService.fadeIn(chatContainer, { delay: 0.3 });
    }

    // Animate info card
    const infoCard = document.querySelector('.info-card') as HTMLElement;
    if (infoCard) {
      this.animationService.slideIn(infoCard, 'up', { delay: 0.5 });
    }
  }

  private animateTicketsList() {
    // Stagger animate ticket items
    const ticketItems = document.querySelectorAll('.ticket-item');
    if (ticketItems.length > 0) {
      this.animationService.staggerIn(ticketItems, {
        direction: 'right',
        stagger: 0.05,
        delay: 0.1
      });
    }
  }

  private animateMessagesList() {
    // Stagger animate message wrappers
    const messageWrappers = document.querySelectorAll('.message-wrapper');
    if (messageWrappers.length > 0) {
      this.animationService.staggerIn(messageWrappers, {
        direction: 'up',
        stagger: 0.05,
        delay: 0.1
      });
    }
  }

  private animateNewMessage(isClientMessage: boolean = true) {
    // Animate the last (newest) message
    const messageWrappers = document.querySelectorAll('.message-wrapper');
    if (messageWrappers.length > 0) {
      const lastMessage = messageWrappers[messageWrappers.length - 1] as HTMLElement;
      const direction = isClientMessage ? 'right' : 'left';
      gsap.fromTo(lastMessage,
        { opacity: 0, x: isClientMessage ? 30 : -30, y: 10 },
        { opacity: 1, x: 0, y: 0, duration: 0.4, ease: 'back.out(1.2)' }
      );
    }
  }

  animateInputFocus(event: FocusEvent) {
    const input = event.target as HTMLElement;
    if (input && !this.animationService.prefersReducedMotion()) {
      gsap.to(input, {
        scale: 1.01,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
  }

  animateInputBlur(event: FocusEvent) {
    const input = event.target as HTMLElement;
    if (input && !this.animationService.prefersReducedMotion()) {
      gsap.to(input, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
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

        // Trigger page animations after first load
        setTimeout(() => {
          this.animatePageEntrance();
          this.animateTicketsList();
        }, 50);
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
          this.lastMessageCount = this.messages.length;
        }
        this.scrollToBottom();

        // Animate messages after load
        setTimeout(() => this.animateMessagesList(), 50);
      },
      error: () => {
        this.errorMessage = 'Error al cargar los mensajes';
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.activeTicket || this.isSending) return;

    this.isSending = true;
    const previousMessageCount = this.messages.length;

    this.ticketService.addMessage(this.activeTicket.id, { message: this.newMessage }).subscribe({
      next: (updatedTicket) => {
        this.messages = updatedTicket.messages || [];
        this.newMessage = '';
        this.isSending = false;
        this.scrollToBottom();

        // Animate new message if count increased
        if (this.messages.length > previousMessageCount) {
          setTimeout(() => this.animateNewMessage(true), 50);
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al enviar el mensaje';
        this.isSending = false;

        // Shake the send button on error
        const sendBtn = document.querySelector('.btn-send') as HTMLElement;
        if (sendBtn) {
          this.animationService.validationShake(sendBtn);
        }

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

        // Animate new ticket item
        setTimeout(() => {
          const firstTicket = document.querySelector('.ticket-item') as HTMLElement;
          if (firstTicket) {
            gsap.fromTo(firstTicket,
              { opacity: 0, x: -20 },
              { opacity: 1, x: 0, duration: 0.4, ease: 'back.out(1.2)' }
            );
          }
        }, 50);
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
