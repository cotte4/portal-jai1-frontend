import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';
import { CompleteProfileRequest } from '../../core/models';

@Component({
  selector: 'app-tax-form',
  imports: [FormsModule, CommonModule],
  templateUrl: './tax-form.html',
  styleUrl: './tax-form.css'
})
export class TaxForm implements OnInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);

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

  ngOnInit() {
    this.loadDraft();
  }

  loadDraft() {
    this.profileService.getDraft().subscribe({
      next: (profile) => {
        if (profile) {
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
      },
      error: () => {
        // No draft exists, continue with empty form
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
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.addressStreet || !this.formData.addressCity ||
          !this.formData.addressState || !this.formData.addressZip) {
        this.errorMessage = 'Por favor completa tu direccion';
        window.scrollTo(0, 0);
        return;
      }

      if (!this.formData.bankName || !this.formData.bankRoutingNumber ||
          !this.formData.bankAccountNumber) {
        this.errorMessage = 'Por favor completa tu informacion bancaria';
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
        } else {
          this.successMessage = 'Formulario enviado correctamente!';
          setTimeout(() => {
            this.router.navigate(['/documents']);
          }, 2000);
        }
        window.scrollTo(0, 0);
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
