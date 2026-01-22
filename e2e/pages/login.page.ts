import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login Page Object
 *
 * Encapsulates all login page interactions:
 * - Form inputs
 * - Submit actions
 * - Navigation to other auth pages
 * - Validation messages
 */
export class LoginPage extends BasePage {
  // ============= LOCATORS =============

  get emailInput(): Locator {
    return this.page.getByLabel(/correo electrónico|email/i);
  }

  get passwordInput(): Locator {
    return this.page.getByLabel(/contraseña|password/i);
  }

  get submitButton(): Locator {
    return this.page.locator('button[type="submit"]');
  }

  get googleLoginButton(): Locator {
    return this.page.getByRole('button', { name: /continuar con google|google/i });
  }

  get forgotPasswordLink(): Locator {
    return this.page.getByText(/olvidaste tu contraseña|forgot password/i);
  }

  get registerTab(): Locator {
    return this.page.getByRole('button', { name: /crear cuenta|register|sign up/i });
  }

  get passwordToggle(): Locator {
    return this.page.locator('.toggle-visibility').first();
  }

  get errorMessage(): Locator {
    return this.page.locator('.error-message, .alert-error, [role="alert"]');
  }

  get welcomeHeading(): Locator {
    return this.page.getByRole('heading', { name: /bienvenido|welcome/i });
  }

  // ============= ACTIONS =============

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/login');
    await this.waitForReady();
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Submit the login form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete login with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Login and wait for successful redirect
   */
  async loginAndWaitForDashboard(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.waitForUrl(/\/(dashboard|onboarding|admin)/, { timeout: 15000 });
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.passwordToggle.click();
  }

  /**
   * Click Google login button
   */
  async clickGoogleLogin(): Promise<void> {
    await this.googleLoginButton.click();
  }

  /**
   * Navigate to registration page
   */
  async goToRegister(): Promise<void> {
    await this.registerTab.click();
    await this.waitForUrl(/\/register/);
  }

  /**
   * Navigate to forgot password page
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.waitForUrl(/\/forgot-password/);
  }

  // ============= ASSERTIONS =============

  /**
   * Assert login form is visible
   */
  async expectFormVisible(): Promise<void> {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Assert error message is visible
   */
  async expectError(message?: string | RegExp): Promise<void> {
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    } else {
      await expect(this.errorMessage).toBeVisible();
    }
  }

  /**
   * Assert password is visible (text type)
   */
  async expectPasswordVisible(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', 'text');
  }

  /**
   * Assert password is hidden (password type)
   */
  async expectPasswordHidden(): Promise<void> {
    await expect(this.passwordInput).toHaveAttribute('type', 'password');
  }

  /**
   * Assert still on login page
   */
  async expectOnLoginPage(): Promise<void> {
    await this.expectUrl(/\/login/);
  }

  /**
   * Assert Google login button is visible
   */
  async expectGoogleLoginVisible(): Promise<void> {
    await expect(this.googleLoginButton).toBeVisible();
  }
}
