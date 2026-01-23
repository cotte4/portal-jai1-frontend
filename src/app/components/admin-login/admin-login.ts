import { Component, inject, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { AnimationService } from '../../core/services/animation.service';
import { UserRole } from '../../core/models';
import { HoverScaleDirective } from '../../shared/directives';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, CommonModule, HoverScaleDirective],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  @ViewChild('loginCard') loginCard!: ElementRef<HTMLElement>;

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

  ngAfterViewInit() {
    this.initAnimations();
  }

  ngOnDestroy() {
    this.animationService.killAnimations();
  }

  private initAnimations() {
    // Animate login card
    if (this.loginCard?.nativeElement) {
      this.animationService.scaleIn(this.loginCard.nativeElement, {
        duration: 0.5,
        fromScale: 0.95
      });
    }
  }

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      this.shakeError();
      return;
    }

    this.isLoading = true;

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;

        // Check if user is admin
        if (response.user.role === UserRole.ADMIN) {
          this.router.navigate(['/admin/dashboard']);
        } else {
          // Not an admin, clear session and show error
          this.authService.logout().subscribe();
          this.errorMessage = 'Acceso denegado. Solo administradores.';
          this.shakeError();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Credenciales de administrador invalidas';
        this.shakeError();
      }
    });
  }

  private shakeError() {
    setTimeout(() => {
      const errorEl = this.elementRef.nativeElement.querySelector('.error-message');
      if (errorEl) {
        this.animationService.validationShake(errorEl);
      }
    });
  }

  goToUserLogin() {
    this.router.navigate(['/login']);
  }
}
