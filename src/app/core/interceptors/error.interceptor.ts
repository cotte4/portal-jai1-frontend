import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.interceptor.ts:4',message:'error interceptor entry',data:{url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.interceptor.ts:7',message:'error caught',data:{status:error.status,statusText:error.statusText,url:req.url,errorMessage:error.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      let errorMessage = 'An unexpected error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = error.error.message;
      } else {
        // Server-side error - handle array messages from validation
        const serverMessage = error.error?.message;
        const extractedMessage = Array.isArray(serverMessage)
          ? serverMessage[0]
          : serverMessage;

        switch (error.status) {
          case 400:
            errorMessage = extractedMessage || 'Invalid request';
            break;
          case 401:
            errorMessage = 'Session expired. Please login again.';
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action';
            break;
          case 404:
            errorMessage = 'Resource not found';
            break;
          case 409:
            errorMessage = extractedMessage || 'Conflict with existing data';
            break;
          case 422:
            errorMessage = extractedMessage || 'Validation error';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = extractedMessage || `Error: ${error.status}`;
        }
      }

      console.error('HTTP Error:', {
        status: error.status,
        message: errorMessage,
        url: req.url
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6b02fdf2-6716-4583-adad-6e3d5a507e4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.interceptor.ts:46',message:'error interceptor final',data:{status:error.status,errorMessage,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      return throwError(() => ({
        status: error.status,
        message: errorMessage,
        originalError: error
      }));
    })
  );
};
