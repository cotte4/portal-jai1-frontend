import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Registration Page Object
 *
 * Encapsulates all registration page interactions:
 * - Form inputs (personal info, credentials)
 * - Referral code validation
 * - Terms acceptance
 * - Navigation to other auth pages
 */
export class RegisterPage extends BasePage {
  // ============= LOCATORS =============

  get firstNameInput(): Locator {
    return this.page.getByLabel(/nombre/i).first();
  }

  get lastNameInput(): Locator {
    return this.page.getByLabel(/apellido/i);
  }

  get emailInput(): Locator {
    return this.page.getByLabel(/correo electrónico|email/i);
  }

  get passwordInput(): Locator {
    return this.page.getByLabel(/^contraseña$/i);
  }

  get confirmPasswordInput(): Locator {
    return this.page.getByLabel(/confirmar contraseña/i);
  }

  get referralCodeInput(): Locator {
    return this.page.getByLabel(/codigo de referido/i);
  }

  get termsCheckbox(): Locator {
    return this.page.getByRole('checkbox');
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /crear mi cuenta|register|sign up/i });
  }

  get loginTab(): Locator {
    return this.page.getByRole('button', { name: /iniciar sesión|login/i });
  }

  get termsLink(): Locator {
    return this.page.getByText(/términos y condiciones/i);
  }

  get privacyLink(): Locator {
    return this.page.getByText(/política de privacidad/i);
  }

  get googleSignupButton(): Locator {
    return this.page.getByRole('button', { name: /continuar con google|google/i });
  }

  get createAccountHeading(): Locator {
    return this.page.getByRole('heading', { name: /creá tu cuenta|create account/i });
  }

  get termsModal(): Locator {
    return this.page.getByRole('heading', { name: /términos y condiciones/i });
  }

  get privacyModal(): Locator {
    return this.page.getByRole('heading', { name: /política de privacidad/i });
  }

  get modalCloseButton(): Locator {
    return this.page.getByRole('button', { name: /entendido|close|cerrar/i });
  }

  get referralCodeWrapper(): Locator {
    return this.referralCodeInput.locator('..');
  }

  // ============= ACTIONS =============

  /**
   * Navigate to registration page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/register');
    await this.waitForReady();
  }

  /**
   * Fill first name
   */
  async fillFirstName(firstName: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
  }

  /**
   * Fill last name
   */
  async fillLastName(lastName: string): Promise<void> {
    await this.lastNameInput.fill(lastName);
  }

  /**
   * Fill email
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Fill confirm password
   */
  async fillConfirmPassword(confirmPassword: string): Promise<void> {
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  /**
   * Fill referral code
   */
  async fillReferralCode(code: string): Promise<void> {
    await this.referralCodeInput.fill(code);
    await this.referralCodeInput.blur(); // Trigger validation
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(): Promise<void> {
    await this.termsCheckbox.check();
  }

  /**
   * Submit registration form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete registration with all required fields
   */
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    referralCode?: string;
  }): Promise<void> {
    await this.fillFirstName(data.firstName);
    await this.fillLastName(data.lastName);
    await this.fillEmail(data.email);
    await this.fillPassword(data.password);
    await this.fillConfirmPassword(data.password);
    if (data.referralCode) {
      await this.fillReferralCode(data.referralCode);
    }
    await this.acceptTerms();
    await this.submit();
  }

  /**
   * Register and wait for redirect to dashboard/onboarding
   */
  async registerAndWaitForDashboard(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    referralCode?: string;
  }): Promise<void> {
    await this.register(data);
    await this.waitForUrl(/\/(dashboard|onboarding)/, { timeout: 15000 });
  }

  /**
   * Open terms modal
   */
  async openTermsModal(): Promise<void> {
    await this.termsLink.click();
    await expect(this.termsModal).toBeVisible();
  }

  /**
   * Open privacy modal
   */
  async openPrivacyModal(): Promise<void> {
    await this.privacyLink.click();
    await expect(this.privacyModal).toBeVisible();
  }

  /**
   * Close any open modal
   */
  async closeAnyModal(): Promise<void> {
    await this.modalCloseButton.click();
  }

  /**
   * Navigate to login page
   */
  async goToLogin(): Promise<void> {
    await this.loginTab.click();
    await this.waitForUrl(/\/login/);
  }

  // ============= ASSERTIONS =============

  /**
   * Assert registration form is visible
   */
  async expectFormVisible(): Promise<void> {
    await expect(this.createAccountHeading).toBeVisible();
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.lastNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Assert referral code field has optional label
   */
  async expectReferralCodeOptional(): Promise<void> {
    await expect(this.referralCodeInput).toBeVisible();
    await expect(this.page.getByText(/opcional/i)).toBeVisible();
  }

  /**
   * Assert referral code is invalid (has error styling)
   */
  async expectReferralCodeInvalid(): Promise<void> {
    await expect(this.referralCodeWrapper).toHaveClass(/input-invalid/);
  }

  /**
   * Assert referral code is valid
   */
  async expectReferralCodeValid(): Promise<void> {
    await expect(this.referralCodeWrapper).not.toHaveClass(/input-invalid/);
  }

  /**
   * Assert terms modal is visible
   */
  async expectTermsModalVisible(): Promise<void> {
    await expect(this.termsModal).toBeVisible();
  }

  /**
   * Assert terms modal is not visible
   */
  async expectTermsModalHidden(): Promise<void> {
    await expect(this.termsModal).not.toBeVisible();
  }

  /**
   * Assert privacy modal is visible
   */
  async expectPrivacyModalVisible(): Promise<void> {
    await expect(this.privacyModal).toBeVisible();
  }

  /**
   * Assert still on registration page
   */
  async expectOnRegisterPage(): Promise<void> {
    await this.expectUrl(/\/register/);
  }
}
