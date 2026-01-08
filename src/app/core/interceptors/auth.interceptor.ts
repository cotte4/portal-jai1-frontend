import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, of, EMPTY } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage = inject(StorageService);
  const authService = inject(AuthService);

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

      console.log('[AuthInterceptor] Error caught:', {
        status: error.status,
        url: req.url,
        hasRefreshToken: !!refreshToken,
        isRefreshing
      });

      // Only attempt refresh if we have a refresh token and not already refreshing
      if (error.status === 401 && !isRefreshing && !req.url.includes('/auth/refresh') && refreshToken) {
        isRefreshing = true;
        console.log('[AuthInterceptor] Attempting token refresh...');

        return authService.refreshToken().pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = storage.getAccessToken();

            // If no new token after refresh, don't retry - session is invalid
            if (!newToken) {
              console.log('[AuthInterceptor] No new token after refresh, session invalid');
              return throwError(() => error);
            }

            console.log('[AuthInterceptor] Token refreshed successfully, retrying request');
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            console.log('[AuthInterceptor] Token refresh failed:', refreshError);
            // AuthService.refreshToken already calls clearSession on error
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
