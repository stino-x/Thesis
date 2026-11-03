# Testing Guide - Quick Reference

## 🚀 Quick Start

```bash
# Install dependencies (if not done)
npm install

# Generate test fixtures
npm run test:fixtures

# Run all tests
npm run test:all
```

## 📝 Test Commands

### Unit Tests
```bash
npm test                  # Run once
npm run test:watch        # Watch mode
```

### Component Tests (Playwright)
```bash
npm run test:component    # Run all component tests
npm run test:component:ui # Interactive UI mode
```

### E2E Tests (Playwright)
```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Interactive UI mode
npm run test:e2e:headed   # See browser
```

### All Tests
```bash
npm run test:all          # Run unit + component + E2E
```

## 📊 Test Status

### ✅ Passing
- **Unit Tests:** 186 passing, 7 skipped (100% pass rate)
- **Component Tests:** 8 tests ready (ImageAnalyzer, VideoAnalyzer)
- **E2E Tests:** 25+ scenarios ready

### ⏭️ Skipped Tests
7 tests skipped in vitest due to jsdom/Radix UI compatibility.
These have been migrated to Playwright component tests.

## 📁 Test Structure

```
src/tests/
├── component/              # Playwright component tests (8 tests)
│   ├── ImageAnalyzer.ct.spec.tsx
│   └── VideoAnalyzer.ct.spec.tsx
├── accuracy/              # 16 tests
├── performance/           # 8 tests
├── security/              # 7 tests
├── workflow/              # 7 tests
├── auditLogger.test.ts    # 24 tests
├── backend.test.ts        # 18 tests
├── videoUtils.test.ts     # 25 tests
├── ImageAnalyzer.test.tsx # 10 tests
└── VideoAnalyzer.test.tsx # 3 tests

e2e/
├── fixtures/              # Test files (image, video)
├── image-analysis.spec.ts # 5 E2E tests
├── video-analysis.spec.ts # 6 E2E tests
├── navigation.spec.ts     # 6 E2E tests
├── audit-logs.spec.ts     # 7 E2E tests
└── settings.spec.ts       # 7 E2E tests
```

## 🎯 What's Tested

### Image Detection ✅
- Upload (drag & drop, file picker)
- Metadata display
- Analysis & results
- Export functionality
- Multiple formats (PNG, JPEG, WebP)

### Video Detection ✅
- Upload & validation
- Frame extraction
- Sequential analysis
- Timeline visualization
- Format support (MP4, WebM)

### Audit Logs ✅
- Logging all detections
- Filtering (type, result, date)
- Search & pagination
- Export (CSV, JSON)
- Statistics display

### Security ✅
- XSS protection
- SQL injection prevention
- Auth validation
- Input sanitization

### Performance ✅
- Processing speed
- Memory usage
- Large file handling
- Concurrent operations

## 🔧 Troubleshooting

### Tests fail with "Connection refused"
The dev server isn't running. Playwright will start it automatically, or you can start it manually:
```bash
npm run dev
```

### "Cannot find module" errors
Install dependencies:
```bash
npm install
```

### E2E tests can't find fixtures
Generate test fixtures:
```bash
npm run test:fixtures
```

### Component tests fail
Make sure Playwright browsers are installed:
```bash
npx playwright install
```

## 📚 Writing New Tests

### Unit Test (Vitest)
```typescript
// src/tests/myFeature.test.ts
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Component Test (Playwright)
```typescript
// src/tests/component/MyComponent.ct.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react';
import MyComponent from '../../components/MyComponent';

test('should render', async ({ mount }) => {
  const component = await mount(<MyComponent />);
  await expect(component).toBeVisible();
});
```

### E2E Test (Playwright)
```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('should complete workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DeepFake/);
});
```

## 🎉 Success Metrics

- ✅ 186 unit tests passing
- ✅ 8 component tests ready
- ✅ 25+ E2E scenarios
- ✅ ~2-4 minute full test suite
- ✅ CI/CD ready

## 📖 Full Documentation

See [Complete Testing Suite Documentation](./TESTING_SUITE_COMPLETE.md) for:
- Detailed test coverage breakdown
- CI/CD integration examples
- Best practices
- Advanced troubleshooting
- Future improvements
