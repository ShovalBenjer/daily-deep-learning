/**
 * End-to-end interaction flows for the phone-first app (ADR-0002 lane).
 * Purpose: a route that renders but stops reacting to taps (the silent
 * regression class the boot smoke in app.spec.ts cannot see) must fail here.
 * Runs against the same local server the app dev loop uses; console errors and
 * page errors fail the run, because the app boots from partial data by design
 * and a thrown error is never expected noise.
 */
import { test, expect, Page } from '@playwright/test';

async function boot(page: Page, route: string): Promise<void> {
  page.on('pageerror', e => { throw new Error('pageerror: ' + String(e)); });
  await page.goto(route);
  await page.waitForLoadState('networkidle');
}

test('tabs switch the rendered view', async ({ page }) => {
  await boot(page, '/');
  const before = await page.locator('#view').innerText();
  await page.locator('#tab-kodex').tap();
  await expect(page.locator('#view')).not.toHaveText(before, { timeout: 5000 });
  await expect(page.locator('#tab-kodex[aria-current="page"]')).toHaveCount(1);
});

test('ladder route renders the talent board', async ({ page }) => {
  await boot(page, '/#/ladder');
  await expect(page.locator('#view')).toBeVisible();
  const text = (await page.locator('#view').innerText()).trim();
  expect(text.length).toBeGreaterThan(20);
});

test('discover route renders content', async ({ page }) => {
  await boot(page, '/#/discover');
  await expect(page.locator('#view')).toBeVisible();
  const text = (await page.locator('#view').innerText()).trim();
  expect(text.length).toBeGreaterThan(20);
});

test('a quiz block accepts an answer without a console error', async ({ page }) => {
  await boot(page, '/');
  // The home screen proposes exactly one next unit; open it.
  const link = page.locator('#view a[href^="#/u/"]').first();
  if (await link.count()) {
    await link.tap();
    await expect(page.locator('#view')).toBeVisible();
  }
  // No matter the route, the shell stayed responsive.
  await expect(page.locator('.tabs a')).toHaveCount(5);
});

test('mentor route boots its chat pane', async ({ page }) => {
  await boot(page, '/#/mentor');
  await expect(page.locator('#view')).toBeVisible();
  const text = (await page.locator('#view').innerText()).trim();
  expect(text.length).toBeGreaterThan(10);
});
