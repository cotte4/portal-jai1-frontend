import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, Subject, filter, take } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';

// Shared state for handling concurrent 401s
let isRefreshing = false;
let refreshTokenSubject = new Subject<string | null>();

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

      // Only handle 401 errors with refresh token available
      if (error.status !== 401 || !refreshToken || req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Another request is already refreshing - wait for it to complete
        return waitForRefreshAndRetry(req, next, refreshTokenSubject);
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
            return throwError(() => error);
          }

          return retryWithNewToken(req, next, newToken);
        }),
        catchError(refreshError => {
          isRefreshing = false;
          // Notify waiting requests that refresh failed
          refreshTokenSubject.next(null);
          refreshTokenSubject.complete();
          return throwError(() => refreshError);
        })
      );
    })
  );
};

/**
 * Wait for an ongoing refresh to complete, then retry the request
 */
function waitForRefreshAndRetry(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenSubject: Subject<string | null>
): Observable<any> {
  return tokenSubject.pipe(
    filter(token => token !== undefined), // Wait for actual value (not initial)
    take(1),
    switchMap(token => {
      if (!token) {
        // Refresh failed, propagate error
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));
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
