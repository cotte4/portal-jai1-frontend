import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import path from 'path';

/**
 * Documents Page Object
 *
 * Encapsulates document management interactions:
 * - File upload
 * - Document list viewing
 * - Document download
 * - Document deletion
 */
export class DocumentsPage extends BasePage {
  // ============= LOCATORS =============

  get pageTitle(): Locator {
    return this.page.getByRole('heading', { name: /subir documentos|mis documentos|documents/i });
  }

  get uploadButton(): Locator {
    // The upload zone uses a label for file selection, not a button
    return this.page.locator('.btn-browse, label[for="fileInput"], .upload-zone');
  }

  get fileInput(): Locator {
    return this.page.locator('input[type="file"]');
  }

  get documentTypeSelect(): Locator {
    return this.page.locator('select[name="documentType"], [data-testid="document-type-select"]');
  }

  get documentList(): Locator {
    return this.page.locator('[data-testid="document-list"], .document-list, .documents-grid');
  }

  get documentItems(): Locator {
    return this.page.locator('[data-testid="document-item"], .document-item, .document-card');
  }

  get emptyState(): Locator {
    return this.page.locator('[data-testid="empty-state"], .empty-state, .no-documents');
  }

  get uploadModal(): Locator {
    return this.page.locator('[data-testid="upload-modal"], .upload-modal, [role="dialog"]');
  }

  get uploadProgress(): Locator {
    return this.page.locator('[data-testid="upload-progress"], .upload-progress, .progress-bar');
  }

  get confirmUploadButton(): Locator {
    return this.page.getByRole('button', { name: /confirmar|confirm|subir archivo|upload file/i });
  }

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: /cancelar|cancel/i });
  }

  // ============= ACTIONS =============

  /**
   * Navigate to documents page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/documents');
    await this.waitForReady();
    await this.waitForLoadingComplete();
  }

  /**
   * Click upload button to open upload modal/form
   */
  async clickUpload(): Promise<void> {
    await this.uploadButton.click();
  }

  /**
   * Upload a file
   */
  async uploadFile(filePath: string, documentType?: string): Promise<void> {
    // Click upload button if modal is needed
    const isModalBased = await this.uploadModal.isVisible().catch(() => false);
    if (!isModalBased) {
      await this.clickUpload();
    }

    // Select document type if provided
    if (documentType) {
      await this.selectDocumentType(documentType);
    }

    // Set file input
    await this.fileInput.setInputFiles(filePath);

    // Click confirm if there's a confirmation button
    if (await this.confirmUploadButton.isVisible()) {
      await this.confirmUploadButton.click();
    }

    // Wait for upload to complete
    await this.waitForUploadComplete();
  }

  /**
   * Upload a test file (creates a temporary file)
   */
  async uploadTestFile(fileName: string, documentType?: string): Promise<void> {
    // Use a test fixture file or create one dynamically
    const testFilePath = path.join(__dirname, '..', 'fixtures', 'files', fileName);
    await this.uploadFile(testFilePath, documentType);
  }

  /**
   * Select document type from dropdown
   */
  async selectDocumentType(type: string): Promise<void> {
    await this.documentTypeSelect.selectOption({ label: type });
  }

  /**
   * Wait for upload to complete
   */
  async waitForUploadComplete(): Promise<void> {
    // Wait for progress bar to complete or disappear
    const progressVisible = await this.uploadProgress.isVisible().catch(() => false);
    if (progressVisible) {
      await this.uploadProgress.waitFor({ state: 'hidden', timeout: 60000 });
    }
    await this.waitForLoadingComplete();
  }

  /**
   * Get document by name
   */
  getDocumentByName(name: string): Locator {
    return this.documentItems.filter({ hasText: name });
  }

  /**
   * Download a document by name
   */
  async downloadDocument(name: string): Promise<void> {
    const document = this.getDocumentByName(name);
    const downloadButton = document.getByRole('button', { name: /descargar|download/i });
    await downloadButton.click();
  }

  /**
   * Delete a document by name
   */
  async deleteDocument(name: string): Promise<void> {
    const document = this.getDocumentByName(name);
    const deleteButton = document.getByRole('button', { name: /eliminar|delete|borrar/i });
    await deleteButton.click();

    // Confirm deletion if dialog appears
    const confirmDialog = this.page.getByRole('dialog');
    if (await confirmDialog.isVisible()) {
      await this.page.getByRole('button', { name: /confirmar|confirm|sí|yes/i }).click();
    }
  }

  /**
   * Get count of documents
   */
  async getDocumentCount(): Promise<number> {
    return await this.documentItems.count();
  }

  /**
   * Cancel upload modal
   */
  async cancelUpload(): Promise<void> {
    await this.cancelButton.click();
  }

  // ============= ASSERTIONS =============

  /**
   * Assert documents page is loaded
   */
  async expectPageLoaded(): Promise<void> {
    await this.expectUrl(/\/documents/);
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Assert document list is visible
   */
  async expectDocumentListVisible(): Promise<void> {
    await expect(this.documentList).toBeVisible();
  }

  /**
   * Assert empty state is shown (no documents)
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Assert specific document exists
   */
  async expectDocumentExists(name: string): Promise<void> {
    const document = this.getDocumentByName(name);
    await expect(document).toBeVisible();
  }

  /**
   * Assert specific document does not exist
   */
  async expectDocumentNotExists(name: string): Promise<void> {
    const document = this.getDocumentByName(name);
    await expect(document).not.toBeVisible();
  }

  /**
   * Assert document count
   */
  async expectDocumentCount(count: number): Promise<void> {
    await expect(this.documentItems).toHaveCount(count);
  }

  /**
   * Assert upload success toast/message
   */
  async expectUploadSuccess(): Promise<void> {
    await this.expectToast(/subido|uploaded|éxito|success/i);
  }

  /**
   * Assert upload modal is visible
   */
  async expectUploadModalVisible(): Promise<void> {
    await expect(this.uploadModal).toBeVisible();
  }

  /**
   * Assert upload modal is closed
   */
  async expectUploadModalClosed(): Promise<void> {
    await expect(this.uploadModal).not.toBeVisible();
  }
}
