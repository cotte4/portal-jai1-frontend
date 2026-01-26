import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { Jai1gentService } from '../../core/services/jai1gent.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-jai1gent-profile',
  imports: [FormsModule, CommonModule],
  templateUrl: './jai1gent-profile.html',
  styleUrl: './jai1gent-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Jai1gentProfile implements OnInit {
  private router = inject(Router);
  private jai1gentService = inject(Jai1gentService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  // Form fields
  paymentMethod: 'bank_transfer' | 'zelle' | null = null;
  bankName = '';
  bankRoutingNumber = '';
  bankAccountNumber = '';
  zelleEmail = '';
  zellePhone = '';

  // UI state
  isLoading = true;
  isSaving = false;
  hasLoaded = false;

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading = true;

    this.jai1gentService.getDashboard()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.paymentMethod = data.payment_info.payment_method;
          // Note: actual bank/zelle fields not returned for security
          // User must re-enter when updating
        },
        error: () => {
          this.toast.error('Error al cargar el perfil');
        },
      });
  }

  onPaymentMethodChange() {
    // Clear fields when switching payment method
    if (this.paymentMethod === 'bank_transfer') {
      this.zelleEmail = '';
      this.zellePhone = '';
    } else if (this.paymentMethod === 'zelle') {
      this.bankName = '';
      this.bankRoutingNumber = '';
      this.bankAccountNumber = '';
    }
  }

  isFormValid(): boolean {
    if (!this.paymentMethod) return false;

    if (this.paymentMethod === 'bank_transfer') {
      return !!(this.bankName && this.bankRoutingNumber && this.bankAccountNumber);
    } else if (this.paymentMethod === 'zelle') {
      return !!(this.zelleEmail || this.zellePhone);
    }

    return false;
  }

  onSave() {
    if (!this.isFormValid()) {
      this.toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    const data: any = {
      payment_method: this.paymentMethod,
    };

    if (this.paymentMethod === 'bank_transfer') {
      data.bank_name = this.bankName;
      data.bank_routing_number = this.bankRoutingNumber;
      data.bank_account_number = this.bankAccountNumber;
    } else if (this.paymentMethod === 'zelle') {
      if (this.zelleEmail) data.zelle_email = this.zelleEmail;
      if (this.zellePhone) data.zelle_phone = this.zellePhone;
    }

    this.jai1gentService.updateProfile(data)
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.toast.success('Informacion de pago actualizada');
          this.router.navigate(['/jai1gent/dashboard']);
        },
        error: (error) => {
          const message = error.error?.message || 'Error al guardar';
          this.toast.error(message);
        },
      });
  }

  goBack() {
    this.router.navigate(['/jai1gent/dashboard']);
  }
}
