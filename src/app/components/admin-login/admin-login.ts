import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin {
  private router = inject(Router);
  private authService = inject(AuthService);

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor() {
    // If already logged in as admin, redirect
    if (this.authService.isAuthenticated && this.authService.isAdmin) {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;

        // Clear caches to ensure fresh data on login
        localStorage.removeItem('jai1_dashboard_cache');
        localStorage.removeItem('jai1_cached_profile');

        // Check if user is admin
        if (response.user.role === UserRole.ADMIN) {
          this.router.navigate(['/admin/dashboard']);
        } else {
          // Not an admin, clear session and show error
          this.authService.logout().subscribe({
            next: () => {
              this.errorMessage = 'Acceso denegado. Solo administradores.';
            },
            error: () => {
              this.errorMessage = 'Acceso denegado. Solo administradores.';
            }
          });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Credenciales de administrador invalidas';
      }
    });
  }

  goToUserLogin() {
    this.router.navigate(['/login']);
  }
}
