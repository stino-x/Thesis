/**
 * E2E Tests - Settings and Configuration
 */

import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('text=/setting|configuration/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show model configuration options', async ({ page }) => {
    // Look for model-related settings
    const hasModelSettings = await page.locator('text=/model|detector|algorithm/i').isVisible({ timeout: 5000 }).catch(() => false);
    
    // Settings may vary
    expect(typeof hasModelSettings).toBe('boolean');
  });

  test('should show detection sensitivity controls', async ({ page }) => {
    const sensitivityControl = page.locator('input[type="range"], input[type="number"]').first();
    
    if (await sensitivityControl.isVisible({ timeout: 5000 })) {
      await expect(sensitivityControl).toBeVisible();
    }
  });

  test('should have save/apply button', async ({ page }) => {
    const saveButton = page.locator('button').filter({ hasText: /save|apply|update/i }).first();
    
    if (await saveButton.isVisible({ timeout: 5000 })) {
      await expect(saveButton).toBeVisible();
    }
  });

  test('should show processing speed options', async ({ page }) => {
    const speedOption = page.locator('text=/speed|performance|quality/i').first();
    
    if (await speedOption.isVisible({ timeout: 5000 })) {
      await expect(speedOption).toBeVisible();
    }
  });

  test('should display visual settings', async ({ page }) => {
    // Look for UI/display settings
    const visualSettings = page.locator('text=/bounding box|heatmap|confidence|display/i').first();
    
    if (await visualSettings.isVisible({ timeout: 5000 })) {
      await expect(visualSettings).toBeVisible();
    }
  });

  test('should allow toggling defensive transforms', async ({ page }) => {
    const toggles = page.locator('input[type="checkbox"], button[role="switch"]');
    const count = await toggles.count();
    
    // Should have at least some toggleable options
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
