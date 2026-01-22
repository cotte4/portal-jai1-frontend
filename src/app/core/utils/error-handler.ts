/**
 * Shared error handler utility for consistent error messages across admin components.
 * Provides user-friendly error messages in Spanish based on HTTP status codes.
 */

export function getErrorMessage(error: any, defaultMessage: string): string {
  if (error?.status === 401 || error?.status === 403) {
    return 'Sesion expirada. Por favor, vuelve a iniciar sesion.';
  }
  if (error?.status === 500) {
    return 'Error del servidor. Por favor, intenta de nuevo mas tarde.';
  }
  if (error?.status === 0 || !error?.status) {
    return 'Error de conexion. Verifica tu conexion a internet.';
  }
  return error?.error?.message || error?.message || defaultMessage;
}

/**
 * Get an error code string for display/logging purposes.
 * Returns a formatted error code like "HTTP 500" or "NETWORK_ERROR".
 */
export function getErrorCode(error: any): string {
  return error?.status ? `HTTP ${error.status}` : 'NETWORK_ERROR';
}
