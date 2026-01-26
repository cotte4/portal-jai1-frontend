import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-jai1gent-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './jai1gent-login.html',
  styleUrl: './jai1gent-login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Jai1gentLogin {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService
      .login({
        email: this.email,
        password: this.password,
        rememberMe: this.rememberMe,
      })
      .subscribe({
        next: (response) => {
          // Check if user is a JAI1GENT
          if (response.user.role !== UserRole.JAI1GENT) {
            this.authService.logout().subscribe();
            this.isLoading = false;
            this.errorMessage = 'Esta pagina es solo para JAI1GENTS. Si sos cliente, usa /login';
            this.cdr.detectChanges();
            return;
          }

          this.isLoading = false;
          this.router.navigate(['/jai1gent/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          const message = error.error?.message || error.message || '';
          if (message.includes('Invalid credentials') || message.includes('credentials')) {
            this.errorMessage = 'Email o contrasena incorrectos';
          } else if (message.includes('EMAIL_NOT_VERIFIED')) {
            this.errorMessage = 'Por favor verifica tu email primero';
          } else if (message.includes('deactivated')) {
            this.errorMessage = 'Tu cuenta ha sido desactivada';
          } else {
            this.errorMessage = message || 'Error al iniciar sesion';
          }
          this.cdr.detectChanges();
        },
      });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goToRegister() {
    this.router.navigate(['/jai1gent/register']);
  }

  goToClientLogin() {
    this.router.navigate(['/login']);
  }
}
