import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { environment } from '../../environments/environment';

export const adminGuard: CanActivateFn = (route, state) => {
  if (environment.DESIGN_GOD_MODE) {
    return true;
  }

  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.isAuthenticated && authService.isAdmin) {
    return true;
  }

  router.navigate(['/admin-login']);
  return false;
};
