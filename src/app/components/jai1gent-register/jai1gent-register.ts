import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Jai1gentService } from '../../core/services/jai1gent.service';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-jai1gent-register',
  imports: [FormsModule, CommonModule],
  templateUrl: './jai1gent-register.html',
  styleUrl: './jai1gent-register.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Jai1gentRegister implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private jai1gentService = inject(Jai1gentService);
  private storage = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);

  // Form fields
  email = '';
  password = '';
  confirmPassword = '';
  firstName = '';
  lastName = '';
  phone = '';
  inviteCode = '';

  // UI state
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  isValidatingCode = false;
  errorMessage = '';
  inviteCodeValid: boolean | null = null;
  inviteCodeMessage = '';

  ngOnInit() {
    // Check for invite code in URL
    this.route.queryParams.subscribe((params) => {
      if (params['code']) {
        this.inviteCode = params['code'].toUpperCase();
        this.validateInviteCode();
      }
    });
  }

  async validateInviteCode() {
    if (!this.inviteCode || this.inviteCode.length !== 8) {
      this.inviteCodeValid = null;
      this.inviteCodeMessage = '';
      return;
    }

    this.isValidatingCode = true;
    this.cdr.detectChanges();

    this.jai1gentService.validateInviteCode(this.inviteCode).subscribe({
      next: (response) => {
        this.inviteCodeValid = response.valid;
        this.inviteCodeMessage = response.valid
          ? 'Codigo valido'
          : response.message || 'Codigo invalido';
        this.isValidatingCode = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.inviteCodeValid = false;
        this.inviteCodeMessage = 'Error al validar codigo';
        this.isValidatingCode = false;
        this.cdr.detectChanges();
      },
    });
  }

  onInviteCodeChange() {
    this.inviteCode = this.inviteCode.toUpperCase();
    if (this.inviteCode.length === 8) {
      this.validateInviteCode();
    } else {
      this.inviteCodeValid = null;
      this.inviteCodeMessage = '';
    }
  }

  onRegister() {
    this.errorMessage = '';

    // Validation
    if (!this.email || !this.password || !this.firstName || !this.lastName || !this.inviteCode) {
      this.errorMessage = 'Por favor completa todos los campos requeridos';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
      return;
    }

    if (this.inviteCodeValid !== true) {
      this.errorMessage = 'Por favor ingresa un codigo de invitacion valido';
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.jai1gentService
      .register({
        email: this.email,
        password: this.password,
        first_name: this.firstName,
        last_name: this.lastName,
        invite_code: this.inviteCode,
        phone: this.phone || undefined,
      })
      .subscribe({
        next: (response) => {
          // Store tokens
          this.storage.setRememberMe(true);
          this.storage.setAccessToken(response.access_token);
          this.storage.setRefreshToken(response.refresh_token);
          this.storage.setUser({
            id: response.user.id,
            email: response.user.email,
            firstName: response.user.first_name,
            lastName: response.user.last_name,
            role: response.user.role as any,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          this.isLoading = false;
          // Redirect to dashboard
          this.router.navigate(['/jai1gent/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          const message = error.error?.message || error.message || '';
          if (message.includes('Email already registered')) {
            this.errorMessage = 'Este email ya esta registrado';
          } else if (message.includes('Invalid invite code')) {
            this.errorMessage = 'Codigo de invitacion invalido';
          } else if (message.includes('already been used')) {
            this.errorMessage = 'Este codigo de invitacion ya fue usado';
          } else {
            this.errorMessage = message || 'Error al registrarse';
          }
          this.cdr.detectChanges();
        },
      });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    this.router.navigate(['/jai1gent/login']);
  }
}
