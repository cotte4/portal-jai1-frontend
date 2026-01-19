import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * Screenshot comparison tests for key pages.
 * These tests capture visual regressions in the UI.
 *
 * Note: First run generates baseline screenshots.
 * Subsequent runs compare against baselines.
 *
 * To update baselines:
 *   npx playwright test --update-snapshots
 */

test.describe('Visual Regression - Auth Pages', () => {
  test('login page visual', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Take screenshot
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('register page visual', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('register-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('forgot password page visual', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('forgot-password-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('admin login page visual', async ({ page }) => {
    await page.goto('/admin-login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('admin-login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Error States', () => {
  test('login error state', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill invalid credentials
    await page.getByLabel(/correo electrónico/i).fill('invalid@test.com');
    await page.getByLabel(/contraseña/i).fill('wrongpassword');

    // Mock the API to return error
    await page.route('**/auth/login', route =>
      route.fulfill({
        status: 401,
        body: JSON.stringify({ message: 'Invalid credentials' }),
      })
    );

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for error to show
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('login-error-state.png', {
      maxDiffPixels: 150,
      threshold: 0.3,
    });
  });
});

test.describe('Visual Regression - Protected Pages (Dev Mode)', () => {
  // These tests require DESIGN_GOD_MODE=true in development

  test('dashboard page visual', async ({ page }) => {
    await page.goto('/dashboard');
    const url = page.url();

    if (url.includes('dashboard')) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for data to load

      await expect(page).toHaveScreenshot('dashboard-page.png', {
        maxDiffPixels: 200,
        threshold: 0.3,
        // Mask dynamic content
        mask: [
          page.locator('[data-testid="timestamp"]'),
          page.locator('.timestamp'),
          page.locator('.date-time'),
        ],
      });
    } else {
      test.skip();
    }
  });

  test('documents page visual', async ({ page }) => {
    await page.goto('/documents');
    const url = page.url();

    if (url.includes('documents')) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('documents-page.png', {
        maxDiffPixels: 200,
        threshold: 0.3,
      });
    } else {
      test.skip();
    }
  });

  test('admin dashboard visual', async ({ page }) => {
    await page.goto('/admin/dashboard');
    const url = page.url();

    if (url.includes('admin')) {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('admin-dashboard-page.png', {
        maxDiffPixels: 300,
        threshold: 0.3,
        // Mask dynamic content like timestamps and counts
        mask: [
          page.locator('[data-testid="timestamp"]'),
          page.locator('.timestamp'),
          page.locator('.date-time'),
          page.locator('.count'),
        ],
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Regression - Responsive', () => {
  test('login page mobile visual', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('login page tablet visual', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-page-tablet.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('register page mobile visual', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('register-page-mobile.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Components', () => {
  test('login form focused state', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Focus on email input
    await page.getByLabel(/correo electrónico/i).focus();
    await page.waitForTimeout(300);

    // Take screenshot of focused form
    const formLocator = page.locator('form').first();
    await expect(formLocator).toHaveScreenshot('login-form-focused.png', {
      maxDiffPixels: 50,
      threshold: 0.2,
    });
  });

  test('login form filled state', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill form
    await page.getByLabel(/correo electrónico/i).fill('test@example.com');
    await page.getByLabel(/contraseña/i).fill('password123');
    await page.waitForTimeout(300);

    const formLocator = page.locator('form').first();
    await expect(formLocator).toHaveScreenshot('login-form-filled.png', {
      maxDiffPixels: 50,
      threshold: 0.2,
    });
  });
});

test.describe('Visual Regression - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  test('login page dark mode', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('login-page-dark.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('register page dark mode', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('register-page-dark.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});
