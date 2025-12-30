import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage = inject(StorageService);
  const authService = inject(AuthService);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.interceptor.ts:9',message:'interceptor entry',data:{url:req.url,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // Skip auth header for auth endpoints (except logout and refresh)
  const isAuthEndpoint = req.url.includes('/auth/') &&
    !req.url.includes('/auth/logout') &&
    !req.url.includes('/auth/refresh');

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.interceptor.ts:18',message:'auth endpoint check',data:{isAuthEndpoint,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (isAuthEndpoint) {
    return next(req);
  }

  const token = storage.getAccessToken();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.interceptor.ts:24',message:'token check',data:{hasToken:!!token,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.interceptor.ts:35',message:'interceptor error',data:{status:error.status,url:req.url,isRefreshing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const refreshToken = storage.getRefreshToken();

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.interceptor.ts:39',message:'refresh check',data:{status:error.status,hasRefreshToken:!!refreshToken,url:req.url,isRefreshing,isRefreshEndpoint:req.url.includes('/auth/refresh')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Only attempt refresh if we have a refresh token
      if (error.status === 401 && !isRefreshing && !req.url.includes('/auth/refresh') && refreshToken) {
        isRefreshing = true;

        return authService.refreshToken().pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = storage.getAccessToken();
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
