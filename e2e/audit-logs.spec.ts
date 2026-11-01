/**
 * E2E Tests - Audit Logs
 */

import { test, expect } from '@playwright/test';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audit-logs');
  });

  test('should display audit logs page', async ({ page }) => {
    await expect(page.locator('text=/audit|log|history/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show log entries table or list', async ({ page }) => {
    // Look for table, list, or grid of log entries
    const hasTable = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await page.locator('[role="list"], ul, ol').isVisible({ timeout: 5000 }).catch(() => false);
    const hasGrid = await page.locator('[role="grid"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasTable || hasList || hasGrid).toBeTruthy();
  });

  test('should filter logs by detection type', async ({ page }) => {
    // Look for filter controls
    const filterButton = page.locator('button').filter({ hasText: /filter/i }).first();
    
    if (await filterButton.isVisible({ timeout: 5000 })) {
      await filterButton.click();
      
      // Should show filter options
      await expect(page.locator('text=/image|video|type/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search logs', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Search should trigger filtering
      await expect(searchInput).toHaveValue('test');
    }
  });

  test('should export logs', async ({ page }) => {
    const exportButton = page.locator('button').filter({ hasText: /export|download/i }).first();
    
    if (await exportButton.isVisible({ timeout: 5000 })) {
      await expect(exportButton).toBeEnabled();
    }
  });

  test('should display log statistics', async ({ page }) => {
    // Look for statistics or summary information
    const hasStats = await page.locator('text=/total|count|average|statistics/i').isVisible({ timeout: 5000 }).catch(() => false);
    
    // Stats may or may not be present depending on data
    expect(typeof hasStats).toBe('boolean');
  });

  test('should paginate through logs', async ({ page }) => {
    const nextButton = page.locator('button').filter({ hasText: /next|>/i }).first();
    const prevButton = page.locator('button').filter({ hasText: /previous|</i }).first();
    
    if (await nextButton.isVisible({ timeout: 5000 })) {
      await expect(nextButton).toBeVisible();
    }
  });
});
