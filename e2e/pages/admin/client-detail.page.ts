import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * Admin Client Detail Page Object
 *
 * Encapsulates admin client detail page interactions:
 * - View client info
 * - Update status
 * - Manage documents
 * - Send notifications
 * - Set/resolve problems
 */
export class AdminClientDetailPage extends BasePage {
  // ============= LOCATORS =============

  get clientName(): Locator {
    return this.page.locator('[data-testid="client-name"], .client-name, h1, h2').first();
  }

  get clientEmail(): Locator {
    return this.page.locator('[data-testid="client-email"], .client-email');
  }

  get clientPhone(): Locator {
    return this.page.locator('[data-testid="client-phone"], .client-phone');
  }

  get caseStatusBadge(): Locator {
    return this.page.locator('[data-testid="case-status"], .status-badge, .case-status');
  }

  get federalStatusSelect(): Locator {
    return this.page.locator('[data-testid="federal-status"], select[name="federalStatus"]');
  }

  get stateStatusSelect(): Locator {
    return this.page.locator('[data-testid="state-status"], select[name="stateStatus"]');
  }

  get internalStatusSelect(): Locator {
    return this.page.locator('[data-testid="internal-status"], select[name="internalStatus"], select[name="preFilingStatus"]');
  }

  get updateStatusButton(): Locator {
    return this.page.getByRole('button', { name: /actualizar estado|update status/i });
  }

  get documentsSection(): Locator {
    return this.page.locator('[data-testid="documents-section"], .documents-section');
  }

  get documentsList(): Locator {
    return this.documentsSection.locator('.document-item, .document-row');
  }

  get problemSection(): Locator {
    return this.page.locator('[data-testid="problem-section"], .problem-section');
  }

  get problemBadge(): Locator {
    return this.page.locator('[data-testid="problem-badge"], .problem-badge, .has-problem');
  }

  get setProblemButton(): Locator {
    return this.page.locator('.btn-problem, button:has-text("Marcar Problema")');
  }

  get resolveProblemButton(): Locator {
    return this.page.getByRole('button', { name: /resolver problema|resolve problem/i });
  }

  get problemTypeSelect(): Locator {
    return this.page.locator('select[name="problemType"], [data-testid="problem-type"]');
  }

  get problemDescriptionInput(): Locator {
    return this.page.locator('textarea[name="problemDescription"], [data-testid="problem-description"]');
  }

  get sendNotificationButton(): Locator {
    return this.page.locator('.btn-notify, button:has-text("Notificacion")');
  }

  get notificationMessageInput(): Locator {
    return this.page.locator('textarea[name="message"], [data-testid="notification-message"]');
  }

  get markPaidButton(): Locator {
    return this.page.getByRole('button', { name: /marcar pagado|mark paid/i });
  }

  get deleteClientButton(): Locator {
    return this.page.getByRole('button', { name: /eliminar cliente|delete client/i });
  }

  get backButton(): Locator {
    return this.page.locator('.btn-back, button:has-text("Volver")');
  }

