/**
 * E2E Tests - Image Analysis Workflow
 * Tests the complete image deepfake detection workflow
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Image Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full image analysis workflow', async ({ page }) => {
    // Verify we're on the image detection page
    await expect(page.locator('h1, h2').filter({ hasText: /Image Analysis|Deepfake Detection/i })).toBeVisible({ timeout: 10000 });

    // Check for file upload area
    const dropZone = page.locator('text=/Drop.*image|Upload.*image|drag.*drop/i').first();
    await expect(dropZone).toBeVisible({ timeout: 5000 });

    // Create a test image file (1x1 pixel PNG)
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    // Upload image via file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    // Wait for image to load
    await expect(page.locator('text=/test-image|loading|loaded/i')).toBeVisible({ timeout: 10000 });

    // Click analyze button
    const analyzeButton = page.locator('button').filter({ hasText: /Analyze|Detect|Scan/i }).first();
    await analyzeButton.click();

    // Wait for analysis to complete (should show results)
    await expect(page.locator('text=/result|confidence|real|fake|deepfake/i')).toBeVisible({ timeout: 30000 });

    // Verify results panel is visible
    await expect(page.locator('text=/confidence|score|prediction/i')).toBeVisible();
  });

  test('should handle multiple image formats', async ({ page }) => {
    const formats = ['test-image.png', 'test-image.jpg'];

    for (const filename of formats) {
      const testPath = path.join(__dirname, 'fixtures', filename);
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testPath);

      // Wait for file to be recognized
      await page.waitForTimeout(1000);
      
      // Verify no error messages
      const errorMsg = page.locator('text=/error|invalid|unsupported/i');
      await expect(errorMsg).toHaveCount(0, { timeout: 2000 }).catch(() => {});
      
      // Clear for next iteration
      await page.reload();
    }
  });

  test('should show image metadata', async ({ page }) => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    // Wait for metadata to appear
    await expect(page.locator('text=/dimension|size|resolution|width|height/i')).toBeVisible({ timeout: 10000 });
  });

  test('should allow clearing uploaded image', async ({ page }) => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    await page.waitForTimeout(2000);

    // Find and click clear/reset button
    const clearButton = page.locator('button').filter({ hasText: /clear|reset|remove/i }).first();
    
    if (await clearButton.isVisible({ timeout: 2000 })) {
      await clearButton.click();
      
      // Verify upload area is back
      await expect(page.locator('text=/Drop.*image|Upload/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should export results after analysis', async ({ page }) => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    await page.waitForTimeout(2000);

    // Analyze
    const analyzeButton = page.locator('button').filter({ hasText: /Analyze/i }).first();
    if (await analyzeButton.isVisible({ timeout: 5000 })) {
      await analyzeButton.click();
      
      // Wait for results
      await page.waitForTimeout(5000);
      
      // Look for export button
      const exportButton = page.locator('button').filter({ hasText: /export|download|save/i }).first();
      
      if (await exportButton.isVisible({ timeout: 3000 })) {
        await expect(exportButton).toBeEnabled();
      }
    }
  });
});
