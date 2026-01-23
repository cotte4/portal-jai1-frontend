import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription, filter, finalize } from 'rxjs';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { CompleteProfileRequest } from '../../core/models';
import { CardAnimateDirective, HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-tax-form',
  imports: [FormsModule, CommonModule, CardAnimateDirective, HoverScaleDirective],
  templateUrl: './tax-form.html',
  styleUrl: './tax-form.css'
})
export class TaxForm implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);
  private subscriptions = new Subscription();
  private animationsInitialized = false;

  // Form data mapped to API
  formData = {
    // Personal Information
    ssn: '',
    dateOfBirth: '',

    // Address
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',

    // Employment Information
    workState: '',
    employerName: '',

    // Bank Information
    bankName: '',
    bankRoutingNumber: '',
    bankAccountNumber: '',

    // TurboTax (optional)
    turbotaxEmail: '',
    turbotaxPassword: ''
  };

  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  isSavingDraft: boolean = false;
  hasLoadedProfile: boolean = false; // True after first profile load completes
  showSuccessScreen: boolean = false; // Show success animation after submit
  showAlreadyCompletedScreen: boolean = false; // Show info for users who already completed the form
  private justSubmitted: boolean = false; // Prevent redirect race condition after submit
  private isLoadingInProgress: boolean = false; // Prevent concurrent API calls

  ngOnInit() {
    this.loadDraft();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/tax-form')
      ).subscribe(() => this.loadDraft())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-form').subscribe(() => this.loadDraft())
    );
  }

  ngAfterViewInit() {
    // Initialize animations after view is ready
    setTimeout(() => {
      if (this.hasLoadedProfile && !this.showSuccessScreen && !this.showAlreadyCompletedScreen) {
        this.initFormAnimations();
      }
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  /**
   * Initialize GSAP animations for form sections
   */
  private initFormAnimations(): void {
    if (this.animationsInitialized) return;

    const nativeElement = this.elementRef.nativeElement;

    // Animate page header
    const pageHeader = nativeElement.querySelector('.page-header');
    if (pageHeader) {
      this.animationService.slideIn(pageHeader as HTMLElement, 'up', { duration: 0.5 });
    }

    // Stagger animate form sections
    const sections = nativeElement.querySelectorAll('.form-section');
    if (sections.length > 0) {
      this.animationService.staggerIn(sections, {
        direction: 'up',
        stagger: 0.15,
        delay: 0.2,
        distance: 30
      });
    }

    // Animate help card
    const helpCard = nativeElement.querySelector('.help-card');
    if (helpCard) {
      this.animationService.slideIn(helpCard as HTMLElement, 'up', { delay: 0.6 });
    }

    this.animationsInitialized = true;
  }

  /**
   * Shake animation for validation errors
   */
  shakeOnError(elementSelector: string): void {
    const element = this.elementRef.nativeElement.querySelector(elementSelector);
    if (element) {
      this.animationService.validationShake(element as HTMLElement);
    }
  }

  /**
   * Handle input focus animation
   */
  onInputFocus(event: FocusEvent): void {
    const input = event.target as HTMLElement;
    const formGroup = input.closest('.form-group');
    if (formGroup) {
      this.animationService.scaleIn(formGroup as HTMLElement, {
        fromScale: 0.98,
        duration: 0.2
      });
    }
  }

  loadDraft() {
    // Don't reload if user just submitted (showing success screen)
    if (this.justSubmitted) return;

    // Don't reload if already loading (prevent race conditions)
    if (this.isLoadingInProgress) return;

    this.isLoadingInProgress = true;

    this.profileService.getDraft().pipe(
      finalize(() => {
        // Always runs when Observable completes (success, error, or empty)
        this.hasLoadedProfile = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges(); // Force Angular to update the view

        // Initialize animations after profile loads and view updates
        setTimeout(() => {
          if (!this.showSuccessScreen && !this.showAlreadyCompletedScreen) {
            this.initFormAnimations();
          }
        }, 100);
      })
    ).subscribe({
      next: (profile) => {
        // Determine which screen to show based on profile state
        if (profile && profile.profileComplete && !profile.isDraft) {
          // Profile is complete - show info screen
          this.showAlreadyCompletedScreen = true;
        } else {
          // Profile is draft, incomplete, or doesn't exist - show form
          this.showAlreadyCompletedScreen = false;

          if (profile) {
            // Populate form with existing data
            this.formData = {
              ssn: profile.ssn || '',
              dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
              addressStreet: profile.address?.street || '',
              addressCity: profile.address?.city || '',
              addressState: profile.address?.state || '',
              addressZip: profile.address?.zip || '',
              workState: profile.workState || '',
              employerName: profile.employerName || '',
              bankName: profile.bank?.name || '',
              bankRoutingNumber: profile.bank?.routingNumber || '',
              bankAccountNumber: profile.bank?.accountNumber || '',
              turbotaxEmail: profile.turbotaxEmail || '',
              turbotaxPassword: profile.turbotaxPassword || ''
            };
          }
        }
      },
      error: () => {
        // Error or no draft exists - show empty form
        this.showAlreadyCompletedScreen = false;
      }
    });
  }

  onSubmit() {
    this.saveProfile(false);
  }

  saveDraft() {
    this.saveProfile(true);
  }

  private saveProfile(isDraft: boolean) {
    this.successMessage = '';
    this.errorMessage = '';

    // Basic validation for final submit
    if (!isDraft) {
      if (!this.formData.ssn || !this.formData.dateOfBirth) {
        this.errorMessage = 'Por favor completa los campos requeridos (SSN y fecha de nacimiento)';
        this.shakeOnError('.message.error-message');
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.addressStreet || !this.formData.addressCity ||
          !this.formData.addressState || !this.formData.addressZip) {
        this.errorMessage = 'Por favor completa tu direccion';
        this.shakeOnError('.message.error-message');
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.bankName || !this.formData.bankRoutingNumber ||
          !this.formData.bankAccountNumber) {
        this.errorMessage = 'Por favor completa tu informacion bancaria';
        this.shakeOnError('.message.error-message');
        window.scrollTo(0, 0);
        return;
      }
    }

    if (isDraft) {
      this.isSavingDraft = true;
    } else {
      this.isLoading = true;
    }

    const request: CompleteProfileRequest = {
      ssn: this.formData.ssn,
      dateOfBirth: this.formData.dateOfBirth,
      address: {
        street: this.formData.addressStreet,
        city: this.formData.addressCity,
        state: this.formData.addressState,
        zip: this.formData.addressZip
      },
      bank: {
        name: this.formData.bankName,
        routingNumber: this.formData.bankRoutingNumber,
        accountNumber: this.formData.bankAccountNumber
      },
      workState: this.formData.workState,
      employerName: this.formData.employerName,
      turbotaxEmail: this.formData.turbotaxEmail || undefined,
      turbotaxPassword: this.formData.turbotaxPassword || undefined,
      isDraft: isDraft
    };

    this.profileService.completeProfile(request).subscribe({
      next: () => {
        this.isLoading = false;
        this.isSavingDraft = false;

        if (isDraft) {
          this.successMessage = 'Borrador guardado correctamente';
          window.scrollTo(0, 0);
        } else {
          // Set flag to prevent redirect race condition in loadDraft()
          this.justSubmitted = true;
          // Show success screen with animation
          this.showSuccessScreen = true;
          window.scrollTo(0, 0);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.isSavingDraft = false;
        this.errorMessage = error.message || 'Error al guardar. Intenta nuevamente.';
        window.scrollTo(0, 0);
      }
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  continueToDocuments() {
    this.router.navigate(['/documents']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToSupport() {
    this.router.navigate(['/messages']);
  }

  isFormComplete(): boolean {
    return !!(
      this.formData.ssn &&
      this.formData.dateOfBirth &&
      this.formData.addressStreet &&
      this.formData.addressCity &&
      this.formData.addressState &&
      this.formData.addressZip &&
      this.formData.workState &&
      this.formData.employerName &&
      this.formData.bankName &&
      this.formData.bankRoutingNumber &&
      this.formData.bankAccountNumber
    );
  }
}
