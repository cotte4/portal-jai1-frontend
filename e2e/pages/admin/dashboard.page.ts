import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

/**
 * Admin Dashboard Page Object
 *
 * Encapsulates admin dashboard interactions:
 * - Client list management
 * - Stats overview
 * - Search and filtering
 * - Quick actions
 */
export class AdminDashboardPage extends BasePage {
  // ============= LOCATORS =============

  get pageTitle(): Locator {
    return this.page.getByRole('heading', { name: /dashboard|administracion|panel/i }).first();
  }

  get statsSection(): Locator {
    return this.page.locator('[data-testid="stats-section"], .stats-section, .stats-cards');
  }

  get totalClientsCard(): Locator {
    return this.page.locator('[data-testid="total-clients"], .stat-card:has-text("clientes"), .stat-card:has-text("clients")');
  }

  get pendingCasesCard(): Locator {
    return this.page.locator('[data-testid="pending-cases"], .stat-card:has-text("pendientes"), .stat-card:has-text("pending")');
  }

  get revenueCard(): Locator {
    return this.page.locator('[data-testid="revenue"], .stat-card:has-text("ingresos"), .stat-card:has-text("revenue")');
  }

  get clientsTable(): Locator {
    return this.page.locator('[data-testid="clients-table"], .clients-table-new, .clients-table, table');
  }

  get clientRows(): Locator {
    return this.clientsTable.locator('tbody tr');
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder(/buscar.*nombre.*email|buscar|search/i);
  }

  get statusFilter(): Locator {
    return this.page.locator('.search-filter-bar select, [data-testid="status-filter"], select[name="status"], .status-filter');
  }

  get exportButton(): Locator {
    return this.page.locator('.btn-export, button:has-text("Exportar")');
  }

  get refreshButton(): Locator {
    return this.page.getByRole('button', { name: /actualizar|refresh/i });
  }

  get paginationNext(): Locator {
    return this.page.getByRole('button', { name: /siguiente|next/i });
  }

  get paginationPrev(): Locator {
    return this.page.getByRole('button', { name: /anterior|previous|prev/i });
  }

  get loadMoreButton(): Locator {
    return this.page.getByRole('button', { name: /cargar más|load more/i });
  }

  get alarmsSection(): Locator {
    return this.page.locator('[data-testid="alarms-section"], .alarms-section');
  }

  get delaysSection(): Locator {
    return this.page.locator('[data-testid="delays-section"], .delays-section');
  }

  // ============= ACTIONS =============

  /**
   * Navigate to admin dashboard
   */
  async goto(): Promise<void> {
    await this.navigateTo('/admin/dashboard');
    await this.waitForReady();
    await this.waitForLoadingComplete();
  }

  /**
   * Search for a client
   */
  async searchClient(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForLoadingComplete();
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.searchInput.press('Enter');
    await this.waitForLoadingComplete();
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption({ label: status });
    await this.waitForLoadingComplete();
  }

  /**
   * Click on a client row to view details
   */
  async openClient(clientEmail: string): Promise<void> {
    const row = this.clientRows.filter({ hasText: clientEmail });
    await row.click();
    await this.waitForUrl(/\/admin\/client\/[^/]+/);
  }

  /**
   * Get client row by email
   */
  getClientRow(email: string): Locator {
    return this.clientRows.filter({ hasText: email });
  }

  /**
   * Export client data
   */
  async exportClients(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    await downloadPromise;
  }

  /**
   * Refresh client list
   */
  async refreshList(): Promise<void> {
    await this.refreshButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Load more clients (infinite scroll)
   */
  async loadMore(): Promise<void> {
    await this.loadMoreButton.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.paginationNext.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Go to previous page
   */
  async prevPage(): Promise<void> {
    await this.paginationPrev.click();
    await this.waitForLoadingComplete();
  }

  /**
   * Get total clients count from stats
   */
  async getTotalClientsCount(): Promise<number> {
    const text = await this.totalClientsCard.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Get client row count in current view
   */
  async getVisibleClientCount(): Promise<number> {
    return await this.clientRows.count();
  }

  // ============= ASSERTIONS =============

  /**
   * Assert admin dashboard is loaded
   */
  async expectDashboardLoaded(): Promise<void> {
    await this.expectUrl(/\/admin\/dashboard/);
    await this.waitForLoadingComplete();
  }

  /**
   * Assert stats section is visible
   */
  async expectStatsVisible(): Promise<void> {
    await expect(this.statsSection).toBeVisible();
  }

  /**
   * Assert clients table is visible
   */
  async expectClientsTableVisible(): Promise<void> {
    await expect(this.clientsTable).toBeVisible();
  }

  /**
   * Assert client row exists
   */
  async expectClientExists(email: string): Promise<void> {
    const row = this.getClientRow(email);
    await expect(row).toBeVisible();
  }

  /**
   * Assert client row has status
   */
  async expectClientStatus(email: string, status: string | RegExp): Promise<void> {
    const row = this.getClientRow(email);
    await expect(row).toContainText(status);
  }

  /**
   * Assert no results found
   */
  async expectNoResults(): Promise<void> {
    const noResults = this.page.locator('.no-results, .empty-state, :text("No se encontraron"), :text("No results")');
    await expect(noResults).toBeVisible();
  }

  /**
   * Assert client count
   */
  async expectClientCount(count: number): Promise<void> {
    await expect(this.clientRows).toHaveCount(count);
  }

  /**
   * Assert search results filtered
   */
  async expectSearchResults(query: string): Promise<void> {
    const count = await this.clientRows.count();
    for (let i = 0; i < count; i++) {
      const row = this.clientRows.nth(i);
      await expect(row).toContainText(new RegExp(query, 'i'));
    }
  }
}
