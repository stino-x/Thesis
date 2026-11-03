/**
 * Playwright Component Test - ImageAnalyzer
 * Migrated from vitest due to Radix UI compatibility issues
 */

import { test, expect } from '@playwright/experimental-ct-react';
import ImageAnalyzer from '../../components/detection/ImageAnalyzer';
import React from 'react';

test.describe('ImageAnalyzer Component', () => {
  test('should display image info after load', async ({ mount, page }) => {
    // Mount the component
    const component = await mount(<ImageAnalyzer />);
    
    // Wait for component to render
    await expect(component).toBeVisible();
    
    // Create a test image file
    const buffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x03, 0x20, 0x00, 0x00, 0x02, 0x58, // 800x600
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload the test image
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: buffer,
    });

    // Wait for image info to be displayed
    await page.waitForTimeout(2000);
    
    // Check for image metadata (filename, size, or dimensions)
    const hasFilename = await page.locator('text=test.jpg').isVisible({ timeout: 5000 }).catch(() => false);
    const hasSize = await page.locator('text=/MB|KB|bytes/i').isVisible({ timeout: 5000 }).catch(() => false);
    const hasDimensions = await page.locator('text=/\\d+.*\\d+|width|height|dimension/i').isVisible({ timeout: 5000 }).catch(() => false);
    
    // At least one metadata field should be visible
    expect(hasFilename || hasSize || hasDimensions).toBeTruthy();
  });

  test('should render without crashing', async ({ mount }) => {
    const component = await mount(<ImageAnalyzer />);
    await expect(component).toBeVisible();
  });

  test('should show file upload area', async ({ mount, page }) => {
    await mount(<ImageAnalyzer />);
    
    // Should have drop zone or upload button
    const hasDropZone = await page.locator('text=/drop.*image|upload|drag/i').isVisible({ timeout: 5000 }).catch(() => false);
    const hasFileInput = await page.locator('input[type="file"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasDropZone || hasFileInput).toBeTruthy();
  });
});
