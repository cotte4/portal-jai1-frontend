import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

// DESIGN MODE - Set to true to bypass auth during development
const DESIGN_MODE = false;

export const authGuard: CanActivateFn = (route, state) => {
  if (DESIGN_MODE) {
    return true;
  }

  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.isAuthenticated) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
