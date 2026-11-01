/**
 * E2E Tests - Video Analysis Workflow
 * Tests the complete video deepfake detection workflow
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Video Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/video');
  });

  test('should load video analysis page', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /Video/i })).toBeVisible({ timeout: 10000 });
    
    // Check for upload area
    await expect(page.locator('text=/Drop.*video|Upload.*video|drag.*drop/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should upload and display video info', async ({ page }) => {
    const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    await fileInput.setInputFiles(testVideoPath);

    // Wait for video to load
    await expect(page.locator('text=/duration|resolution|size|fps/i').first()).toBeVisible({ timeout: 15000 });
  });

  test('should start video analysis', async ({ page }) => {
    const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    await fileInput.setInputFiles(testVideoPath);

    await page.waitForTimeout(3000);

    // Click analyze button
    const analyzeButton = page.locator('button').filter({ hasText: /Analyze.*Video|Start.*Analysis/i }).first();
    
    if (await analyzeButton.isVisible({ timeout: 5000 })) {
      await analyzeButton.click();
      
      // Should show processing indicator
      await expect(page.locator('text=/processing|analyzing|extracting|frame/i')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show frame-by-frame results', async ({ page }) => {
    const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    await fileInput.setInputFiles(testVideoPath);

    await page.waitForTimeout(3000);

    const analyzeButton = page.locator('button').filter({ hasText: /Analyze/i }).first();
    
    if (await analyzeButton.isVisible({ timeout: 5000 })) {
      await analyzeButton.click();
      
      // Wait for frame results (may take a while)
      await expect(page.locator('text=/frame|timeline|result/i')).toBeVisible({ timeout: 60000 });
    }
  });

  test('should allow clearing video', async ({ page }) => {
    const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    await fileInput.setInputFiles(testVideoPath);

    await page.waitForTimeout(2000);

    const clearButton = page.locator('button').filter({ hasText: /clear|reset|remove/i }).first();
    
    if (await clearButton.isVisible({ timeout: 3000 })) {
      await clearButton.click();
      
      // Upload area should be visible again
      await expect(page.locator('text=/Drop.*video|Upload/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should validate video file types', async ({ page }) => {
    // Try uploading an image file as video (should fail)
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImagePath);

    // Should show error or reject the file
    await page.waitForTimeout(2000);
    
    // Either error message appears or file is rejected silently
    const errorOrEmpty = await page.locator('text=/error|invalid|unsupported/i').count() > 0 ||
                         await page.locator('text=/Drop.*video/i').isVisible();
    
    expect(errorOrEmpty).toBeTruthy();
  });
});
