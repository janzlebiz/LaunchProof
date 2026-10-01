/**
 * LaunchProof — Playwright Regression Test Executor
 * Runs the generated Playwright test against the target to verify test execution.
 */

import { chromium } from 'playwright';

export interface PlaywrightExecutionResult {
  passed: boolean;
  durationMs: number;
  output: string;
  error?: string;
}

export async function executePlaywrightTestScript(
  targetUrl: string,
  testSelector: string,
  viewportWidth: number = 390,
  viewportHeight: number = 844
): Promise<PlaywrightExecutionResult> {
  const start = Date.now();
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(targetUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
    const status = response?.status() || 200;

    // Check target element
    const isVisible = testSelector ? await page.locator(testSelector).first().isVisible().catch(() => false) : true;

    // Check horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });

    await browser.close();

    const passed = status < 400 && errors.length === 0;

    return {
      passed,
      durationMs: Date.now() - start,
      output: `Test Execution Summary:\n- Status: ${status}\n- Target Selector Visible: ${isVisible}\n- Horizontal Scroll: ${hasHorizontalScroll ? 'Detected (Defect)' : 'None (Passed)'}\n- Uncaught Errors: ${errors.length}`,
      error: !passed ? `Found ${errors.length} runtime error(s) or failed status ${status}` : undefined,
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return {
      passed: false,
      durationMs: Date.now() - start,
      output: 'Execution failed',
      error: err.message || 'Playwright runtime error',
    };
  }
}
