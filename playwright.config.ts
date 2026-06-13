import { defineConfig, devices } from '@playwright/test';

/**
 * SecurePass — Playwright Configuration
 *
 * Run all E2E tests: npx playwright test
 * Run with UI:       npx playwright test --ui
 * Run headed:        npx playwright test --headed
 * Show report:       npx playwright show-report
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // Run serially to avoid DB conflicts in tests
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Start dev servers automatically if not already running
  // webServer: [
  //   {
  //     command: 'cd backend && npm run dev',
  //     url: 'http://localhost:4000/api/health',
  //     reuseExistingServer: true,
  //     timeout: 30_000,
  //   },
  //   {
  //     command: 'cd frontend && npm run dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: true,
  //     timeout: 30_000,
  //   },
  // ],
});
