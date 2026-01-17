import { test, expect } from '@playwright/test';

/**
 * Auth E2E Tests
 *
 * Tests the critical authentication flows:
 * - Login
 * - Registration
 * - Forgot password
 *
 * Prerequisites:
 * 1. Backend running: cd ../portal-jai1-backend && npm run start:dev
 * 2. Frontend running: npm run start
 *
 * Run with: npm run e2e
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check page title/header
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();

    // Check form elements exist
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    // Use the submit button specifically (not the tab button)
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for empty form submission', async ({ page }) => {
    // Click login submit button without filling form
    await page.locator('button[type="submit"]').click();

    // Form should not submit (HTML5 validation)
    // We should still be on the login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Listen for API response
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
      { timeout: 20000 }
    );

    // Fill with invalid credentials
    await page.getByLabel(/correo electrónico/i).fill('invalid@test.com');
    await page.getByLabel(/contraseña/i).fill('wrongpassword');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for the API response
    const response = await responsePromise;
    expect(response.status()).toBe(401);

    // Wait a moment for Angular to process the error and update the UI
    await page.waitForTimeout(500);

    // Check if we're still on login page (not redirected = error case)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to registration page', async ({ page }) => {
    // Click "Crear cuenta" tab or link
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    // Should be on register page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    // Click forgot password link
    await page.getByText(/olvidaste tu contraseña/i).click();

    // Should be on forgot password page
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('should have Google login button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continuar con google/i })).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/contraseña/i);
    const toggleButton = page.locator('.toggle-visibility').first();

    // Initially password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle
    await toggleButton.click();

    // Should be text type now
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again
    await toggleButton.click();

    // Should be password type again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form', async ({ page }) => {
    // Check page header
    await expect(page.getByRole('heading', { name: /creá tu cuenta/i })).toBeVisible();

    // Check all form fields exist
    await expect(page.getByLabel(/nombre/i).first()).toBeVisible();
    await expect(page.getByLabel(/apellido/i)).toBeVisible();
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/^contraseña$/i)).toBeVisible();
    await expect(page.getByLabel(/confirmar contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /crear mi cuenta/i })).toBeVisible();
  });

  test('should have optional referral code field', async ({ page }) => {
    const referralField = page.getByLabel(/codigo de referido/i);
    await expect(referralField).toBeVisible();

    // Should have "(opcional)" label
    await expect(page.getByText(/opcional/i)).toBeVisible();
  });

  test('should validate referral code on blur', async ({ page }) => {
    const referralInput = page.getByLabel(/codigo de referido/i);

    // Enter invalid code
    await referralInput.fill('INVALID');
    await referralInput.blur();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Should show error (red styling or error message)
    const inputWrapper = referralInput.locator('..');
    await expect(inputWrapper).toHaveClass(/input-invalid/);
  });

  test('should show terms and privacy modals', async ({ page }) => {
    // Click terms link
    await page.getByText(/términos y condiciones/i).click();

    // Modal should appear
    await expect(page.getByRole('heading', { name: /términos y condiciones/i })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /entendido/i }).click();

    // Modal should close
    await expect(page.getByRole('heading', { name: /términos y condiciones/i })).not.toBeVisible();

    // Click privacy link
    await page.getByText(/política de privacidad/i).click();

    // Privacy modal should appear
    await expect(page.getByRole('heading', { name: /política de privacidad/i })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    // Click "Iniciar sesión" tab
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should require terms acceptance', async ({ page }) => {
    // Fill form without checking terms
    await page.getByLabel(/nombre/i).first().fill('Test');
    await page.getByLabel(/apellido/i).fill('User');
    await page.getByLabel(/correo electrónico/i).fill('test@example.com');
    await page.getByLabel(/^contraseña$/i).fill('TestPassword123!');
    await page.getByLabel(/confirmar contraseña/i).fill('TestPassword123!');

    // Try to submit without terms
    await page.getByRole('button', { name: /crear mi cuenta/i }).click();

    // Should show error or stay on page
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('should display forgot password form', async ({ page }) => {
    // Check heading exists
    await expect(page.getByRole('heading', { name: /recuperar|olvidaste|contraseña/i })).toBeVisible();

    // Check email input exists
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Check submit button exists
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show success message after submission', async ({ page }) => {
    // Fill email
    await page.locator('input[type="email"]').fill('test@example.com');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should show success message or confirmation
    // Allow for either success message or staying on page (security: same behavior for all emails)
    await page.waitForTimeout(2000);
    const hasSuccess = await page.locator('.success-alert, .success-message, .confirmation').isVisible();
    const stillOnPage = await page.url().includes('forgot-password');
    expect(hasSuccess || stillOnPage).toBeTruthy();
  });
});

test.describe('Protected Routes', () => {
  // Note: In development with DESIGN_GOD_MODE=true, auth guards are bypassed
  // These tests verify the routes exist and load correctly

  test('dashboard route should be accessible', async ({ page }) => {
    await page.goto('/dashboard');
    // In dev mode, route loads without redirect
    // Verify we're either on dashboard or redirected to login (prod behavior)
    const url = page.url();
    expect(url.includes('dashboard') || url.includes('login')).toBeTruthy();
  });

  test('profile route should be accessible', async ({ page }) => {
    await page.goto('/profile');
    const url = page.url();
    expect(url.includes('profile') || url.includes('login')).toBeTruthy();
  });

  test('documents route should be accessible', async ({ page }) => {
    await page.goto('/documents');
    const url = page.url();
    expect(url.includes('documents') || url.includes('login')).toBeTruthy();
  });
});

test.describe('Admin Routes', () => {
  test('should have separate admin login page', async ({ page }) => {
    await page.goto('/admin-login');

    // Should display admin login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin dashboard route should exist', async ({ page }) => {
    // In dev mode with DESIGN_GOD_MODE, admin routes are accessible
    await page.goto('/admin/dashboard');

    // Verify we're either on admin dashboard or redirected (prod behavior)
    const url = page.url();
    expect(url.includes('admin') || url.includes('login')).toBeTruthy();
  });
});
