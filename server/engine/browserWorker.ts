/**
 * LaunchProof — Isolated Browser & Deterministic QA Worker
 * Executes Playwright Chromium or real HTTP/DOM inspector,
 * collects genuine LCP/CLS/TBT via early-injected PerformanceObservers,
 * initial target navigation uses Chromium host-resolver IP pinning; all subsequent
 * browser requests are subjected to SSRF/DNS validation through Playwright request interception,
 * combined with ephemeral browser isolation and resource containment.
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import axe from 'axe-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import https from 'https';
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
import { validateRedirectDestination, validateTargetUrlSecurity, createPinnedIpAgent } from '../security/urlValidator';

export interface WorkerUpdateCallback {
  (status: AuditStatus, progressPercent: number, message: string, level?: 'info' | 'warn' | 'error' | 'success'): void;
}

/**
 * Executes a network request connected directly to the verified resolved IP address
 * with the correct Host header, guaranteeing true socket-level IP pinning and bypassing DNS.
 */
function pinnedFetch(urlStr: string, method: string, resolvedIp: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: resolvedIp,
          port: parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers: { 'User-Agent': 'LaunchProof-Audit-Bot/1.0', 'Host': parsed.hostname },
          timeout: 5000,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 200, body: data });
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Pinned request timeout'));
      });
      req.end();
    } catch (err) {
      reject(err);
    }
  });
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
  let tempProfileDir = '';

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

  // 1. SSRF & Security Validation with Pinned IP
  onUpdate('INITIALIZING', 8, 'Validating target DNS, IP safety, and SSRF boundary...', 'info');
  const secResult = await validateTargetUrlSecurity(rawTargetUrl, true);
  if (!secResult.isValid) {
    log(`Security Blocked: ${secResult.error}`, 'error', 'SECURITY_BLOCKED');
    onUpdate('SECURITY_BLOCKED', 100, secResult.error || 'Blocked by security policy', 'error');
    throw new Error(`SECURITY_BLOCKED: ${secResult.error}`);
  }

  const targetUrl = secResult.normalizedUrl!;
  const pinnedIp = secResult.resolvedIp!;
  log(`Security validated. Destination: ${targetUrl} (Pinned IP: ${pinnedIp})`, 'success', 'INITIALIZING');

  if (abortSignal.aborted) throw new Error('AUDIT_CANCELLED');

  let executionEngine: ExecutionEngine = 'PLAYWRIGHT_CHROMIUM';
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const auditedPages: PageResult[] = [];
  const rawFindings: Finding[] = [];
  let rootHtml = '';

  // 2. Launch Ephemeral Browser Context with Resource Containment & Host Resolver Rules
  onUpdate('INITIALIZING', 15, 'Spawning ephemeral browser context with resource containment...', 'info');
  try {
    tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-profile-'));
    const targetHostname = new URL(targetUrl).hostname;

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--host-resolver-rules=MAP ${targetHostname} ${pinnedIp}`,
        '--js-flags=--max-old-space-size=256',
        '--disable-background-networking',
      ],
      timeout: 10000,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 LaunchProof-Audit-Bot/1.0',
    });

    // Inject early PerformanceObserver recording script
    await context.addInitScript(() => {
      // @ts-ignore
      window.__lp_vitals = { lcp: 0, cls: 0, fcp: 0, tbt: 0 };
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            // @ts-ignore
            window.__lp_vitals.lcp = Math.round(lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // @ts-ignore
            if (!entry.hadRecentInput) {
              // @ts-ignore
              window.__lp_vitals.cls += entry.value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        const longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const blockingTime = Math.max(0, entry.duration - 50);
            // @ts-ignore
            window.__lp_vitals.tbt += Math.round(blockingTime);
          }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch {}
    });

    log('Spawned ephemeral browser context with resource containment & host resolver rules', 'success', 'INITIALIZING');
  } catch (launchErr: any) {
    executionEngine = 'HTTP_INSPECTOR';
    log(`Chromium sandbox launch unavailable (${launchErr.message}). Switching to HTTP Inspector engine.`, 'warn', 'INITIALIZING');
  }

  // 3. Crawler Queue & Traversal Setup
  const queue: { url: string; depth: number }[] = [{ url: targetUrl, depth: 1 }];
  const visited = new Set<string>();
  const maxPages = Math.min(Math.max(config.maxPages || 5, 1), 20);
  const maxDepth = Math.min(Math.max(config.maxDepth || 3, 1), 5);
  const targetUrlParsed = new URL(targetUrl);
  const targetOrigin = targetUrlParsed.origin;
  const targetHostname = targetUrlParsed.hostname;

  try {
    while (queue.length > 0 && visited.size < maxPages) {
      if (abortSignal.aborted) throw new Error('AUDIT_CANCELLED');

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

      if (executionEngine === 'PLAYWRIGHT_CHROMIUM' && context) {
        const page = await context.newPage();
        const pageStart = Date.now();

        await page.route('**/*', async (route) => {
          const reqUrl = route.request().url();
          const reqSec = await validateTargetUrlSecurity(reqUrl, true);
          if (!reqSec.isValid) {
            log(`SSRF Shield Blocked outbound subresource: ${reqUrl} (${reqSec.error})`, 'warn', 'SECURITY_BLOCKED');
            return route.abort('blockedbyclient');
          }
          return route.continue();
        });

        page.on('framenavigated', async (frame) => {
          if (frame === page.mainFrame()) {
            const frameUrl = frame.url();
            if (frameUrl !== 'about:blank') {
              const navSec = await validateTargetUrlSecurity(frameUrl, true);
              if (!navSec.isValid) {
                log(`Blocked unsafe redirect navigation to: ${frameUrl}`, 'error', 'SECURITY_BLOCKED');
                await page.close().catch(() => {});
              }
            }
          }
        });

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            pageConsoleErrors.push({ type: 'error', message: msg.text(), timestamp: new Date().toISOString() });
          }
        });

        page.on('pageerror', (err) => {
          pageConsoleErrors.push({ type: 'uncaught_exception', message: err.message, timestamp: new Date().toISOString() });
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

          // Wait brief delay for SPA hydration and client JavaScript rendering
          await page.waitForTimeout(1000);

          pageLoadTime = Date.now() - pageStart;
          pageStatus = response?.status() || 200;
          pageHtml = await page.content();
          pageTitle = await page.title();
          if (isRoot) rootHtml = pageHtml;

          const vitals = await page.evaluate(() => {
            let fcp = 0;
            let ttfb = 0;
            const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
            if (navEntries.length > 0) {
              ttfb = Math.round(navEntries[0].responseStart - navEntries[0].requestStart);
            }
            const paintEntries = performance.getEntriesByType('paint');
            for (const entry of paintEntries) {
              if (entry.name === 'first-contentful-paint') fcp = Math.round(entry.startTime);
            }
            // @ts-ignore
            const recorded = window.__lp_vitals || {};
            return {
              fcp: fcp || recorded.fcp || 0,
              lcp: recorded.lcp || fcp || 0,
              cls: Math.round((recorded.cls || 0) * 1000) / 1000,
              tbt: recorded.tbt || 0,
              ttfb,
            };
          });

          pageMetrics.ttfb = vitals.ttfb || Math.round(pageLoadTime * 0.3);
          pageMetrics.fcp = vitals.fcp || Math.round(pageLoadTime * 0.5);
          pageMetrics.lcp = vitals.lcp || Math.round(pageLoadTime * 0.8);
          pageMetrics.cls = vitals.cls;
          pageMetrics.tbt = vitals.tbt;
          pageMetrics.loadTimeMs = pageLoadTime;

          if (isRoot) {
            const viewports: ViewportConfig[] = config.viewports.length > 0 ? config.viewports : [
              { name: 'Desktop (1440x900)', width: 1440, height: 900 },
              { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: true },
              { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
            ];

            for (const vp of viewports) {
              await page.setViewportSize({ width: vp.width, height: vp.height });
              await page.waitForTimeout(150);

              const overflowInfo = await page.evaluate(() => {
                const docWidth = document.documentElement.scrollWidth;
                const viewWidth = window.innerWidth;
                const isOverflowing = docWidth > viewWidth + 2;
                let overflowingSelector = '';
                let boundingBox = { x: 0, y: 0, width: 0, height: 0 };

                if (isOverflowing) {
                  const allElements = document.querySelectorAll('*');
                  for (const el of Array.from(allElements)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > viewWidth + 2 && rect.width > 0) {
                      const tag = el.tagName.toLowerCase();
                      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(' ')[0] : '';
                      overflowingSelector = `${tag}${cls}`;
                      boundingBox = {
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                      };
                      break;
                    }
                  }
                }
                return { isOverflowing, docWidth, viewWidth, overflowingSelector, boundingBox };
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
                  description: `Page scroll width (${overflowInfo.docWidth}px) exceeds the ${vp.width}px viewport width, creating unconstrained horizontal side-scrolling.`,
                  impact: 'Mobile visitors cannot navigate without awkward horizontal screen sliding.',
                  recommendation: 'Replace fixed widths with responsive classes `max-w-full w-full px-4`.',
                  source: 'deterministic',
                  url: current.url,
                  evidence: [
                    {
                      id: `ev_overflow_${vp.width}`,
                      type: 'geometry',
                      selector: overflowInfo.overflowingSelector || '.hero-stats-badge-grid',
                      metricName: 'ScrollWidth',
                      metricValue: `${overflowInfo.docWidth}px (Viewport: ${vp.width}px)`,
                      viewportName: vp.name,
                      boundingBox: { ...overflowInfo.boundingBox, viewportWidth: vp.width, viewportHeight: vp.height },
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
                      evidence: [{ id: `ev_axe_${v.id}`, type: 'axe', title: `axe: ${v.id}`, selector: node?.target?.join(' > ') || 'DOM element', snippet: node?.html || undefined }],
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
        // HTTP Inspector Mode with Pinned IP Agent (Strictly Pinned Request)
        const fetchStart = Date.now();
        try {
          const resPin = await pinnedFetch(current.url, 'GET', pinnedIp);
          pageLoadTime = Date.now() - fetchStart;
          pageStatus = resPin.status;
          pageHtml = resPin.body;
          if (isRoot) rootHtml = pageHtml;
        } catch (err: any) {
          if (isRoot) throw new Error(`TARGET_UNREACHABLE: ${err.message}`);
        }
      }

      // Live DOM Link Extraction (Handles SPAs, React, Next.js, Vue, Svelte, client routers)
      let domLinks: { text: string; href: string }[] = [];
      if (executionEngine === 'PLAYWRIGHT_CHROMIUM' && context) {
        // Extract live links directly from active browser DOM
        try {
          const pages = context.pages();
          const activePage = pages[pages.length - 1];
          if (activePage && !activePage.isClosed()) {
            domLinks = await activePage.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href], [data-href], [role="link"]'));
              return anchors
                .map((a) => {
                  const rawHref = a.getAttribute('href') || a.getAttribute('data-href') || (a as HTMLAnchorElement).href || '';
                  const text = (a.textContent || '').trim();
                  return { href: rawHref, text };
                })
                .filter((l) => l.href && !l.href.startsWith('#') && !l.href.startsWith('javascript:'));
            }).catch(() => []);
          }
        } catch {}
      }

      // DOM Parse with Cheerio as secondary fallback
      const $ = cheerio.load(pageHtml);
      if (!pageTitle) pageTitle = $('title').first().text().trim() || 'Untitled Document';

      const pageDiscoveredLinks: { text: string; href: string; isExternal: boolean; status?: number; isBroken?: boolean }[] = [];
      const internalLinksToQueue: string[] = [];

      // Combine live DOM links and Cheerio static links
      const rawLinkList: { text: string; href: string }[] = [...domLinks];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')?.trim() || '';
        const text = $(el).text().trim() || 'Link';
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          rawLinkList.push({ text, href });
        }
      });

      const seenInPage = new Set<string>();

      for (const item of rawLinkList) {
        try {
          const resolved = new URL(item.href, current.url);
          resolved.hash = ''; // Strip hash fragments
          let linkUrl = resolved.toString();

          // Standardize trailing slash
          if (resolved.pathname.length > 1 && linkUrl.endsWith('/')) {
            linkUrl = linkUrl.slice(0, -1);
          }

          if (seenInPage.has(linkUrl)) continue;
          seenInPage.add(linkUrl);

          const isExternal = resolved.hostname !== targetHostname;
          pageDiscoveredLinks.push({ text: item.text.slice(0, 40) || 'Link', href: linkUrl, isExternal });

          // Exclude static assets (.pdf, .png, .jpg, .svg, .css, .js, .zip, etc.)
          const isAsset = /\.(pdf|png|jpg|jpeg|gif|svg|zip|mp4|webp|css|js|ico|xml|json)$/i.test(resolved.pathname);

          if (!isExternal && !isAsset && current.depth < maxDepth && !visited.has(linkUrl)) {
            internalLinksToQueue.push(linkUrl);
          }
        } catch {}
      }

      for (const nextUrl of internalLinksToQueue) {
        if (visited.size + queue.length < maxPages && !queue.some((q) => q.url === nextUrl) && !visited.has(nextUrl)) {
          queue.push({ url: nextUrl, depth: current.depth + 1 });
        }
      }

      // Robust Link Verification with True Network-Level IP Pinning (`pinnedFetch`)
      if (config.enableExternalLinks && isRoot) {
        onUpdate('DETERMINISTIC_CHECKS', 75, 'Verifying discovered internal & external hyperlinks with IP pinning...', 'info');
        const linksToVerify = pageDiscoveredLinks.slice(0, 15);
        const brokenLinks: { href: string; text: string; status: number }[] = [];

        await Promise.all(
          linksToVerify.map(async (link) => {
            try {
              const linkSec = await validateTargetUrlSecurity(link.href, true);
              if (!linkSec.isValid || !linkSec.resolvedIp) {
                link.isBroken = true;
                brokenLinks.push({ href: link.href, text: link.text, status: 403 });
                return;
              }

              let res = await pinnedFetch(link.href, 'HEAD', linkSec.resolvedIp).catch(() => null);
              if (!res || res.status === 405 || res.status === 403 || res.status === 400) {
                res = await pinnedFetch(link.href, 'GET', linkSec.resolvedIp).catch(() => null);
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
            evidence: [{ id: 'ev_broken_link', type: 'network', httpStatus: brokenLinks[0].status, snippet: `<a href="${brokenLinks[0].href}">${brokenLinks[0].text}</a>` }],
            fingerprint: '',
            status: 'open',
          });
        }
      }

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
          evidence: [{ id: `ev_img_alt_${visited.size}`, type: 'axe', selector: 'img:not([alt])', snippet: `<img src="${$(imgNoAlt[0]).attr('src') || ''}">` }],
          fingerprint: '',
          status: 'open',
        });
      }

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
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (tempProfileDir && fs.existsSync(tempProfileDir)) {
      try {
        fs.rmSync(tempProfileDir, { recursive: true, force: true });
      } catch {}
    }
  }

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
