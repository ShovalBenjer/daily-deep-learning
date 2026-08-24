/**
 * @a11y: axe-core over the six routes. This replaces the max_warn-0
 * argument the a11y_ux waiver could never settle: axe's impact levels are
 * the industry floor, not a guessed warn budget. Critical and serious
 * violations fail; moderate and minor are printed so drift stays visible
 * without blocking on advisory findings.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = ['/', '/#/map', '/#/ladder', '/#/kodex', '/#/discover', '/#/history'];

for (const route of ROUTES) {
  test(`@a11y axe scan ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    const advisory = results.violations.filter(v => v.impact === 'moderate' || v.impact === 'minor');
    for (const v of advisory) {
      console.log(`advisory ${v.impact} on ${route}: ${v.id} x${v.nodes.length} (${v.help})`);
    }
    expect(
      blocking.map(v => `${v.impact} ${v.id} x${v.nodes.length}: ${v.help} [${v.nodes[0]?.target}]`),
      `blocking a11y violations on ${route}`,
    ).toEqual([]);
  });
}
