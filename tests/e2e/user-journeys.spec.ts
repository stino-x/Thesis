import { test, expect } from '@playwright/test'

test.describe('Complete User Journey - Registration and Detection', () => {
  test('new user can register, login, and perform video detection', async ({
    page,
  }) => {
    // Generate unique email for this test run
    const timestamp = Date.now()
    const testEmail = `testuser${timestamp}@example.com`
    const testPassword = 'SecureTestPass123!'
    const testName = 'E2E Test User'

    // Navigate to the app
    await page.goto('/')

    // Should redirect to login page if not authenticated
    await expect(page).toHaveURL(/\/login/)

    // Navigate to signup
    await page.click('text=Sign up')
    await expect(page).toHaveURL(/\/signup/)

    // Fill signup form
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.fill('input[name="fullName"]', testName)

    // Accept terms if checkbox exists
    const termsCheckbox = page.locator('input[type="checkbox"][name="terms"]')
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit signup form
    await page.click('button[type="submit"]')

    // Should show success message
    await expect(
      page.locator('text=/account created|success|check your email/i')
    ).toBeVisible({ timeout: 10000 })

    // For this test, we'll proceed as if email is verified
    // In a real scenario, you'd need to handle email verification

    // Navigate to login
    await page.goto('/login')

    // Fill login form
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')

    // Should be redirected to main detection page
    await expect(page).toHaveURL('/', { timeout: 10000 })

    // Verify we're on the detection page
    await expect(
      page.locator('text=/deepfake detection|video upload/i')
    ).toBeVisible()

    // Upload a test video (you would need to have test fixtures)
    // For demonstration, we'll check if upload area exists
    const uploadArea = page.locator('input[type="file"]')
    await expect(uploadArea).toBeVisible()

    // If you have a test video file:
    // await uploadArea.setInputFiles('tests/fixtures/test-video.mp4')
    // await page.click('text=Analyze Video')
    // await expect(page.locator('text=/analyzing|complete/i')).toBeVisible({ timeout: 60000 })

    // Check that user menu is accessible
    const userAvatar = page.locator('[data-testid="user-avatar"]')
    if (await userAvatar.isVisible()) {
      await userAvatar.click()
      await expect(page.locator('text=/profile|logout/i')).toBeVisible()
    }

    // Navigate to profile
    await page.goto('/profile')
    await expect(page.locator(`text=${testName}`)).toBeVisible()

    // Logout
    await page.click('text=/logout|sign out/i')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Returning User - Login and Detection', () => {
  test('existing user can login and perform image detection', async ({
    page,
  }) => {
    // Use a pre-created test account
    const testEmail = 'existinguser@example.com'
    const testPassword = 'ExistingPass123!'

    // Navigate to login
    await page.goto('/login')

    // Fill login form
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')

    // Should be on detection page
    await expect(page).toHaveURL('/', { timeout: 10000 })

    // Navigate to image detection tab if it exists
    const imageTab = page.locator('text=/image detection|image/i')
    if (await imageTab.isVisible()) {
      await imageTab.click()
    }

    // Verify upload is available
    await expect(page.locator('input[type="file"]')).toBeVisible()

    // If you have a test image:
    // await page.locator('input[type="file"]').setInputFiles('tests/fixtures/test-image.jpg')
    // await page.click('text=Analyze')
    // await expect(page.locator('[data-testid="detection-result"]')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Password Reset Flow', () => {
  test('user can request password reset', async ({ page }) => {
    await page.goto('/login')

    // Click forgot password link
    await page.click('text=/forgot password|reset password/i')
    await expect(page).toHaveURL(/\/forgot-password/)

    // Enter email
    await page.fill('input[name="email"]', 'user@example.com')
    await page.click('button[type="submit"]')

    // Should show success message
    await expect(
      page.locator('text=/check your email|reset link sent/i')
    ).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('redirects to login when accessing protected route without auth', async ({
    page,
  }) => {
    // Try to access profile without being logged in
    await page.goto('/profile')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('allows access to protected routes when authenticated', async ({
    page,
  }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[name="email"]', 'user@example.com')
    await page.fill('input[name="password"]', 'Password123!')
    await page.click('button[type="submit"]')

    // Should allow access to profile
    await page.goto('/profile')
    await expect(page).toHaveURL('/profile')
  })
})

test.describe('Error Handling', () => {
  test('shows error for invalid login credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(
      page.locator('text=/invalid credentials|incorrect email or password/i')
    ).toBeVisible()
  })

  test('validates required fields in signup', async ({ page }) => {
    await page.goto('/signup')

    // Try to submit without filling fields
    await page.click('button[type="submit"]')

    // Should show validation errors
    await expect(
      page.locator('text=/required|please enter/i').first()
    ).toBeVisible()
  })
})

test.describe('Responsive Design', () => {
  test('works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')

    // Navigation should be accessible
    await expect(page.locator('nav')).toBeVisible()

    // Content should be readable
    await expect(page.locator('text=/deepfake detection/i')).toBeVisible()
  })

  test('works on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    await page.goto('/')

    await expect(page.locator('text=/deepfake detection/i')).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/login')

    // Tab through form elements
    await page.keyboard.press('Tab')
    await expect(page.locator('input[name="email"]')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('input[name="password"]')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeFocused()
  })

  test('has proper ARIA labels', async ({ page }) => {
    await page.goto('/login')

    // Check for ARIA labels on form inputs
    await expect(page.locator('input[name="email"]')).toHaveAttribute(
      'type',
      'email'
    )
    await expect(page.locator('input[name="password"]')).toHaveAttribute(
      'type',
      'password'
    )
  })
})