  get editButton(): Locator {
    return this.page.getByRole('button', { name: /editar|edit/i });
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: /guardar|save/i });
  }

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: /cancelar|cancel/i });
  }

  get activityLog(): Locator {
    return this.page.locator('[data-testid="activity-log"], .activity-log, .audit-log');
  }

  get estimatedRefundInput(): Locator {
    return this.page.locator('input[name="estimatedRefund"], [data-testid="estimated-refund"]');
  }

  // ============= ACTIONS =============

  /**
   * Navigate to client detail page
   */
  async goto(clientId: string): Promise<void> {
    await this.navigateTo(`/admin/client/${clientId}`);
    await this.waitForReady();
    await this.waitForLoadingComplete();
  }

  /**
   * Go back to client list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.waitForUrl(/\/admin\/dashboard/);
  }

  /**
   * Update federal status
   */
  async updateFederalStatus(status: string): Promise<void> {
    await this.federalStatusSelect.selectOption({ label: status });
  }

  /**
   * Update state status
   */
  async updateStateStatus(status: string): Promise<void> {
    await this.stateStatusSelect.selectOption({ label: status });
  }

  /**
   * Update internal status
   */
  async updateInternalStatus(status: string): Promise<void> {
    await this.internalStatusSelect.selectOption({ label: status });
  }

  /**
   * Save status updates
   */
  async saveStatusUpdates(): Promise<void> {
    await this.updateStatusButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Set a problem on the client case
   */
  async setProblem(type: string, description: string): Promise<void> {
    await this.setProblemButton.click();
    await this.problemTypeSelect.selectOption({ label: type });
    await this.problemDescriptionInput.fill(description);
    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Resolve the current problem
   */
  async resolveProblem(): Promise<void> {
    await this.resolveProblemButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Send a notification to the client
   */
  async sendNotification(message: string): Promise<void> {
    await this.sendNotificationButton.click();
    await this.notificationMessageInput.fill(message);
    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Mark client as paid
   */
  async markAsPaid(): Promise<void> {
    await this.markPaidButton.click();
    // Confirm if dialog appears
    const confirmButton = this.page.getByRole('button', { name: /confirmar|confirm/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    await this.waitForLoadingComplete();
  }

  /**
   * Delete client (with confirmation)
   */
  async deleteClient(): Promise<void> {
    await this.deleteClientButton.click();
    // Confirm deletion
    const confirmButton = this.page.getByRole('button', { name: /confirmar|confirm|sí|yes/i });
    await confirmButton.click();
    await this.waitForUrl(/\/admin\/(dashboard|clients)/);
  }

  /**
   * Update estimated refund
   */
  async updateEstimatedRefund(amount: string): Promise<void> {
    await this.editButton.click();
    await this.estimatedRefundInput.fill(amount);
    await this.saveButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Get client name text
   */
  async getClientNameText(): Promise<string> {
    return await this.clientName.textContent() ?? '';
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    return await this.documentsList.count();
  }

  /**
   * Download a client document
   */
  async downloadDocument(documentName: string): Promise<void> {
    const doc = this.documentsList.filter({ hasText: documentName });
    const downloadBtn = doc.getByRole('button', { name: /descargar|download/i });
    await downloadBtn.click();
  }

  // ============= ASSERTIONS =============

  /**
   * Assert client detail page is loaded
   */
  async expectPageLoaded(): Promise<void> {
    await this.expectUrl(/\/admin\/client\/[^/]+/);
    await this.waitForLoadingComplete();
  }

  /**
   * Assert client name is displayed
   */
  async expectClientName(name: string | RegExp): Promise<void> {
    await expect(this.clientName).toContainText(name);
  }

  /**
   * Assert client email is displayed
   */
  async expectClientEmail(email: string): Promise<void> {
    await expect(this.clientEmail).toContainText(email);
  }

  /**
   * Assert case status
   */
  async expectCaseStatus(status: string | RegExp): Promise<void> {
    await expect(this.caseStatusBadge).toContainText(status);
  }

  /**
   * Assert client has a problem
   */
  async expectHasProblem(): Promise<void> {
    await expect(this.problemBadge).toBeVisible();
  }

  /**
   * Assert client has no problem
   */
  async expectNoProblem(): Promise<void> {
    await expect(this.problemBadge).not.toBeVisible();
  }

  /**
   * Assert documents section visible
   */
  async expectDocumentsSectionVisible(): Promise<void> {
    await expect(this.documentsSection).toBeVisible();
  }

  /**
   * Assert document exists
   */
  async expectDocumentExists(name: string): Promise<void> {
    const doc = this.documentsList.filter({ hasText: name });
    await expect(doc).toBeVisible();
  }

  /**
   * Assert activity log visible
   */
  async expectActivityLogVisible(): Promise<void> {
    await expect(this.activityLog).toBeVisible();
  }

  /**
   * Assert success toast after action
   */
  async expectActionSuccess(): Promise<void> {
    await this.expectToast(/éxito|success|actualizado|updated/i);
  }

  /**
   * Assert payment marked
   */
  async expectPaymentMarked(): Promise<void> {
    const paidBadge = this.page.locator('.paid-badge, [data-testid="paid"], :text("Pagado")');
    await expect(paidBadge).toBeVisible();
  }
}
