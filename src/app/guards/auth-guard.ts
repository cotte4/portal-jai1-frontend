import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = (route, state) => {
  if (environment.DESIGN_GOD_MODE) {
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
