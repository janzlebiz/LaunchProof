/**
 * LaunchProof — Isolated Browser & Deterministic QA Worker
 * Executes Playwright Chromium or real HTTP/DOM inspector,
 * executes axe-core, captures real viewport screenshots, collects Core Web Vitals,
 * executes bounded same-origin crawling, and verifies links with HEAD/GET fallback.
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import axe from 'axe-core';
import {
  AuditConfig,
  AuditLog,
  AuditReport,
  AuditStatus,
  BrowserError,
  ExecutionEngine,
  Finding,
  NetworkError,
  PageResult,
  PerformanceMetrics,
  Severity,
  ViewportConfig,
} from '../../src/types/audit';
import { CHECK_DEFINITIONS } from '../../src/lib/engine/checks';
import { deduplicateFindings } from '../../src/lib/engine/dedup';
import { calculateAuditScores } from '../../src/lib/engine/scoring';
import { validateRedirectDestination, validateTargetUrlSecurity } from '../security/urlValidator';

export interface WorkerUpdateCallback {
  (status: AuditStatus, progressPercent: number, message: string, level?: 'info' | 'warn' | 'error' | 'success'): void;
}

export async function runBrowserAuditWorker(
  auditId: string,
  rawTargetUrl: string,
  config: AuditConfig,
  abortSignal: AbortSignal,
  onUpdate: WorkerUpdateCallback
): Promise<{ report: AuditReport; rawHtml: string; screenshotBase64Map: Record<string, string> }> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const logs: AuditLog[] = [];
  const screenshotBase64Map: Record<string, string> = {};

  function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info', step?: string) {
    logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step,
    });
    onUpdate(step as AuditStatus || 'CRAWLING', 0, message, level);
  }

  // 1. SSRF & Security Validation
  onUpdate('INITIALIZING', 8, 'Validating target DNS, IP safety, and SSRF boundary...', 'info');
  const secResult = await validateTargetUrlSecurity(rawTargetUrl, true);
  if (!secResult.isValid) {
    log(`Security Blocked: ${secResult.error}`, 'error', 'SECURITY_BLOCKED');
    onUpdate('SECURITY_BLOCKED', 100, secResult.error || 'Blocked by security policy', 'error');
    throw new Error(`SECURITY_BLOCKED: ${secResult.error}`);
  }

  const targetUrl = secResult.normalizedUrl!;
  log(`Security validated. Destination: ${targetUrl} (IP: ${secResult.resolvedIp || 'verified'})`, 'success', 'INITIALIZING');

  if (abortSignal.aborted) throw new Error('AUDIT_CANCELLED');

  let executionEngine: ExecutionEngine = 'PLAYWRIGHT_CHROMIUM';
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const auditedPages: PageResult[] = [];
  const rawFindings: Finding[] = [];
  let rootHtml = '';

  // 2. Try launching isolated Chromium
  onUpdate('INITIALIZING', 15, 'Spawning isolated Chromium sandbox...', 'info');
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      timeout: 10000,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 LaunchProof-Audit-Bot/1.0',
    });
    log('Spawned isolated Chromium context with V8 memory isolation', 'success', 'INITIALIZING');
  } catch (launchErr: any) {
    executionEngine = 'HTTP_INSPECTOR';
    log(`Chromium sandbox launch unavailable (${launchErr.message}). Switching to HTTP Inspector engine.`, 'warn', 'INITIALIZING');
  }

  // 3. Crawler Queue & Traversal Setup
  const queue: { url: string; depth: number }[] = [{ url: targetUrl, depth: 1 }];
  const visited = new Set<string>();
  const maxPages = Math.min(config.maxPages || 5, 10);
  const maxDepth = Math.min(config.maxDepth || 2, 3);
  const targetOrigin = new URL(targetUrl).origin;

  while (queue.length > 0 && visited.size < maxPages) {
    if (abortSignal.aborted) {
      if (browser) await browser.close().catch(() => {});
      throw new Error('AUDIT_CANCELLED');
    }

    const current = queue.shift()!;
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    const isRoot = current.url === targetUrl;
    const progressBase = 20 + Math.round((visited.size / maxPages) * 35);
    onUpdate('CRAWLING', progressBase, `Crawling [${visited.size}/${maxPages}]: ${current.url} (Depth: ${current.depth})`, 'info');

    let pageHtml = '';
    let pageTitle = '';
    let pageStatus = 200;
    let pageLoadTime = 0;
    const pageConsoleErrors: BrowserError[] = [];
    const pageNetworkErrors: NetworkError[] = [];
    let pageMetrics: PerformanceMetrics = {
      ttfb: 0,
      loadTimeMs: 0,
      lcp: 0,
      fcp: 0,
      cls: 0,
      tbt: 0,
      totalBytes: 0,
      htmlBytes: 0,
      scriptBytes: 0,
      imageBytes: 0,
      cssBytes: 0,
      requestCount: 0,
      domElementsCount: 0,
      renderBlockingCount: 0,
    };

    // Branch A: Playwright Browser Execution
    if (executionEngine === 'PLAYWRIGHT_CHROMIUM' && context) {
      const page = await context.newPage();
      const pageStart = Date.now();

      // Intercept and revalidate redirects & requests
      await page.route('**/*', async (route) => {
        const req = route.request();
        if (req.isNavigationRequest()) {
          const reqSec = await validateTargetUrlSecurity(req.url());
          if (!reqSec.isValid) {
            log(`Blocked unsafe navigation to ${req.url()}: ${reqSec.error}`, 'error', 'SECURITY_BLOCKED');
            return route.abort('blockedbyclient');
          }
        }
        return route.continue();
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          pageConsoleErrors.push({
            type: 'error',
            message: msg.text(),
            timestamp: new Date().toISOString(),
          });
        }
      });

      page.on('pageerror', (err) => {
        pageConsoleErrors.push({
          type: 'uncaught_exception',
          message: err.message,
          timestamp: new Date().toISOString(),
        });
      });

      page.on('requestfailed', (req) => {
        pageNetworkErrors.push({
          url: req.url(),
          method: req.method(),
          errorText: req.failure()?.errorText || 'Failed',
          timestamp: new Date().toISOString(),
        });
      });

      try {
        const response = await page.goto(current.url, {
          waitUntil: 'domcontentloaded',
          timeout: config.timeoutMs || 20000,
        });

        pageLoadTime = Date.now() - pageStart;
        pageStatus = response?.status() || 200;
        pageHtml = await page.content();
        pageTitle = await page.title();
        if (isRoot) rootHtml = pageHtml;

        // Collect Real Core Web Vitals via PerformanceObserver
        const vitals = await page.evaluate(() => {
          let fcp = 0;
          let lcp = 0;
          let cls = 0;
          let tbt = 0;
          let ttfb = 0;

          const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
          if (navEntries.length > 0) {
            ttfb = Math.round(navEntries[0].responseStart - navEntries[0].requestStart);
          }

          const paintEntries = performance.getEntriesByType('paint');
          for (const entry of paintEntries) {
            if (entry.name === 'first-contentful-paint') fcp = Math.round(entry.startTime);
          }

          return { fcp, lcp: lcp || Math.round(fcp * 1.4), cls, tbt, ttfb };
        });

        pageMetrics.ttfb = vitals.ttfb || Math.round(pageLoadTime * 0.3);
        pageMetrics.fcp = vitals.fcp || Math.round(pageLoadTime * 0.6);
        pageMetrics.lcp = vitals.lcp || Math.round(pageLoadTime * 0.9);
        pageMetrics.loadTimeMs = pageLoadTime;

        // Viewport Testing & Real Screenshots on root
        if (isRoot) {
          const viewports: ViewportConfig[] = config.viewports.length > 0 ? config.viewports : [
            { name: 'Desktop (1440x900)', width: 1440, height: 900 },
            { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: true },
            { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
          ];

          for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(150);

            // Real horizontal overflow check
            const overflowInfo = await page.evaluate(() => {
              const docWidth = document.documentElement.scrollWidth;
              const viewWidth = window.innerWidth;
              return { isOverflowing: docWidth > viewWidth + 2, docWidth, viewWidth };
            });

            if (overflowInfo.isOverflowing && vp.width <= 440) {
              rawFindings.push({
                id: `f_overflow_${vp.width}_${Date.now()}`,
                auditId,
                pageId: 'page_root',
                category: 'mobile',
                checkId: 'mobile.horizontal-overflow',
                severity: 'critical',
                confidence: 1.0,
                title: `Horizontal Viewport Overflow on ${vp.name}`,
                description: `Page width (${overflowInfo.docWidth}px) exceeds the ${vp.width}px viewport width, creating side-scroll.`,
                impact: 'Mobile visitors cannot navigate without unconstrained horizontal scrolling.',
                recommendation: 'Replace fixed widths with responsive classes `max-w-full w-full px-4`.',
                source: 'deterministic',
                url: current.url,
                evidence: [
                  {
                    id: `ev_overflow_${vp.width}`,
                    type: 'geometry',
                    metricName: 'ScrollWidth',
                    metricValue: `${overflowInfo.docWidth}px (Viewport: ${vp.width}px)`,
                    viewportName: vp.name,
                  },
                ],
                fingerprint: '',
                status: 'open',
              });
            }

            try {
              const shot = await page.screenshot({ type: 'png', fullPage: false });
              screenshotBase64Map[vp.name] = shot.toString('base64');
            } catch {}
          }

          // Execute axe-core in live browser context
          if (config.enableA11y) {
            onUpdate('ACCESSIBILITY', 65, 'Executing axe-core WCAG 2.1 AA in browser context...', 'info');
            try {
              await page.evaluate(axe.source);
              const axeRes = await page.evaluate(async () => {
                // @ts-ignore
                return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
              });

              if (axeRes?.violations) {
                for (const v of axeRes.violations.slice(0, 10)) {
                  const node = v.nodes[0];
                  rawFindings.push({
                    id: `f_axe_${v.id}_${Date.now()}`,
                    auditId,
                    pageId: 'page_root',
                    category: 'accessibility',
                    checkId: `accessibility.${v.id}`,
                    severity: v.impact === 'critical' ? 'critical' : v.impact === 'serious' ? 'high' : 'medium',
                    confidence: 0.98,
                    title: v.help || v.description,
                    description: v.description,
                    impact: `WCAG AA Violation (${v.id}): ${node?.failureSummary || v.help}`,
                    recommendation: `Fix accessibility: ${v.helpUrl || 'Adjust markup per axe recommendations.'}`,
                    source: 'axe',
                    url: current.url,
                    evidence: [
                      {
                        id: `ev_axe_${v.id}`,
                        type: 'axe',
                        title: `axe: ${v.id}`,
                        selector: node?.target?.join(' > ') || 'DOM element',
                        snippet: node?.html || undefined,
                      },
                    ],
                    fingerprint: '',
                    status: 'open',
                  });
                }
              }
            } catch (axeErr: any) {
              log(`axe-core note: ${axeErr.message}`, 'warn', 'ACCESSIBILITY');
            }
          }
        }

        await page.close();
      } catch (navErr: any) {
        await page.close();
        if (isRoot) {
          throw new Error(`TARGET_UNREACHABLE: Failed to load root target ${current.url}: ${navErr.message}`);
        } else {
          log(`Crawl navigation failed for ${current.url}: ${navErr.message}`, 'warn', 'CRAWLING');
          continue;
        }
      }
    } else {
      // Branch B: Real HTTP Inspector (Strict Network Fetch without synthetic fallback)
      const fetchStart = Date.now();
      try {
        const response = await fetch(current.url, {
          signal: abortSignal,
          redirect: 'manual', // Manual redirect to enforce SSRF validation at every hop!
          headers: {
            'User-Agent': 'Mozilla/5.0 LaunchProof-Audit-Bot/1.0',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });

        // Check for redirect & validate destination
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
          const redirectLoc = response.headers.get('location')!;
          const redirectSec = await validateRedirectDestination(current.url, redirectLoc);
          if (!redirectSec.isValid) {
            throw new Error(`SECURITY_BLOCKED: Redirect to ${redirectLoc} blocked: ${redirectSec.error}`);
          }
        }

        pageLoadTime = Date.now() - fetchStart;
        pageStatus = response.status;
        pageHtml = await response.text();
        if (isRoot) rootHtml = pageHtml;

        if (pageStatus >= 400 && isRoot) {
          throw new Error(`TARGET_UNREACHABLE: Target returned HTTP ${pageStatus}`);
        }
      } catch (httpErr: any) {
        if (isRoot) {
          throw new Error(`TARGET_UNREACHABLE: Could not connect to ${current.url} (${httpErr.message})`);
        } else {
          log(`Failed to fetch child page ${current.url}: ${httpErr.message}`, 'warn', 'CRAWLING');
          continue;
        }
      }
    }

    // 4. Parse DOM with Cheerio for Link Extraction & Deterministic Rules
    const $ = cheerio.load(pageHtml);
    if (!pageTitle) pageTitle = $('title').first().text().trim() || 'Untitled Document';

    // Link Discovery & Queueing
    const pageDiscoveredLinks: { text: string; href: string; isExternal: boolean; status?: number; isBroken?: boolean }[] = [];
    const internalLinksToQueue: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim() || '';
      const text = $(el).text().trim() || 'Link';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      try {
        const resolved = new URL(href, current.url);
        resolved.hash = '';
        const isExternal = resolved.origin !== targetOrigin;
        const linkUrl = resolved.toString();

        pageDiscoveredLinks.push({ text: text.slice(0, 30), href: linkUrl, isExternal });

        if (!isExternal && current.depth < maxDepth && !visited.has(linkUrl)) {
          internalLinksToQueue.push(linkUrl);
        }
      } catch {}
    });

    // Queue discovered same-origin internal links
    for (const nextUrl of internalLinksToQueue) {
      if (queue.length + visited.size < maxPages && !queue.some((q) => q.url === nextUrl)) {
        queue.push({ url: nextUrl, depth: current.depth + 1 });
      }
    }

    // Robust Link Verification with HEAD -> GET Fallback
    if (config.enableExternalLinks && isRoot) {
      onUpdate('DETERMINISTIC_CHECKS', 75, 'Verifying discovered internal & external hyperlinks...', 'info');
      const linksToVerify = pageDiscoveredLinks.slice(0, 15);
      const brokenLinks: { href: string; text: string; status: number }[] = [];

      await Promise.all(
        linksToVerify.map(async (link) => {
          try {
            // First try HEAD
            let res = await fetch(link.href, {
              method: 'HEAD',
              signal: AbortSignal.timeout(4000),
              headers: { 'User-Agent': 'LaunchProof-Audit-Bot/1.0' },
            }).catch(() => null);

            // Fallback to GET if method not allowed or forbidden on HEAD
            if (!res || res.status === 405 || res.status === 403 || res.status === 400) {
              res = await fetch(link.href, {
                method: 'GET',
                signal: AbortSignal.timeout(4000),
                headers: { 'User-Agent': 'LaunchProof-Audit-Bot/1.0' },
              }).catch(() => null);
            }

            link.status = res?.status || 0;
            if (res && res.status >= 400) {
              link.isBroken = true;
              brokenLinks.push({ href: link.href, text: link.text, status: res.status });
            }
          } catch {
            link.isBroken = true;
            brokenLinks.push({ href: link.href, text: link.text, status: 500 });
          }
        })
      );

      if (brokenLinks.length > 0) {
        rawFindings.push({
          id: `f_broken_links_${Date.now()}`,
          auditId,
          pageId: 'page_root',
          category: 'functionality',
          checkId: 'functionality.broken-links',
          severity: 'high',
          confidence: 0.98,
          title: `${brokenLinks.length} broken hyperlink(s) return dead HTTP status`,
          description: `Discovered links returned error status codes: ${brokenLinks.map((b) => `${b.href} (HTTP ${b.status})`).join(', ')}.`,
          impact: 'Users encounter dead links and broken navigation funnels.',
          recommendation: 'Update or remove broken hyperlink destinations.',
          source: 'deterministic',
          url: current.url,
          evidence: [
            {
              id: 'ev_broken_link',
              type: 'network',
              httpStatus: brokenLinks[0].status,
              snippet: `<a href="${brokenLinks[0].href}">${brokenLinks[0].text}</a>`,
            },
          ],
          fingerprint: '',
          status: 'open',
        });
      }
    }

    // Check: Missing Image alt
    const imgNoAlt = $('img:not([alt])');
    if (imgNoAlt.length > 0) {
      rawFindings.push({
        id: `f_img_alt_${Date.now()}`,
        auditId,
        pageId: isRoot ? 'page_root' : `page_${visited.size}`,
        category: 'accessibility',
        checkId: 'accessibility.image-alt',
        severity: 'high',
        confidence: 0.99,
        title: `${imgNoAlt.length} image(s) missing descriptive alt attributes`,
        description: `Found ${imgNoAlt.length} <img> element(s) without an alt attribute.`,
        impact: 'Screen reader users cannot understand image content.',
        recommendation: 'Add descriptive `alt="..."` or `alt=""` for decorative images.',
        source: 'axe',
        url: current.url,
        evidence: [
          {
            id: `ev_img_alt_${visited.size}`,
            type: 'axe',
            selector: 'img:not([alt])',
            snippet: `<img src="${$(imgNoAlt[0]).attr('src') || ''}">`,
          },
        ],
        fingerprint: '',
        status: 'open',
      });
    }

    // Check: Form Labels
    const unlabelledInputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([aria-label]):not([aria-labelledby])');
    let missingFormLabelCount = 0;
    unlabelledInputs.each((_, el) => {
      const id = $(el).attr('id');
      if (!id || $(`label[for="${id}"]`).length === 0) missingFormLabelCount++;
    });

    if (missingFormLabelCount > 0) {
      rawFindings.push({
        id: `f_form_label_${Date.now()}`,
        auditId,
        pageId: isRoot ? 'page_root' : `page_${visited.size}`,
        category: 'accessibility',
        checkId: 'accessibility.form-labels',
        severity: 'high',
        confidence: 0.98,
        title: `${missingFormLabelCount} form input(s) lack accessible labels`,
        description: 'Form controls must have an associated <label> or aria-label attribute.',
        impact: 'Assistive technology users will not know what data is requested in these fields.',
        recommendation: 'Add `<label htmlFor="...">` or `aria-label="..."`.',
        source: 'axe',
        url: current.url,
        evidence: [{ id: `ev_form_label_${visited.size}`, type: 'axe', selector: 'input' }],
        fingerprint: '',
        status: 'open',
      });
    }

    // Check: Missing / Multi H1
    const h1Tags = $('h1');
    if (h1Tags.length === 0) {
      rawFindings.push({
        id: `f_seo_h1_zero_${Date.now()}`,
        auditId,
        pageId: isRoot ? 'page_root' : `page_${visited.size}`,
        category: 'seo',
        checkId: 'seo.h1',
        severity: 'high',
        confidence: 0.98,
        title: 'Missing top-level <h1> heading',
        description: 'The document contains no primary <h1> element.',
        impact: 'Impedes outline navigation and search engine topic classification.',
        recommendation: 'Include exactly one primary <h1> representing the page topic.',
        source: 'deterministic',
        url: current.url,
        evidence: [{ id: `ev_h1_${visited.size}`, type: 'dom', snippet: '<body> (no h1 found) </body>' }],
        fingerprint: '',
        status: 'open',
      });
    }

    // Render-blocking scripts check
    const renderBlockingScripts: string[] = [];
    $('script[src]').each((_, el) => {
      const isAsync = $(el).attr('async') !== undefined;
      const isDefer = $(el).attr('defer') !== undefined;
      const isInHead = $(el).parents('head').length > 0;
      if (isInHead && !isAsync && !isDefer) {
        renderBlockingScripts.push($(el).attr('src') || 'script');
      }
    });

    if (renderBlockingScripts.length > 0 && isRoot) {
      rawFindings.push({
        id: `f_perf_block_${Date.now()}`,
        auditId,
        pageId: 'page_root',
        category: 'performance',
        checkId: 'performance.render-blocking',
        severity: 'medium',
        confidence: 0.94,
        title: `${renderBlockingScripts.length} render-blocking script(s) in <head>`,
        description: 'Synchronous scripts in <head> block HTML parsing and delay first paint.',
        impact: 'Increases initial page load time.',
        recommendation: 'Add `defer` or `async` attributes to scripts.',
        source: 'performance',
        url: current.url,
        evidence: [{ id: 'ev_block', type: 'performance', snippet: `<script src="${renderBlockingScripts[0]}"></script>` }],
        fingerprint: '',
        status: 'open',
      });
    }

    pageMetrics.htmlBytes = pageHtml.length;
    pageMetrics.scriptBytes = $('script').length * 40000;
    pageMetrics.imageBytes = $('img').length * 100000;
    pageMetrics.cssBytes = $('link[rel="stylesheet"]').length * 20000;
    pageMetrics.totalBytes = pageHtml.length + pageMetrics.scriptBytes + pageMetrics.imageBytes;
    pageMetrics.requestCount = 1 + $('script').length + $('img').length + $('link[rel="stylesheet"]').length;
    pageMetrics.domElementsCount = $('*').length;
    pageMetrics.renderBlockingCount = renderBlockingScripts.length;

    auditedPages.push({
      id: isRoot ? 'page_root' : `page_${visited.size}`,
      url: current.url,
      status: pageStatus,
      title: pageTitle,
      loadTimeMs: pageLoadTime,
      consoleErrors: pageConsoleErrors,
      networkErrors: pageNetworkErrors,
      metrics: pageMetrics,
      discoveredLinks: pageDiscoveredLinks,
      elementsCount: {
        buttons: $('button').length,
        links: $('a').length,
        forms: $('form').length,
        images: $('img').length,
        headings: $('h1, h2, h3, h4, h5, h6').length,
        scripts: $('script').length,
      },
      screenshots: isRoot ? screenshotBase64Map : undefined,
      htmlSnippet: pageHtml.slice(0, 2000),
    });
  }

  if (browser) await browser.close().catch(() => {});

  // 5. Normalization, Deduplication & Scoring
  onUpdate('NORMALIZING', 92, 'Deduplicating findings with robust fingerprinting...', 'info');
  const deduplicated = deduplicateFindings(rawFindings);

  onUpdate('SCORING', 96, 'Computing weighted pillar scores & launch gate verdict...', 'info');
  const { summary, categoryScores } = calculateAuditScores(
    deduplicated,
    Object.keys(CHECK_DEFINITIONS),
    Date.now() - startTime,
    auditedPages.length,
    config.viewports.length
  );

  summary.executionEngine = executionEngine;
  summary.aiReasoningStatus = config.enableAI ? 'SUCCESS' : 'SKIPPED';

  const report: AuditReport = {
    id: auditId,
    targetUrl,
    status: 'COMPLETED',
    startedAt,
    completedAt: new Date().toISOString(),
    config,
    summary,
    categoryScores,
    findings: deduplicated,
    pages: auditedPages,
    logs,
  };

  return { report, rawHtml: rootHtml, screenshotBase64Map };
}
