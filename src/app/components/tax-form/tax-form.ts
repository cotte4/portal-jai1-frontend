import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription, filter, finalize, forkJoin, of, catchError, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ReferralService } from '../../core/services/referral.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { CompleteProfileRequest } from '../../core/models';

const TAX_FORM_CACHE_KEY = 'jai1_tax_form_draft';

@Component({
  selector: 'app-tax-form',
  imports: [FormsModule, CommonModule],
  templateUrl: './tax-form.html',
  styleUrl: './tax-form.css'
})
export class TaxForm implements OnInit, OnDestroy {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private dataRefreshService = inject(DataRefreshService);
  private referralService = inject(ReferralService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private autoSaveSubject = new Subject<void>();

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

  // Referral code state
  referralCode: string = '';
  referralCodeValid: boolean | null = null;
  referralCodeValidating: boolean = false;
  referralCodeApplying: boolean = false;
  referrerName: string = '';
  hasAppliedReferral: boolean = false; // True if user already has a referral applied

  ngOnInit() {
    // Load local cache first (instant) then fetch from API
    this.loadLocalDraft();
    this.loadDraft();

    // Auto-save form data with debounce (500ms after last change)
    this.subscriptions.add(
      this.autoSaveSubject.pipe(
        debounceTime(500)
      ).subscribe(() => this.cacheFormData())
    );

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/tax-form')
      ).subscribe(() => {
        this.loadLocalDraft();
        this.loadDraft();
      })
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-form').subscribe(() => this.loadDraft())
    );
  }

  ngOnDestroy() {
    // Save form data before component is destroyed (tab switch, navigation away)
    this.cacheFormData();
    this.subscriptions.unsubscribe();
  }

  loadDraft() {
    // Don't reload if user just submitted (showing success screen)
    if (this.justSubmitted) return;

    // Don't reload if already loading (prevent race conditions)
    if (this.isLoadingInProgress) return;

    this.isLoadingInProgress = true;
    // Keep hasLoadedProfile = false until API completes to show loading spinner

    // Fetch both profile draft and referrer status in parallel
    // Use catchError to prevent forkJoin from failing completely if one request fails
    forkJoin({
      profile: this.profileService.getDraft().pipe(catchError(() => of(null))),
      referrer: this.referralService.getMyReferrer()
    }).pipe(
      finalize(() => {
        // Always runs when Observable completes (success, error, or empty)
        this.hasLoadedProfile = true;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges(); // Force Angular to update the view
      })
    ).subscribe({
      next: ({ profile, referrer }) => {
        // Set referral status
        if (referrer.wasReferred) {
          this.hasAppliedReferral = true;
          this.referrerName = referrer.referrerName || '';
        }

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
        this.toastService.warning('Por favor completa los campos requeridos (SSN y fecha de nacimiento)');
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.addressStreet || !this.formData.addressCity ||
          !this.formData.addressState || !this.formData.addressZip) {
        this.toastService.warning('Por favor completa tu dirección');
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.bankName || !this.formData.bankRoutingNumber ||
          !this.formData.bankAccountNumber) {
        this.toastService.warning('Por favor completa tu información bancaria');
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.workState || !this.formData.employerName) {
        this.toastService.warning('Por favor completa tu información de empleo (estado de trabajo y empleador)');
        window.scrollTo(0, 0);
        return;
      }

      // Validate SSN format (9 digits with or without dashes)
      const ssnPattern = /^(\d{9}|\d{3}-\d{2}-\d{4})$/;
      if (!ssnPattern.test(this.formData.ssn)) {
        this.toastService.warning('El SSN debe tener 9 dígitos (ej: 123456789 o 123-45-6789)');
        window.scrollTo(0, 0);
        return;
      }

      // Validate routing number (exactly 9 digits)
      const routingPattern = /^\d{9}$/;
      if (!routingPattern.test(this.formData.bankRoutingNumber)) {
        this.toastService.warning('El número de ruta bancaria debe tener exactamente 9 dígitos');
        window.scrollTo(0, 0);
        return;
      }

      // Validate ZIP code format
      const zipPattern = /^\d{5}(-\d{4})?$/;
      if (!zipPattern.test(this.formData.addressZip)) {
        this.toastService.warning('El código postal debe tener 5 dígitos (ej: 12345 o 12345-6789)');
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
          this.toastService.success('Borrador guardado correctamente');
        } else {
          // Set flag to prevent redirect race condition in loadDraft()
          this.justSubmitted = true;
          // Clear local cache since form is now submitted to backend
          this.clearLocalDraft();
          // Invalidate dashboard cache so it fetches fresh profile data
          localStorage.removeItem('jai1_dashboard_cache');
          // Trigger dashboard refresh for when user navigates there
          this.dataRefreshService.refreshDashboard();
          // Show success screen with animation
          this.showSuccessScreen = true;
          window.scrollTo(0, 0);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.isSavingDraft = false;

        // Extract and display the specific error message
        const errorMsg = error.message || 'Error al guardar. Intenta nuevamente.';
        this.errorMessage = errorMsg;
        this.toastService.error(errorMsg);
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

  // Referral code methods
  validateReferralCode() {
    if (!this.referralCode || this.referralCode.length < 4) {
      this.referralCodeValid = null;
      this.referrerName = '';
      return;
    }

    this.referralCodeValidating = true;
    this.referralService.validateCode(this.referralCode).subscribe({
      next: (result) => {
        this.referralCodeValidating = false;
        this.referralCodeValid = result.valid;
        this.referrerName = result.referrerName || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.referralCodeValidating = false;
        this.referralCodeValid = false;
        this.referrerName = '';
        this.cdr.detectChanges();
      }
    });
  }

  applyReferralCode() {
    if (!this.referralCodeValid || this.referralCodeApplying) return;

    this.referralCodeApplying = true;
    this.referralService.applyCode(this.referralCode).subscribe({
      next: (result) => {
        this.referralCodeApplying = false;
        this.hasAppliedReferral = true;
        this.toastService.success(result.message);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.referralCodeApplying = false;
        this.toastService.error(error.message || 'Error al aplicar el código');
        this.cdr.detectChanges();
      }
    });
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

  // Called from template on any input change
  onFormChange() {
    this.autoSaveSubject.next();
  }

  // ============ LOCAL CACHE METHODS ============

  private loadLocalDraft(): void {
    const userId = this.authService.currentUser?.id;
    if (!userId) return;

    try {
      const cached = localStorage.getItem(TAX_FORM_CACHE_KEY);
      if (!cached) return;

      const cacheData = JSON.parse(cached);

      // Verify cache belongs to current user
      if (cacheData.userId !== userId) {
        localStorage.removeItem(TAX_FORM_CACHE_KEY);
        return;
      }

      // Check cache age (1 hour max)
      const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
      if (Date.now() - cacheData.cachedAt > CACHE_MAX_AGE_MS) {
        localStorage.removeItem(TAX_FORM_CACHE_KEY);
        return;
      }

      // Apply cached form data
      if (cacheData.formData) {
        this.formData = { ...this.formData, ...cacheData.formData };
      }
      console.log('Tax form: Loaded cached draft');
    } catch (e) {
      console.warn('Tax form: Failed to load cached draft', e);
    }
  }

  private cacheFormData(): void {
    // Don't cache if user just submitted or if showing completed screen
    if (this.justSubmitted || this.showAlreadyCompletedScreen || this.showSuccessScreen) {
      return;
    }

    const userId = this.authService.currentUser?.id;
    if (!userId) return;

    // Only cache if form has some data
    const hasData = Object.values(this.formData).some(v => v && v.trim() !== '');
    if (!hasData) return;

    try {
      const cacheData = {
        userId,
        formData: this.formData,
        cachedAt: Date.now()
      };
      localStorage.setItem(TAX_FORM_CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Tax form: Failed to cache draft', e);
    }
  }

  private clearLocalDraft(): void {
    localStorage.removeItem(TAX_FORM_CACHE_KEY);
  }
}
