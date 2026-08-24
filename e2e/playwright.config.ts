/**
 * The self-contained e2e lane (ADR-0002): replaces the private-repo flow.py
 * dependency that kept the e2e/a11y_ux/pipeline waivers alive. Runs the
 * same command locally and in CI; webServer serves the repo root exactly
 * the way AGENTS.md's own dev loop does.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['iPhone 13'],
        browserName: 'firefox',
      },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8080 --bind 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
