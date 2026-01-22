import { test as base, Page } from '@playwright/test';

/**
 * Test credentials
 * These should match users in your test database
 */
export const TEST_USERS = {
  client: {
    email: 'e2e-client@test.com',
    password: 'TestPassword123!',
    firstName: 'E2E',
    lastName: 'Client',
  },
  admin: {
    email: 'e2e-admin@test.com',
    password: 'AdminPassword123!',
    firstName: 'E2E',
    lastName: 'Admin',
  },
};

/**
 * Auth Fixture - Provides authenticated page instances
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../fixtures/auth.fixture';
 *
 * test('as logged in user', async ({ authenticatedPage }) => {
 *   // Already logged in!
 *   await authenticatedPage.goto('/dashboard');
 * });
 * ```
 */

// Helper to login via UI
async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');

  // Fill login form
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password|contraseña/i).fill(password);

  // Click login button
  await page.getByRole('button', { name: /iniciar sesión|login|entrar/i }).click();

  // Wait for navigation to dashboard or redirect
  await page.waitForURL(/\/(dashboard|onboarding|admin)/, { timeout: 15000 });
}

// Helper to login via API (faster)
async function loginViaAPI(page: Page, email: string, password: string): Promise<void> {
  // Get API URL from environment or default
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  // Make API login request
  const response = await page.request.post(`${apiUrl}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const { access_token, refresh_token, user } = await response.json();

  // Store tokens in localStorage (simulating what the app does)
  await page.goto('/login'); // Need to be on the domain first
  await page.evaluate(
    ({ accessToken, refreshToken, userData }) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
    },
    { accessToken: access_token, refreshToken: refresh_token, userData: user },
  );
}

// Helper to register a new user
async function registerUser(
  page: Page,
  userData: { email: string; password: string; firstName: string; lastName: string },
): Promise<void> {
  await page.goto('/register');

  // Fill registration form
  await page.getByLabel(/nombre/i).first().fill(userData.firstName);
  await page.getByLabel(/apellido/i).fill(userData.lastName);
  await page.getByLabel(/email|correo/i).fill(userData.email);
  await page.getByLabel(/contraseña|password/i).first().fill(userData.password);

  // Find and fill confirm password if exists
  const confirmPassword = page.getByLabel(/confirmar|confirm/i);
  if (await confirmPassword.isVisible()) {
    await confirmPassword.fill(userData.password);
  }

  // Accept terms if checkbox exists
  const termsCheckbox = page.getByRole('checkbox');
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.check();
  }

  // Click register button
  await page.getByRole('button', { name: /registrar|crear cuenta|sign up/i }).click();

  // Wait for navigation
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
}

// Extended test with auth fixtures
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
  loginAsClient: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
  registerNewUser: (userData: typeof TEST_USERS.client) => Promise<void>;
}>({
  // Authenticated page (client user)
  authenticatedPage: async ({ page }, use) => {
    try {
      await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    } catch {
      // Fallback to UI login if API fails
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    }
    await use(page);
  },

  // Admin page
  adminPage: async ({ page }, use) => {
    try {
      await loginViaAPI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
    } catch {
      // Fallback to UI login
      await page.goto('/admin-login');
      await page.getByLabel(/email/i).fill(TEST_USERS.admin.email);
      await page.getByLabel(/password|contraseña/i).fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /iniciar sesión|login|entrar/i }).click();
      await page.waitForURL(/\/admin/, { timeout: 15000 });
    }
    await use(page);
  },

  // Login helper function
  loginAsClient: async ({ page }, use) => {
    const login = async () => {
      await loginViaUI(page, TEST_USERS.client.email, TEST_USERS.client.password);
    };
    await use(login);
  },

  // Admin login helper function
  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/admin-login');
      await page.getByLabel(/email/i).fill(TEST_USERS.admin.email);
      await page.getByLabel(/password|contraseña/i).fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /iniciar sesión|login|entrar/i }).click();
      await page.waitForURL(/\/admin/, { timeout: 15000 });
    };
    await use(login);
  },

  // Register helper function
  registerNewUser: async ({ page }, use) => {
    const register = async (userData: typeof TEST_USERS.client) => {
      await registerUser(page, userData);
    };
    await use(register);
  },
});

export { expect } from '@playwright/test';
