import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { isDevModeEnabled } from '../core/utils/dev-mode';

export const adminGuard: CanActivateFn = (route, state) => {
  // Dev mode with runtime safety checks (blocked in production)
  if (isDevModeEnabled()) {
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
