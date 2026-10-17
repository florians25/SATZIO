import { defineConfig, devices } from '@playwright/test';

/**
 * E2E gegen eine laufende Instanz (Standard: Vite-Preview auf 4173 mit API-Proxy,
 * oder Docker-Stack über E2E_BASE_URL=http://localhost:8080).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-viewport', use: { ...devices['iPhone 14'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
  ],
});
