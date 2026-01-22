import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object
 *
 * Provides common functionality for all page objects:
 * - Navigation helpers
 * - Wait utilities
 * - Common assertions
 * - Reusable locators
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // ============= NAVIGATION =============

  /**
   * Navigate to a path relative to baseURL
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for page to fully load (network idle)
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to be ready (DOM content loaded)
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Wait for URL to match pattern
   */
  async waitForUrl(pattern: RegExp, options?: { timeout?: number }): Promise<void> {
    await this.page.waitForURL(pattern, options);
  }

  // ============= COMMON LOCATORS =============

  /**
   * Get toast/notification element
   */
  get toast(): Locator {
    return this.page.locator('.toast, .notification, .snackbar, [role="alert"]');
  }

  /**
   * Get loading spinner (more specific to avoid matching loading text placeholders)
   */
  get loadingSpinner(): Locator {
    return this.page.locator('.loading-state .spinner, .spinner:not(.season-stat-value), [data-testid="loading"]');
  }

  /**
   * Get modal/dialog
   */
  get modal(): Locator {
    return this.page.locator('.modal, [role="dialog"], .dialog');
  }

  // ============= COMMON ACTIONS =============

  /**
   * Click a button by its text content
   */
  async clickButton(text: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Fill an input by its label
   */
  async fillInput(label: string | RegExp, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Click a link by its text
   */
  async clickLink(text: string | RegExp): Promise<void> {
    await this.page.getByRole('link', { name: text }).click();
  }

  /**
   * Close modal if visible
   */
  async closeModal(): Promise<void> {
    const closeButton = this.modal.locator('button[aria-label="Close"], .close-button, button:has-text("Cerrar")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }

  // ============= WAIT UTILITIES =============

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for the main loading state spinner (in .loading-state container)
    const mainSpinner = this.page.locator('.loading-state .spinner');
    try {
      // First check if main loading state exists
      const spinnerCount = await mainSpinner.count();
      if (spinnerCount > 0 && await mainSpinner.first().isVisible()) {
        await mainSpinner.first().waitFor({ state: 'hidden', timeout: 30000 });
      }
    } catch {
      // Loading spinner not present or already hidden, continue
    }
    // Give a small buffer for content to settle
    await this.page.waitForTimeout(100);
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp, method?: string): Promise<Response> {
    const response = await this.page.waitForResponse(
      (resp) => {
        const matchesUrl = typeof urlPattern === 'string'
          ? resp.url().includes(urlPattern)
          : urlPattern.test(resp.url());
        const matchesMethod = method ? resp.request().method() === method : true;
        return matchesUrl && matchesMethod;
      },
      { timeout: 20000 }
    );
    return response;
  }

  // ============= ASSERTIONS =============

  /**
   * Assert toast message is visible with expected text
   */
  async expectToast(message: string | RegExp): Promise<void> {
    await expect(this.toast).toContainText(message);
  }

  /**
   * Assert page title
   */
  async expectTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Assert current URL matches pattern
   */
  async expectUrl(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Assert heading is visible
   */
  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  /**
   * Assert element with test ID is visible
   */
  async expectTestIdVisible(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toBeVisible();
  }

  // ============= SCREENSHOTS =============

  /**
   * Take a screenshot for visual comparison
   */
  async takeScreenshot(name: string): Promise<void> {
    await expect(this.page).toHaveScreenshot(`${name}.png`);
  }

  /**
   * Take full page screenshot
   */
  async takeFullPageScreenshot(name: string): Promise<void> {
    await expect(this.page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  }
}

// Re-export Response type for convenience
type Response = Awaited<ReturnType<Page['waitForResponse']>>;
