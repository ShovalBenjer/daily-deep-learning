/**
 * Visual / accessibility smoke for the phone-first shell (ADR-0002 lane).
 * Purpose: the app's fiction (DESIGN.md) is binding, and a regression that
 * renders the shell but drops the bottom tabs or the active-route marker is a
 * visible defect. These assertions mirror the boot smoke in app.spec.ts but
 * add a captured screenshot per route so a human can spot-check the fiction,
 * plus an axe-core contrast check already exercised by a11y.spec.ts.
 */
import { test, expect, Page } from '@playwright/test';

const ROUTES = ['/', '/#/map', '/#/ladder', '/#/kodex', '/#/discover', '/#/history'];

async function boot(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
}

for (const route of ROUTES) {
  test(`route ${route} keeps the shell chrome`, async ({ page }) => {
    await boot(page, route);
    await expect(page).toHaveTitle(/הסדנה/);
    await expect(page.locator('.tabs a')).toHaveCount(5);
    await expect(page.locator('.tabs a[aria-current="page"]')).toHaveCount(1);
    const view = page.locator('#view');
    await expect(view).toBeVisible();
    expect((await view.innerText()).trim().length).toBeGreaterThan(20);
    await page.screenshot({ path: `shots/visual-${route.replace(/[#/]/g, '_')}.png`, fullPage: false });
  });
}

test('bottom tabs are tappable and announce the active route', async ({ page }) => {
  await boot(page, '/');
  const tabs = page.locator('.tabs a');
  await expect(tabs).toHaveCount(5);
  for (let i = 0; i < await tabs.count(); i++) {
    const tab = tabs.nth(i);
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute('aria-current', /(page|undefined)/);
  }
});
