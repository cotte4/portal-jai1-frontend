import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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

// US States list (alphabetically sorted)
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Bank options
const BANK_OPTIONS = [
  'Alpine Bank',
  'Bank of America',
  'Bank of Hawaii',
  'BMO',
  'Chase Bank',
  'First Bank',
  'Regions Bank',
  'TD Bank',
  'US Bank',
  'Wells Fargo',
  'Otro'
];

// Country codes for phone number selector
interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+54', name: 'Argentina', flag: 'AR' },
  { code: '+598', name: 'Uruguay', flag: 'UY' },
  { code: '+591', name: 'Bolivia', flag: 'BO' },
  { code: '+56', name: 'Chile', flag: 'CL' },
  { code: '+55', name: 'Brasil', flag: 'BR' },
  { code: '+595', name: 'Paraguay', flag: 'PY' },
  { code: '+51', name: 'Peru', flag: 'PE' },
  { code: '+57', name: 'Colombia', flag: 'CO' },
  { code: '+593', name: 'Ecuador', flag: 'EC' },
  { code: '+58', name: 'Venezuela', flag: 'VE' },
  { code: '+52', name: 'Mexico', flag: 'MX' },
  { code: '+1', name: 'Estados Unidos', flag: 'US' },
];

@Component({
  selector: 'app-tax-form',
  imports: [FormsModule, CommonModule],
  templateUrl: './tax-form.html',
  styleUrl: './tax-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush
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

    // Payment Method: 'bank_deposit' (default) or 'check'
    paymentMethod: 'bank_deposit' as 'bank_deposit' | 'check',

    // TurboTax (optional)
    turbotaxEmail: '',
    turbotaxPassword: '',

    // Phone (required)
    phoneCountryCode: '+54',
    phoneNumber: ''
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

  // Dropdown state for workState
  usStates = US_STATES;
  filteredStates = US_STATES;
  stateSearchQuery: string = '';
  showStateDropdown: boolean = false;

  // Dropdown state for bankName
  bankOptions = BANK_OPTIONS;
  filteredBanks = BANK_OPTIONS;
  bankSearchQuery: string = '';
  showBankDropdown: boolean = false;
  customBankName: string = ''; // For "Otro" option

  // Country codes for phone
  countryCodes = COUNTRY_CODES;

  // Phone validation error
  phoneError: string = '';

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
              paymentMethod: (profile as any).paymentMethod || 'bank_deposit',
              turbotaxEmail: profile.turbotaxEmail || '',
              turbotaxPassword: profile.turbotaxPassword || '',
              phoneCountryCode: (profile as any).phoneCountryCode || '+54',
              phoneNumber: (profile as any).phoneNumber || ''
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
    this.phoneError = '';

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

      // Bank info is required only if payment method is bank_deposit (not check)
      if (this.formData.paymentMethod !== 'check') {
        if (!this.formData.bankName || !this.formData.bankRoutingNumber ||
            !this.formData.bankAccountNumber) {
          this.toastService.warning('Por favor completa tu información bancaria');
          window.scrollTo(0, 0);
          return;
        }

        // Validate custom bank name if "Otro" is selected
        if (this.formData.bankName === 'Otro' && !this.customBankName.trim()) {
          this.toastService.warning('Por favor ingresa el nombre del banco');
          window.scrollTo(0, 0);
          return;
        }
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

      // Validate routing number (exactly 9 digits) - only if bank deposit
      if (this.formData.paymentMethod !== 'check' && this.formData.bankRoutingNumber) {
        const routingPattern = /^\d{9}$/;
        if (!routingPattern.test(this.formData.bankRoutingNumber)) {
          this.toastService.warning('El número de ruta bancaria debe tener exactamente 9 dígitos');
          window.scrollTo(0, 0);
          return;
        }
      }

      // Validate ZIP code format
      const zipPattern = /^\d{5}(-\d{4})?$/;
      if (!zipPattern.test(this.formData.addressZip)) {
        this.toastService.warning('El codigo postal debe tener 5 digitos (ej: 12345 o 12345-6789)');
        window.scrollTo(0, 0);
        return;
      }

      // Validate phone number
      if (!this.formData.phoneCountryCode || !this.formData.phoneNumber) {
        this.phoneError = 'El numero de celular es requerido';
        this.toastService.warning('Por favor ingresa tu numero de celular');
        window.scrollTo(0, 0);
        return;
      }

      // Validate phone number format (8-15 digits, numbers only)
      const phoneDigitsOnly = this.formData.phoneNumber.replace(/\D/g, '');
      if (phoneDigitsOnly.length < 8 || phoneDigitsOnly.length > 15) {
        this.phoneError = 'El numero debe tener entre 8 y 15 digitos';
        this.toastService.warning('El numero de celular debe tener entre 8 y 15 digitos');
        window.scrollTo(0, 0);
        return;
      }
    }

    if (isDraft) {
      this.isSavingDraft = true;
    } else {
      this.isLoading = true;
    }
    this.cdr.detectChanges(); // Show loading state immediately

    // Build full phone number in E.164 format (e.g., +54911XXXXXXXX)
    const phoneDigitsOnly = this.formData.phoneNumber.replace(/\D/g, '');
    const fullPhoneNumber = phoneDigitsOnly ? this.formData.phoneCountryCode + phoneDigitsOnly : undefined;

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
        name: this.formData.bankName === 'Otro' ? this.customBankName.trim() : this.formData.bankName,
        routingNumber: this.formData.bankRoutingNumber,
        accountNumber: this.formData.bankAccountNumber
      },
      workState: this.formData.workState,
      employerName: this.formData.employerName,
      turbotaxEmail: this.formData.turbotaxEmail || undefined,
      turbotaxPassword: this.formData.turbotaxPassword || undefined,
      phone: fullPhoneNumber,
      isDraft: isDraft,
      paymentMethod: this.formData.paymentMethod
    };

    this.profileService.completeProfile(request).subscribe({
      next: () => {
        this.isLoading = false;
        this.isSavingDraft = false;

        if (isDraft) {
          this.toastService.success('Borrador guardado correctamente');
          this.cdr.detectChanges(); // Update button state after draft save
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
          this.cdr.detectChanges(); // Force Angular to update the view immediately
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
        this.cdr.detectChanges(); // Update button state after error
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
    // Check phone is valid (8-15 digits)
    const phoneDigitsOnly = this.formData.phoneNumber.replace(/\D/g, '');
    const phoneValid = this.formData.phoneCountryCode &&
      phoneDigitsOnly.length >= 8 &&
      phoneDigitsOnly.length <= 15;

    // Basic required fields including phone
    const basicFieldsComplete = !!(
      this.formData.ssn &&
      this.formData.dateOfBirth &&
      this.formData.addressStreet &&
      this.formData.addressCity &&
      this.formData.addressState &&
      this.formData.addressZip &&
      this.formData.workState &&
      this.formData.employerName &&
      phoneValid
    );

    // If payment method is check, bank info is not required
    if (this.formData.paymentMethod === 'check') {
      return basicFieldsComplete;
    }

    // For bank deposit, check if bank name is valid (either a predefined bank or "Otro" with custom name)
    const bankNameValid = this.formData.bankName &&
      (this.formData.bankName !== 'Otro' || this.customBankName.trim());

    return basicFieldsComplete &&
      !!(bankNameValid &&
      this.formData.bankRoutingNumber &&
      this.formData.bankAccountNumber);
  }

  // ============ DROPDOWN METHODS ============

  // State dropdown methods
  filterStates(): void {
    const query = this.stateSearchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredStates = this.usStates;
    } else {
      this.filteredStates = this.usStates.filter(state =>
        state.toLowerCase().includes(query)
      );
    }
  }

  selectState(state: string): void {
    this.formData.workState = state;
    this.stateSearchQuery = '';
    this.filteredStates = this.usStates;
    this.showStateDropdown = false;
    this.onFormChange();
    this.cdr.detectChanges();
  }

  openStateDropdown(): void {
    this.showStateDropdown = true;
    this.filteredStates = this.usStates;
    this.cdr.detectChanges();
  }

  closeStateDropdown(): void {
    // Small delay to allow click events to register
    setTimeout(() => {
      this.showStateDropdown = false;
      this.stateSearchQuery = '';
      this.filteredStates = this.usStates;
      this.cdr.detectChanges();
    }, 150);
  }

  // Bank dropdown methods
  filterBanks(): void {
    const query = this.bankSearchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredBanks = this.bankOptions;
    } else {
      this.filteredBanks = this.bankOptions.filter(bank =>
        bank.toLowerCase().includes(query)
      );
    }
  }

  selectBank(bank: string): void {
    this.formData.bankName = bank;
    this.bankSearchQuery = '';
    this.filteredBanks = this.bankOptions;
    this.showBankDropdown = false;
    // Clear custom bank name if not selecting "Otro"
    if (bank !== 'Otro') {
      this.customBankName = '';
    }
    this.onFormChange();
    this.cdr.detectChanges();
  }

  openBankDropdown(): void {
    this.showBankDropdown = true;
    this.filteredBanks = this.bankOptions;
    this.cdr.detectChanges();
  }

  closeBankDropdown(): void {
    // Small delay to allow click events to register
    setTimeout(() => {
      this.showBankDropdown = false;
      this.bankSearchQuery = '';
      this.filteredBanks = this.bankOptions;
      this.cdr.detectChanges();
    }, 150);
  }

  onCustomBankChange(): void {
    // When custom bank name changes, update the actual bank name
    // The formData.bankName stays as "Otro" to indicate custom entry
    this.onFormChange();
  }

  // Get the actual bank name for display (handles "Otro" case)
  getDisplayBankName(): string {
    if (this.formData.bankName === 'Otro' && this.customBankName) {
      return this.customBankName;
    }
    return this.formData.bankName;
  }

  // Called from template on any input change
  onFormChange() {
    this.autoSaveSubject.next();
  }

  // ============ PHONE METHODS ============

  // Filter phone number to only allow digits
  onPhoneNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Remove any non-digit characters
    const digitsOnly = input.value.replace(/\D/g, '');
    this.formData.phoneNumber = digitsOnly;
    input.value = digitsOnly;

    // Clear error when user starts typing
    if (this.phoneError) {
      this.phoneError = '';
      this.cdr.detectChanges();
    }

    this.onFormChange();
  }

  // Get flag emoji from country code
  getCountryFlag(countryCode: string): string {
    const country = this.countryCodes.find(c => c.code === countryCode);
    if (!country) return '';

    // Convert country code to flag emoji
    const flagMap: { [key: string]: string } = {
      'AR': '\u{1F1E6}\u{1F1F7}',
      'UY': '\u{1F1FA}\u{1F1FE}',
      'BO': '\u{1F1E7}\u{1F1F4}',
      'CL': '\u{1F1E8}\u{1F1F1}',
      'BR': '\u{1F1E7}\u{1F1F7}',
      'PY': '\u{1F1F5}\u{1F1FE}',
      'PE': '\u{1F1F5}\u{1F1EA}',
      'CO': '\u{1F1E8}\u{1F1F4}',
      'EC': '\u{1F1EA}\u{1F1E8}',
      'VE': '\u{1F1FB}\u{1F1EA}',
      'MX': '\u{1F1F2}\u{1F1FD}',
      'US': '\u{1F1FA}\u{1F1F8}'
    };

    return flagMap[country.flag] || '';
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
