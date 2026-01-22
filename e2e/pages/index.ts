/**
 * Page Object Model Index
 *
 * Export all page objects for easy import in tests.
 *
 * Usage:
 * ```typescript
 * import { LoginPage, RegisterPage, DashboardPage } from './pages';
 *
 * test('login flow', async ({ page }) => {
 *   const loginPage = new LoginPage(page);
 *   await loginPage.goto();
 *   await loginPage.login('user@example.com', 'password');
 * });
 * ```
 */

// Base page
export { BasePage } from './base.page';

// Auth pages
export { LoginPage } from './login.page';
export { RegisterPage } from './register.page';

// Client pages
export { DashboardPage } from './dashboard.page';
export { DocumentsPage } from './documents.page';

// Admin pages
export { AdminDashboardPage } from './admin/dashboard.page';
export { AdminClientDetailPage } from './admin/client-detail.page';
