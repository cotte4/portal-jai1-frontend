import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { ProfileResponse, ClientStatus, TaxStatus, NotificationType } from '../../core/models';
import { interval, Subscription, filter, skip, finalize } from 'rxjs';
import { CardAnimateDirective, HoverScaleDirective } from '../../shared/directives';

interface TrackingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'rejected';
  date?: string;
  detail?: string;
}

@Component({
  selector: 'app-tax-tracking',
  imports: [CommonModule, CardAnimateDirective, HoverScaleDirective],
  templateUrl: './tax-tracking.html',
  styleUrl: './tax-tracking.css'
})
export class TaxTracking implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private notificationService = inject(NotificationService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);
  private animationsInitialized = false;

  profileData: ProfileResponse | null = null;
  isLoading = true;
  hasLoaded = false;
  lastRefresh: Date = new Date();
  isRefreshing = false;

  private subscriptions = new Subscription();
  private previousStatus?: ClientStatus;
  private previousFederalStatus?: TaxStatus;
  private previousStateStatus?: TaxStatus;
  private isLoadingInProgress = false;

  // Shared initial steps (before split)
  sharedSteps: TrackingStep[] = [];

  // Federal track steps
  federalSteps: TrackingStep[] = [];

  // Estatal track steps
  estatalSteps: TrackingStep[] = [];

  ngOnInit() {
    this.loadTrackingData();

    this.subscriptions.add(
      interval(30000).subscribe(() => {
        this.silentRefresh();
      })
    );

    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.includes('/tax-tracking')),
        skip(1)
      ).subscribe(() => {
        if (this.hasLoaded) {
          this.loadTrackingData();
        }
      })
    );

    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-tracking').subscribe(() => {
        if (this.hasLoaded) {
          this.loadTrackingData();
        }
      })
    );
  }

  ngAfterViewInit() {
    // Animations will be triggered after data loads
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  /**
   * Initialize timeline animations
   */
  private initTimelineAnimations(): void {
    if (this.animationsInitialized) return;

    const nativeElement = this.elementRef.nativeElement;

    // Animate header
    const header = nativeElement.querySelector('.tracking-header');
    if (header) {
      this.animationService.slideIn(header as HTMLElement, 'up', { duration: 0.4 });
    }

    // Stagger animate summary cards
    const summaryCards = nativeElement.querySelectorAll('.summary-card');
    if (summaryCards.length > 0) {
      this.animationService.staggerIn(summaryCards, {
        direction: 'up',
        stagger: 0.1,
        delay: 0.2,
        distance: 25
      });
    }

    // Animate shared timeline
    const sharedTimeline = nativeElement.querySelector('.shared-timeline');
    if (sharedTimeline) {
      this.animationService.slideIn(sharedTimeline as HTMLElement, 'up', { delay: 0.4 });
    }

    // Stagger animate shared steps
    const sharedSteps = nativeElement.querySelectorAll('.shared-step');
    if (sharedSteps.length > 0) {
      this.animationService.staggerIn(sharedSteps, {
        direction: 'left',
        stagger: 0.15,
        delay: 0.5,
        distance: 30
      });
    }

    // Animate branch split
    const branchSplit = nativeElement.querySelector('.branch-split');
    if (branchSplit) {
      this.animationService.scaleIn(branchSplit as HTMLElement, { delay: 0.7, fromScale: 0.8 });
    }

    // Animate dual track containers
    const tracks = nativeElement.querySelectorAll('.track');
    if (tracks.length > 0) {
      this.animationService.staggerIn(tracks, {
        direction: 'up',
        stagger: 0.2,
        delay: 0.8,
        distance: 40
      });
    }

    // Stagger animate track steps (federal)
    const federalSteps = nativeElement.querySelectorAll('.federal-track .track-step');
    if (federalSteps.length > 0) {
      this.animationService.staggerIn(federalSteps, {
        direction: 'up',
        stagger: 0.12,
        delay: 1.0,
        distance: 20
      });
    }

    // Stagger animate track steps (estatal)
    const estatalSteps = nativeElement.querySelectorAll('.estatal-track .track-step');
    if (estatalSteps.length > 0) {
      this.animationService.staggerIn(estatalSteps, {
        direction: 'up',
        stagger: 0.12,
        delay: 1.1,
        distance: 20
      });
    }

    // Animate status icons with scale effect
    const statusDots = nativeElement.querySelectorAll('.step-dot, .step-indicator');
    statusDots.forEach((dot: Element, index: number) => {
      this.animationService.scaleIn(dot as HTMLElement, {
        delay: 1.2 + (index * 0.05),
        fromScale: 0.5
      });
    });

    // Animate help section
    const helpSection = nativeElement.querySelector('.help-section');
    if (helpSection) {
      this.animationService.slideIn(helpSection as HTMLElement, 'up', { delay: 1.5 });
    }

    // Animate info note
    const infoNote = nativeElement.querySelector('.info-note');
    if (infoNote) {
      this.animationService.fadeIn(infoNote as HTMLElement, { delay: 1.6 });
    }

    this.animationsInitialized = true;
  }

  loadTrackingData() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    this.isLoading = true;
    this.buildSteps();

    this.profileService.getProfile().pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoading = false;
        this.isLoadingInProgress = false;
        this.lastRefresh = new Date();
        this.cdr.detectChanges();

        // Initialize animations after data loads and view updates
        setTimeout(() => {
          this.initTimelineAnimations();
        }, 100);
      })
    ).subscribe({
      next: (data) => {
        if (data) {
          this.profileData = data;
          this.previousStatus = data.taxCase?.clientStatus;
          this.previousFederalStatus = data.taxCase?.federalStatus;
          this.previousStateStatus = data.taxCase?.stateStatus;
          this.buildSteps();
        }
      },
      error: () => {}
    });
  }

  silentRefresh() {
    this.profileService.getProfile().subscribe({
      next: (data) => {
        if (this.previousStatus && data.taxCase?.clientStatus !== this.previousStatus) {
          this.onStatusChanged(data.taxCase?.clientStatus);
        }

        // Check for Federal status changes
        this.checkFederalStatusChange(data.taxCase?.federalStatus);

        // Check for State status changes
        this.checkStateStatusChange(data.taxCase?.stateStatus);

        this.previousStatus = data.taxCase?.clientStatus;
        this.previousFederalStatus = data.taxCase?.federalStatus;
        this.previousStateStatus = data.taxCase?.stateStatus;
        this.profileData = data;
        this.buildSteps();
        this.lastRefresh = new Date();
        this.cdr.detectChanges();
      }
    });
  }

  manualRefresh() {
    this.isRefreshing = true;
    this.profileService.getProfile().subscribe({
      next: (data) => {
        if (this.previousStatus && data.taxCase?.clientStatus !== this.previousStatus) {
          this.onStatusChanged(data.taxCase?.clientStatus);
        }

        // Check for Federal status changes
        this.checkFederalStatusChange(data.taxCase?.federalStatus);

        // Check for State status changes
        this.checkStateStatusChange(data.taxCase?.stateStatus);

        this.previousStatus = data.taxCase?.clientStatus;
        this.previousFederalStatus = data.taxCase?.federalStatus;
        this.previousStateStatus = data.taxCase?.stateStatus;
        this.profileData = data;
        this.buildSteps();
        this.lastRefresh = new Date();
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    });
  }

  private onStatusChanged(newStatus?: ClientStatus) {
    if (!newStatus) return;

    const statusMessages: Record<ClientStatus, string> = {
      [ClientStatus.ESPERANDO_DATOS]: 'Estamos esperando tus datos',
      [ClientStatus.CUENTA_EN_REVISION]: '¡Tu cuenta está siendo revisada!',
      [ClientStatus.TAXES_EN_PROCESO]: '¡Tu declaración está siendo procesada!',
      [ClientStatus.TAXES_EN_CAMINO]: '¡Tu reembolso está en camino!',
      [ClientStatus.TAXES_DEPOSITADOS]: '¡Tu reembolso fue depositado!',
      [ClientStatus.PAGO_REALIZADO]: 'Pago recibido, gracias!',
      [ClientStatus.EN_VERIFICACION]: 'El IRS está verificando tu declaración',
      [ClientStatus.TAXES_FINALIZADOS]: '¡Proceso completado exitosamente!'
    };

    console.log('Status changed:', statusMessages[newStatus]);
  }

  private checkFederalStatusChange(newStatus?: TaxStatus): void {
    if (!this.previousFederalStatus || this.previousFederalStatus === newStatus) return;

    if (newStatus === TaxStatus.APPROVED) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Federal Aprobada!',
        'Tu declaración federal ha sido aprobada por el IRS. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (newStatus === TaxStatus.REJECTED) {
      this.notificationService.emitLocalNotification(
        'Declaración Federal Rechazada',
        'Tu declaración federal fue rechazada por el IRS. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (newStatus === TaxStatus.DEPOSITED) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Federal Depositado!',
        'Tu reembolso federal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
    }
  }

  private checkStateStatusChange(newStatus?: TaxStatus): void {
    if (!this.previousStateStatus || this.previousStateStatus === newStatus) return;

    if (newStatus === TaxStatus.APPROVED) {
      this.notificationService.emitLocalNotification(
        '¡Declaración Estatal Aprobada!',
        'Tu declaración estatal ha sido aprobada. Pronto recibirás tu reembolso.',
        NotificationType.STATUS_CHANGE
      );
    } else if (newStatus === TaxStatus.REJECTED) {
      this.notificationService.emitLocalNotification(
        'Declaración Estatal Rechazada',
        'Tu declaración estatal fue rechazada. Contacta a soporte para más información.',
        NotificationType.PROBLEM_ALERT
      );
    } else if (newStatus === TaxStatus.DEPOSITED) {
      this.notificationService.emitLocalNotification(
        '¡Reembolso Estatal Depositado!',
        'Tu reembolso estatal ha sido depositado en tu cuenta.',
        NotificationType.STATUS_CHANGE
      );
    }
  }

  private buildSteps() {
    const taxCase = this.profileData?.taxCase;
    const profile = this.profileData?.profile;

    const clientStatus = taxCase?.clientStatus || ClientStatus.ESPERANDO_DATOS;
    const federalStatus = taxCase?.federalStatus;
    const stateStatus = taxCase?.stateStatus;

    // SHARED STEPS (Steps 1-2)
    this.sharedSteps = [
      {
        id: 'received',
        title: 'Información Recibida',
        description: 'Recibimos tus datos y documentos',
        icon: '📋',
        status: this.getStepStatus('received', clientStatus, profile?.profileComplete),
        date: profile?.updatedAt ? this.formatDate(profile.updatedAt) : undefined,
        detail: profile?.profileComplete ? 'Perfil completo' : 'Pendiente de completar'
      },
      {
        id: 'submitted',
        title: 'Presentado al IRS',
        description: 'Tu declaración fue enviada al IRS',
        icon: '🏛️',
        status: this.getStepStatus('submitted', clientStatus),
        date: this.isSubmitted(clientStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.isSubmitted(clientStatus) ? 'Declaración enviada' : 'Esperando envío'
      }
    ];

    // FEDERAL TRACK (3 steps)
    this.federalSteps = [
      {
        id: 'federal-decision',
        title: 'Decisión Federal',
        description: 'Resultado del IRS Federal',
        icon: this.getFederalDecisionIcon(federalStatus),
        status: this.getFederalDecisionStatus(federalStatus, clientStatus),
        date: this.isFederalProcessed(federalStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getFederalDecisionDetail(federalStatus)
      },
      {
        id: 'federal-estimate',
        title: 'Fecha Estimada',
        description: 'Reembolso federal',
        icon: '📅',
        status: this.getFederalEstimateStatus(federalStatus, clientStatus),
        date: taxCase?.refundDepositDate ? this.formatDate(taxCase.refundDepositDate) : undefined,
        detail: this.getFederalEstimateDetail(federalStatus, taxCase?.refundDepositDate)
      },
      {
        id: 'federal-sent',
        title: 'Reembolso Enviado',
        description: 'Federal depositado',
        icon: '💵',
        status: this.getFederalRefundStatus(federalStatus, clientStatus),
        date: taxCase?.refundDepositDate ? this.formatDate(taxCase.refundDepositDate) : undefined,
        detail: this.getFederalRefundDetail(federalStatus, taxCase?.actualRefund)
      }
    ];

    // ESTATAL TRACK (3 steps)
    this.estatalSteps = [
      {
        id: 'state-decision',
        title: 'Decisión Estatal',
        description: 'Resultado del IRS Estatal',
        icon: this.getStateDecisionIcon(stateStatus),
        status: this.getStateDecisionStatus(stateStatus, clientStatus),
        date: this.isStateProcessed(stateStatus) ? this.formatDate(taxCase?.statusUpdatedAt) : undefined,
        detail: this.getStateDecisionDetail(stateStatus)
      },
      {
        id: 'state-estimate',
        title: 'Fecha Estimada',
        description: 'Reembolso estatal',
        icon: '📅',
        status: this.getStateEstimateStatus(stateStatus, clientStatus),
        date: taxCase?.refundDepositDate ? this.formatDate(taxCase.refundDepositDate) : undefined,
        detail: this.getStateEstimateDetail(stateStatus, taxCase?.refundDepositDate)
      },
      {
        id: 'state-sent',
        title: 'Reembolso Enviado',
        description: 'Estatal depositado',
        icon: '💵',
        status: this.getStateRefundStatus(stateStatus, clientStatus),
        date: taxCase?.refundDepositDate ? this.formatDate(taxCase.refundDepositDate) : undefined,
        detail: this.getStateRefundDetail(stateStatus, taxCase?.actualRefund)
      }
    ];
  }

  // ============ SHARED STEP HELPERS ============
  private getStepStatus(step: string, clientStatus: ClientStatus, profileComplete?: boolean): TrackingStep['status'] {
    if (step === 'received') {
      if (profileComplete) return 'completed';
      return 'active';
    }

    if (step === 'submitted') {
      const submittedStatuses = [
        ClientStatus.TAXES_EN_PROCESO,
        ClientStatus.TAXES_EN_CAMINO,
        ClientStatus.EN_VERIFICACION,
        ClientStatus.TAXES_DEPOSITADOS,
        ClientStatus.TAXES_FINALIZADOS
      ];
      if (submittedStatuses.includes(clientStatus)) return 'completed';
      if (clientStatus === ClientStatus.CUENTA_EN_REVISION) return 'active';
      return 'pending';
    }

    return 'pending';
  }

  private isSubmitted(status: ClientStatus): boolean {
    const submittedStatuses = [
      ClientStatus.TAXES_EN_PROCESO,
      ClientStatus.TAXES_EN_CAMINO,
      ClientStatus.EN_VERIFICACION,
      ClientStatus.TAXES_DEPOSITADOS,
      ClientStatus.TAXES_FINALIZADOS
    ];
    return submittedStatuses.includes(status);
  }

  // ============ FEDERAL HELPERS ============
  private getFederalDecisionIcon(federalStatus?: TaxStatus): string {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return '✅';
    if (federalStatus === TaxStatus.REJECTED) return '❌';
    return '🦅';
  }

  private getFederalDecisionStatus(federalStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    if (federalStatus === TaxStatus.PROCESSING) return 'active';
    if (this.isSubmitted(clientStatus || ClientStatus.ESPERANDO_DATOS)) return 'active';
    return 'pending';
  }

  private getFederalDecisionDetail(federalStatus?: TaxStatus): string {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'Aprobado';
    if (federalStatus === TaxStatus.REJECTED) return 'Rechazado';
    if (federalStatus === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private isFederalProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getFederalEstimateStatus(federalStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    return 'pending';
  }

  private getFederalEstimateDetail(federalStatus?: TaxStatus, estimatedDate?: string): string {
    if (federalStatus === TaxStatus.REJECTED) return 'No aplica';
    if (federalStatus === TaxStatus.APPROVED || federalStatus === TaxStatus.DEPOSITED) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getFederalRefundStatus(federalStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (federalStatus === TaxStatus.DEPOSITED) return 'completed';
    if (federalStatus === TaxStatus.REJECTED) return 'rejected';
    if (federalStatus === TaxStatus.APPROVED) return 'active';
    return 'pending';
  }

  private getFederalRefundDetail(federalStatus?: TaxStatus, actualRefund?: number): string {
    if (federalStatus === TaxStatus.DEPOSITED) {
      return actualRefund ? `$${actualRefund.toLocaleString()}` : 'Depositado';
    }
    if (federalStatus === TaxStatus.REJECTED) return 'No aplica';
    if (federalStatus === TaxStatus.APPROVED) return 'En proceso';
    return 'Pendiente';
  }

  // ============ ESTATAL HELPERS ============
  private getStateDecisionIcon(stateStatus?: TaxStatus): string {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return '✅';
    if (stateStatus === TaxStatus.REJECTED) return '❌';
    return '🗽';
  }

  private getStateDecisionStatus(stateStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    if (stateStatus === TaxStatus.PROCESSING) return 'active';
    if (this.isSubmitted(clientStatus || ClientStatus.ESPERANDO_DATOS)) return 'active';
    return 'pending';
  }

  private getStateDecisionDetail(stateStatus?: TaxStatus): string {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'Aprobado';
    if (stateStatus === TaxStatus.REJECTED) return 'Rechazado';
    if (stateStatus === TaxStatus.PROCESSING) return 'En revisión...';
    return 'Pendiente';
  }

  private isStateProcessed(status?: TaxStatus): boolean {
    return status === TaxStatus.APPROVED || status === TaxStatus.REJECTED || status === TaxStatus.DEPOSITED;
  }

  private getStateEstimateStatus(stateStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    return 'pending';
  }

  private getStateEstimateDetail(stateStatus?: TaxStatus, estimatedDate?: string): string {
    if (stateStatus === TaxStatus.REJECTED) return 'No aplica';
    if (stateStatus === TaxStatus.APPROVED || stateStatus === TaxStatus.DEPOSITED) {
      return estimatedDate ? this.formatDate(estimatedDate) : 'Fecha por confirmar';
    }
    return 'Pendiente de aprobación';
  }

  private getStateRefundStatus(stateStatus?: TaxStatus, clientStatus?: ClientStatus): TrackingStep['status'] {
    if (stateStatus === TaxStatus.DEPOSITED) return 'completed';
    if (stateStatus === TaxStatus.REJECTED) return 'rejected';
    if (stateStatus === TaxStatus.APPROVED) return 'active';
    return 'pending';
  }

  private getStateRefundDetail(stateStatus?: TaxStatus, stateRefund?: number): string {
    if (stateStatus === TaxStatus.DEPOSITED) {
      return stateRefund ? `$${stateRefund.toLocaleString()}` : 'Depositado';
    }
    if (stateStatus === TaxStatus.REJECTED) return 'No aplica';
    if (stateStatus === TaxStatus.APPROVED) return 'En proceso';
    return 'Pendiente';
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // ============ COMPUTED PROPERTIES ============
  get federalProgressPercent(): number {
    const completed = this.federalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.federalSteps.length) * 100);
  }

  get estatalProgressPercent(): number {
    const completed = this.estatalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.estatalSteps.length) * 100);
  }

  get sharedProgressPercent(): number {
    const completed = this.sharedSteps.filter(s => s.status === 'completed').length;
    return Math.round((completed / this.sharedSteps.length) * 100);
  }

  get overallProgressPercent(): number {
    const totalSteps = this.sharedSteps.length + this.federalSteps.length + this.estatalSteps.length;
    const completedSteps =
      this.sharedSteps.filter(s => s.status === 'completed').length +
      this.federalSteps.filter(s => s.status === 'completed').length +
      this.estatalSteps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / totalSteps) * 100);
  }

  get estimatedRefund(): number | null {
    return this.profileData?.taxCase?.estimatedRefund || null;
  }

  get actualRefund(): number | null {
    return this.profileData?.taxCase?.actualRefund || null;
  }

  get lastRefreshFormatted(): string {
    return this.lastRefresh.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
