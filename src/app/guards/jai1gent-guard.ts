import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

export const jai1gentGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.isAuthenticated && authService.isJai1gent) {
    return true;
  }

  router.navigate(['/jai1gent/login']);
  return false;
};
