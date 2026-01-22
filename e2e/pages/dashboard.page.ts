import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Client Dashboard Page Object
 *
 * Encapsulates client dashboard interactions:
 * - Status tracking
 * - Navigation to documents, profile, etc.
 * - Notifications
 * - Quick actions
 */
export class DashboardPage extends BasePage {
  // ============= LOCATORS =============

  get welcomeMessage(): Locator {
    return this.page.locator('[data-testid="welcome-message"], .welcome-message, h1, h2').first();
  }

  get statusCard(): Locator {
    return this.page.locator('[data-testid="status-card"], .status-card, .case-status');
  }

  get progressBar(): Locator {
    return this.page.locator('[data-testid="progress-bar"], .progress-bar, .progress');
  }

  get documentsLink(): Locator {
    return this.page.getByRole('link', { name: /documentos|documents/i });
  }

  get profileLink(): Locator {
    return this.page.getByRole('link', { name: /perfil|profile/i });
  }

  get notificationBell(): Locator {
    return this.page.locator('[data-testid="notification-bell"], .notification-bell, .notifications-icon');
  }

  get notificationCount(): Locator {
    return this.page.locator('[data-testid="notification-count"], .notification-count, .badge');
  }

  get userMenu(): Locator {
    return this.page.locator('[data-testid="user-menu"], .user-menu, .profile-dropdown');
  }

  get logoutButton(): Locator {
    return this.page.getByRole('button', { name: /cerrar sesión|logout|salir/i });
  }

  get uploadDocumentButton(): Locator {
    return this.page.getByRole('button', { name: /subir|upload|cargar/i });
  }

  get quickActionsSection(): Locator {
    return this.page.locator('[data-testid="quick-actions"], .quick-actions');
  }

  get recentActivitySection(): Locator {
    return this.page.locator('[data-testid="recent-activity"], .recent-activity');
  }

  get referralCodeSection(): Locator {
    return this.page.locator('[data-testid="referral-code"], .referral-section');
  }

  get copyReferralCodeButton(): Locator {
    return this.page.getByRole('button', { name: /copiar|copy/i });
  }

  // ============= ACTIONS =============

  /**
   * Navigate to dashboard page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/dashboard');
    await this.waitForReady();
  }

  /**
   * Navigate to documents page
   */
  async goToDocuments(): Promise<void> {
    await this.documentsLink.click();
    await this.waitForUrl(/\/documents/);
  }

  /**
   * Navigate to profile page
   */
  async goToProfile(): Promise<void> {
    await this.profileLink.click();
    await this.waitForUrl(/\/profile/);
  }

  /**
   * Open notifications panel
   */
  async openNotifications(): Promise<void> {
    await this.notificationBell.click();
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }

  /**
   * Logout from the application
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.waitForUrl(/\/login/);
  }

  /**
   * Click upload document button
   */
  async clickUploadDocument(): Promise<void> {
    await this.uploadDocumentButton.click();
  }

  /**
   * Copy referral code to clipboard
   */
  async copyReferralCode(): Promise<void> {
    await this.copyReferralCodeButton.click();
  }

  /**
   * Get the current case status text
   */
  async getCaseStatus(): Promise<string> {
    return await this.statusCard.textContent() ?? '';
  }

  /**
   * Get notification count
   */
  async getNotificationCount(): Promise<number> {
    const countText = await this.notificationCount.textContent();
    return parseInt(countText ?? '0', 10);
  }

  // ============= ASSERTIONS =============

  /**
   * Assert dashboard page is loaded
   */
  async expectDashboardLoaded(): Promise<void> {
    await this.expectUrl(/\/dashboard/);
    await this.waitForLoadingComplete();
  }

  /**
   * Assert welcome message is visible
   */
  async expectWelcomeMessage(): Promise<void> {
    await expect(this.welcomeMessage).toBeVisible();
  }

  /**
   * Assert status card is visible
   */
  async expectStatusCardVisible(): Promise<void> {
    await expect(this.statusCard).toBeVisible();
  }

  /**
   * Assert progress bar shows expected percentage
   */
  async expectProgress(percentage: number): Promise<void> {
    await expect(this.progressBar).toContainText(`${percentage}%`);
  }

  /**
   * Assert user has notifications
   */
  async expectHasNotifications(): Promise<void> {
    await expect(this.notificationCount).toBeVisible();
    const count = await this.getNotificationCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Assert referral code section is visible
   */
  async expectReferralCodeVisible(): Promise<void> {
    await expect(this.referralCodeSection).toBeVisible();
  }

  /**
   * Assert quick actions section is visible
   */
  async expectQuickActionsVisible(): Promise<void> {
    await expect(this.quickActionsSection).toBeVisible();
  }

  /**
   * Assert case status contains text
   */
  async expectCaseStatus(statusText: string | RegExp): Promise<void> {
    await expect(this.statusCard).toContainText(statusText);
  }
}
