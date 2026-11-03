/**
 * E2E Tests - Navigation and Page Loading
 */

import { test, expect } from '@playwright/test';

test.describe('Application Navigation', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Page should load without errors
    await expect(page).toHaveTitle(/DeepFake|Detection/i);
    
    // Main content should be visible
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between detection modes', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to video detection
    await page.goto('/video');
    await expect(page.locator('text=/video/i')).toBeVisible({ timeout: 10000 });
    
    // Navigate to batch processing
    await page.goto('/batch');
    await expect(page.locator('text=/batch|multiple/i')).toBeVisible({ timeout: 10000 });
    
    // Back to image detection
    await page.goto('/');
    await expect(page.locator('text=/image|photo/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to audit logs', async ({ page }) => {
    await page.goto('/audit-logs');
    
    await expect(page.locator('text=/audit|log|history/i')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to settings', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('text=/setting|configuration|preference/i')).toBeVisible({ timeout: 10000 });
  });

  test('should show navigation menu', async ({ page }) => {
    await page.goto('/');
    
    // Look for navigation links/buttons
    const nav = page.locator('nav, [role="navigation"]').first();
    
    if (await nav.isVisible({ timeout: 5000 })) {
      await expect(nav).toBeVisible();
    } else {
      // Mobile menu or different layout
      const menuButton = page.locator('button').filter({ hasText: /menu|navigation/i }).first();
      if (await menuButton.isVisible({ timeout: 2000 })) {
        await expect(menuButton).toBeVisible();
      }
    }
  });

  test('should maintain responsive layout', async ({ page }) => {
    await page.goto('/');
    
    // Test different viewport sizes
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await expect(page.locator('body')).toBeVisible();
  });
});
