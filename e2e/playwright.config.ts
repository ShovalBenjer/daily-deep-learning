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
  use: {
    baseURL: 'http://127.0.0.1:8080',
    // iPhone-sized chromium, not real WebKit: webkit's system deps need
    // sudo on this box (backlog row). Blink at 390x844 with touch is the
    // honest available approximation of the phone-first target.
    ...devices['iPhone 13'],
    defaultBrowserType: 'chromium',
    browserName: 'chromium',
  },
  webServer: {
    command: 'python3 -m http.server 8080 --bind 127.0.0.1',
    cwd: '..',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
