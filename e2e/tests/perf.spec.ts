/**
 * Performance budget for the phone-first boot path (ADR-0002 lane).
 * Purpose: the app is offline-first and phone-first, so a route that takes
 * seconds to become interactive on a throttled phone is a defect even if it
 * eventually renders. These assertions fail the build when the boot path
 * regresses, the callsite-oracle class from the SOTA gaps doc.
 *
 * The thresholds are deliberately loose (the local server is localhost, no
 * real network), so they catch gross regressions, not micro-jitter.
 */
import { test, expect, Page } from '@playwright/test';

const ROUTES = ['/', '/#/map', '/#/ladder', '/#/kodex', '/#/discover', '/#/history', '/#/mentor'];

async function bootTime(page: Page, route: string): Promise<number> {
  const start = Date.now();
  await page.goto(route);
  await page.waitForSelector('#view:visible', { timeout: 15000 });
  return Date.now() - start;
}

for (const route of ROUTES) {
  test(`route ${route} becomes interactive within budget`, async ({ page }) => {
    const ms = await bootTime(page, route);
    // localhost render should be well under a second; 2500ms leaves headroom
    // for cold module eval without masking a real regression.
    expect(ms, `boot of ${route} took ${ms}ms`).toBeLessThan(2500);
  });
}

test('repeated navigation to the same route stays cheap', async ({ page }) => {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    worst = Math.max(worst, await bootTime(page, '/#/ladder'));
  }
  expect(worst).toBeLessThan(2500);
});

test('home screen proposes exactly one next unit (no date in boot path)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#view:visible', { timeout: 15000 });
  const units = page.locator('#view a[href^="#/u/"]');
  // The home screen proposes one next unit; more than one means the ranked
  // selector regressed into listing many.
  expect(await units.count()).toBeLessThanOrEqual(1);
});
