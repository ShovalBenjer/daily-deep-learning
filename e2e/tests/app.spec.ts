/**
 * Boot-and-render smoke for the six routes the old flow.py audit covered.
 * Purpose: a route that silently stops rendering (the callsite-oracle
 * failure class, seen live on writing/the-bench) must fail here, not in a
 * human's thumb. Console errors fail the test: the app's own boot survives
 * partial data by design, so a thrown error is never expected noise.
 */
import { test, expect, Page } from '@playwright/test';

const ROUTES = ['/', '/#/map', '/#/ladder', '/#/kodex', '/#/discover', '/#/history'];

async function boot(page: Page, route: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  return errors;
}

for (const route of ROUTES) {
  test(`route ${route} boots and renders`, async ({ page }) => {
    const errors = await boot(page, route);
    await expect(page).toHaveTitle(/הסדנה/);
    // the app shell: bottom tabs present and the view carries real content
    await expect(page.locator('.tabs a')).toHaveCount(5);
    const view = page.locator('#view');
    await expect(view).toBeVisible();
    expect((await view.innerText()).trim().length, `#view is empty on ${route}`).toBeGreaterThan(20);
    // the active tab announces itself (landed 2026-08-24, the e2e waiver's own fix)
    await expect(page.locator('.tabs a[aria-current="page"]')).toHaveCount(1);
    expect(errors, `console errors on ${route}: ${errors.join(' | ')}`).toEqual([]);
  });
}

test('tapping a tab actually changes the view', async ({ page }) => {
  await boot(page, '/');
  const before = await page.locator('#view').innerText();
  await page.locator('#tab-kodex').tap();
  await page.waitForTimeout(400);
  const after = await page.locator('#view').innerText();
  expect(after).not.toEqual(before);
  await expect(page.locator('#tab-kodex[aria-current="page"]')).toHaveCount(1);
});
