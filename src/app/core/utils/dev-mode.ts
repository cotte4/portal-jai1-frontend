import { environment } from '../../../environments/environment';

/**
 * Production hostnames where DESIGN_GOD_MODE must NEVER be enabled
 */
const PRODUCTION_HOSTNAMES = [
  'portal-jai1.com',
  'www.portal-jai1.com',
  'jai1taxes.com',
  'www.jai1taxes.com',
  'portal-jai1-frontend.vercel.app',
  'portal-jai1-frontend.netlify.app',
];

/**
 * Safely check if design/dev mode is enabled.
 * This function adds runtime protection to ensure DESIGN_GOD_MODE
 * can NEVER be accidentally enabled in production, even if the
 * wrong environment file is deployed.
 *
 * Returns true ONLY if ALL conditions are met:
 * 1. environment.production is false
 * 2. Current hostname is localhost or local IP
 * 3. DESIGN_GOD_MODE is explicitly true
 */
export function isDevModeEnabled(): boolean {
  // CRITICAL: Never enable in production build
  if (environment.production) {
    return false;
  }

  // CRITICAL: Never enable on production hostnames
  const hostname = window?.location?.hostname || '';
  if (PRODUCTION_HOSTNAMES.some(h => hostname.includes(h))) {
    console.warn('[SECURITY] DESIGN_GOD_MODE blocked on production hostname');
    return false;
  }

  // Only allow on localhost or local network
  const isLocalhost = hostname === 'localhost' ||
                      hostname === '127.0.0.1' ||
                      hostname.startsWith('192.168.') ||
                      hostname.startsWith('10.') ||
                      hostname === '';

  if (!isLocalhost) {
    console.warn('[SECURITY] DESIGN_GOD_MODE blocked on non-local hostname:', hostname);
    return false;
  }

  // Finally check the flag itself
  return environment.DESIGN_GOD_MODE === true;
}
