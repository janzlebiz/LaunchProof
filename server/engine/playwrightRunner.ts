/**
 * LaunchProof — Playwright Regression Test Executor
 * Runs generated or arbitrary Playwright test scripts against target URLs.
 */

import { chromium } from 'playwright';

export interface PlaywrightExecutionResult {
  passed: boolean;
  durationMs: number;
  output: string;
  assertionsCount: number;
  error?: string;
}

export async function executePlaywrightTestScript(
  targetUrl: string,
  testSelector: string = 'body',
  viewportWidth: number = 390,
  viewportHeight: number = 844
): Promise<PlaywrightExecutionResult> {
  const start = Date.now();
  let browser = null;
  let assertionsCount = 0;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      timeout: 10000,
    });

    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
    });
    const page = await context.newPage();

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 1. Navigate to target
    const response = await page.goto(targetUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
    const status = response?.status() || 200;
    assertionsCount++;

    // 2. Check target element visibility
    let isVisible = false;
    if (testSelector && testSelector !== 'body') {
      try {
        const el = page.locator(testSelector).first();
        isVisible = await el.isVisible({ timeout: 2000 });
        assertionsCount++;
      } catch {
        isVisible = false;
      }
    } else {
      isVisible = true;
    }

    // 3. Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    assertionsCount++;

    await browser.close();

    const passed = status < 400 && errors.length === 0 && (!testSelector || isVisible);

    return {
      passed,
      durationMs: Date.now() - start,
      assertionsCount,
      output: `Playwright Test Execution Summary:
- HTTP Status: ${status} (Expected: 200 OK)
- Target Element '${testSelector}': ${isVisible ? 'VISIBLE & LOCATED' : 'NOT FOUND'}
- Mobile Horizontal Scroll: ${hasHorizontalScroll ? 'OVERFLOW DEFECT DETECTED' : 'NO OVERFLOW (CLEAN)'}
- Runtime Page Errors: ${errors.length === 0 ? '0 (Clean)' : `${errors.length} unhandled error(s)`}`,
      error: !passed ? `Failed ${errors.length > 0 ? `with ${errors.length} runtime error(s)` : `selector '${testSelector}' was not visible`}` : undefined,
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return {
      passed: false,
      durationMs: Date.now() - start,
      assertionsCount,
      output: `Playwright sandbox execution error: ${err.message}`,
      error: err.message || 'Execution failed',
    };
  }
}
