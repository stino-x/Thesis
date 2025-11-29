# Testing Setup Guide

This guide will help you set up and run the comprehensive test suite for the Deepfake Detection Application.

## Prerequisites

- Node.js 20+ installed
- npm or yarn package manager
- Git

## Installation

### 1. Install Testing Dependencies

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  happy-dom \
  @playwright/test \
  @axe-core/playwright \
  @testing-library/dom
```

### 2. Install Additional Testing Utilities

```bash
npm install --save-dev \
  @types/node \
  c8 \
  cross-env
```

## Configuration

### 1. Update package.json Scripts

Add the following scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:ui": "playwright test --ui",
    "playwright:install": "playwright install --with-deps"
  }
}
```

### 2. Environment Variables

Create a `.env.test` file:

```env
VITE_SUPABASE_URL=your_test_supabase_url
VITE_SUPABASE_ANON_KEY=your_test_supabase_anon_key
NODE_ENV=test
```

### 3. Install Playwright Browsers

```bash
npx playwright install --with-deps
```

## Test Structure

```
tests/
├── setup/
│   ├── setup.ts          # Global test setup
│   ├── mocks.ts          # Mock utilities
│   └── fixtures/         # Test data and files
├── unit/                 # Unit tests
│   ├── *.test.ts
│   └── *.test.tsx
├── integration/          # Integration tests
│   └── *.test.ts
└── e2e/                  # End-to-end tests
    └── *.spec.ts
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run specific test file
npm test tests/unit/videoUtils.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific browser
npx playwright test --project=chromium

# Run in UI mode
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug
```

### Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, test, expect } from 'vitest'
import { myFunction } from '@/utils/myFile'

describe('myFunction', () => {
  test('does something correctly', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })
})
```

### Component Test Example

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  test('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test('user can complete workflow', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.click('button[type="submit"]')
  await expect(page.locator('.success')).toBeVisible()
})
```

## Test Fixtures

Create test data in `tests/setup/fixtures/`:

```
fixtures/
├── videos/
│   ├── test-video.mp4
│   └── corrupted.mp4
├── images/
│   ├── test-image.jpg
│   └── no-face.jpg
└── data/
    ├── users.json
    └── results.json
```

## Mocking

### Mock Supabase

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))
```

### Mock TensorFlow

```typescript
vi.mock('@/lib/tensorflow', () => ({
  getDeepfakeDetector: vi.fn(() => ({
    detectFromImage: vi.fn(() => Promise.resolve({
      isDeepfake: false,
      confidence: 0.95,
    })),
  })),
}))
```

## Debugging Tests

### Vitest Debugging

```bash
# Run specific test with debug output
npm test -- --reporter=verbose mytest.test.ts

# Use debugger
# Add `debugger` statement in test, then run:
node --inspect-brk ./node_modules/.bin/vitest
```

### Playwright Debugging

```bash
# Debug mode with inspector
npm run test:e2e:debug

# Slow motion and headed
npx playwright test --headed --slow-mo=500

# Pause on failure
npx playwright test --pause-on-failure
```

## CI/CD Integration

The test suite is configured to run in GitHub Actions. See `.github/workflows/test.yml`.

### Local CI Simulation

```bash
# Run tests as CI would
CI=true npm run test:unit
CI=true npm run test:e2e
```

## Troubleshooting

### Tests Timeout

Increase timeout in test:
```typescript
test('slow test', async () => {
  // ...
}, 30000) // 30 seconds
```

### Flaky Tests

- Use `waitFor` for async operations
- Avoid fixed delays (`setTimeout`)
- Use proper mocks for external dependencies

### Mock Not Working

- Ensure mock is defined before import
- Use `vi.clearAllMocks()` in `beforeEach`
- Check mock paths match actual imports

## Best Practices

1. **Test Naming** - Use descriptive names that explain what is being tested
2. **Arrange-Act-Assert** - Structure tests clearly
3. **Isolation** - Each test should be independent
4. **Coverage** - Aim for >80% coverage on critical code
5. **Fast Tests** - Keep unit tests fast (<100ms each)
6. **Meaningful Assertions** - Use specific assertions with custom messages

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

## Support

For issues or questions about testing:
1. Check this documentation
2. Review existing tests for examples
3. Consult the comprehensive testing plan in `docs/testing/TESTING-PLAN.md`
