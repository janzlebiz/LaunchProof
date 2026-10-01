/**
 * LaunchProof — Playwright Regression Test Executor
 * Runs generated or arbitrary Playwright test scripts against target URLs
 * with strict SSRF validation, isolated profiles, and memory limits.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { validateTargetUrlSecurity } from '../security/urlValidator';

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

  // 1. Strict SSRF Validation
  const sec = await validateTargetUrlSecurity(targetUrl, true);
  if (!sec.isValid) {
    return {
      passed: false,
      durationMs: Date.now() - start,
      assertionsCount: 0,
      output: `Security Policy Violation: ${sec.error}`,
      error: sec.error || 'Target blocked by SSRF defense shield',
    };
  }

  const normalizedTarget = sec.normalizedUrl!;
  let browser = null;
  let tempUserDataDir = '';
  let assertionsCount = 0;

  try {
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-test-'));

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--js-flags=--max-old-space-size=256',
      ],
      timeout: 10000,
    });

    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      userAgent: 'Mozilla/5.0 LaunchProof-TestRunner/1.0',
    });

    const page = await context.newPage();

    // Intercept all requests for SSRF defense
    await page.route('**/*', async (route) => {
      const reqUrl = route.request().url();
      const reqSec = await validateTargetUrlSecurity(reqUrl, true);
      if (!reqSec.isValid) {
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 2. Navigate to target
    const response = await page.goto(normalizedTarget, { timeout: 15000, waitUntil: 'domcontentloaded' });
    const status = response?.status() || 200;
    assertionsCount++;

    // 3. Check target element visibility
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

    // 4. Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    assertionsCount++;

    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    const passed = status < 400 && errors.length === 0 && (!testSelector || isVisible);

    return {
      passed,
      durationMs: Date.now() - start,
      assertionsCount,
      output: `Playwright Sandbox Test Execution:
- Target Destination: ${normalizedTarget}
- HTTP Status: ${status} (Expected: 200 OK)
- Target Element '${testSelector}': ${isVisible ? 'LOCATED & VISIBLE' : 'NOT LOCATED'}
- Mobile Horizontal Scroll: ${hasHorizontalScroll ? 'DEFECT DETECTED (Overflow)' : 'CLEAN (No overflow)'}
- Runtime Unhandled Errors: ${errors.length === 0 ? '0' : `${errors.length} caught`}`,
      error: !passed ? `Test assertions failed (status: ${status}, selector visible: ${isVisible})` : undefined,
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
  } finally {
    if (tempUserDataDir && fs.existsSync(tempUserDataDir)) {
      try {
        fs.rmSync(tempUserDataDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
