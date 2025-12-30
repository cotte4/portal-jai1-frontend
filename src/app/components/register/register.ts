import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  // Form data
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  agreeToTerms: boolean = false;

  errorMessage: string = '';
  successMessage: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    // Validation
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Por favor ingresa un email valido';
      return;
    }

    // Password length validation (backend requires 8 characters)
    if (this.password.length < 8) {
      this.errorMessage = 'La contrasena debe tener al menos 8 caracteres';
      return;
    }

    // Password match validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contrasenas no coinciden';
      return;
    }

    // Terms agreement validation
    if (!this.agreeToTerms) {
      this.errorMessage = 'Debes aceptar los terminos y condiciones';
      return;
    }

    this.isLoading = true;
    console.log('Starting registration...');

    this.authService.register({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || undefined
    }).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.isLoading = false;
        this.successMessage = 'Registro exitoso! Redirigiendo...';
        this.cdr.detectChanges();

        // Redirect to tax form (F2) after registration
        setTimeout(() => {
          this.router.navigate(['/tax-form']);
        }, 1500);
      },
      error: (error) => {
        console.log('Registration error:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Error al registrar. Intenta nuevamente.';
        this.cdr.detectChanges();
      },
      complete: () => {
        console.log('Registration observable completed');
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
