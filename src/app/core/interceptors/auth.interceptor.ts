import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, Observable, Subject, filter, take, EMPTY } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';

// Shared state for handling concurrent 401s
let isRefreshing = false;
let refreshTokenSubject = new Subject<string | null>();

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage = inject(StorageService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Skip auth header for auth endpoints (except logout and refresh)
  const isAuthEndpoint = req.url.includes('/auth/') &&
    !req.url.includes('/auth/logout') &&
    !req.url.includes('/auth/refresh');

  if (isAuthEndpoint) {
    return next(req);
  }

  const token = storage.getAccessToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const refreshToken = storage.getRefreshToken();

      // Only handle 401 errors with refresh token available
      // If no refresh token or the refresh request itself failed, force logout
      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (!refreshToken || req.url.includes('/auth/refresh')) {
        return forceLogout(authService, router, error);
      }

      if (isRefreshing) {
        // Another request is already refreshing - wait for it to complete
        return waitForRefreshAndRetry(req, next, refreshTokenSubject, authService, router);
      }

      // Start the refresh process
      isRefreshing = true;
      refreshTokenSubject = new Subject<string | null>(); // Reset subject for new refresh cycle

      return authService.refreshToken().pipe(
        switchMap(() => {
          isRefreshing = false;
          const newToken = storage.getAccessToken();

          // Notify all waiting requests
          refreshTokenSubject.next(newToken);
          refreshTokenSubject.complete();

          if (!newToken) {
            return forceLogout(authService, router, error);
          }

          return retryWithNewToken(req, next, newToken);
        }),
        catchError(refreshError => {
          isRefreshing = false;
          // Notify waiting requests that refresh failed
          refreshTokenSubject.next(null);
          refreshTokenSubject.complete();
          // AuthService.refreshToken() already calls clearSession(),
          // but ensure redirect happens even if that path didn't navigate
          return forceLogout(authService, router, refreshError);
        })
      );
    })
  );
};

/**
 * Clear auth state and redirect to /login.
 * Returns EMPTY so the observable completes silently (the page is navigating away).
 * Avoids redirect loops by checking the current URL.
 */
function forceLogout(
  authService: AuthService,
  router: Router,
  _error: HttpErrorResponse | Error
): Observable<never> {
  // AuthService.forceLogout clears tokens + user subject
  authService.forceLogout();

  // Only navigate if not already on /login to prevent redirect loops
  const currentUrl = router.url;
  if (!currentUrl.startsWith('/login')) {
    router.navigate(['/login']);
  }

  return EMPTY;
}

/**
 * Wait for an ongoing refresh to complete, then retry the request
 */
function waitForRefreshAndRetry(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenSubject: Subject<string | null>,
  authService: AuthService,
  router: Router
): Observable<any> {
  return tokenSubject.pipe(
    filter(token => token !== undefined), // Wait for actual value (not initial)
    take(1),
    switchMap(token => {
      if (!token) {
        // Refresh failed - force logout and redirect
        return forceLogout(authService, router, new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
      }
      return retryWithNewToken(req, next, token);
    })
  );
}

/**
 * Clone request with new token and retry
 */
function retryWithNewToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string
): Observable<any> {
  const retryReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
  return next(retryReq);
}
