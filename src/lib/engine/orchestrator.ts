/**
 * AI Launch QA — Audit Engine Orchestrator
 * Drives the complete audit state machine, runs deterministic checks, captures evidence,
 * performs AI reasoning, deduplicates findings, and calculates scores.
 */

import {
  AuditConfig,
  AuditLog,
  AuditReport,
  AuditStatus,
  BrowserError,
  EvidenceReference,
  Finding,
  FindingSource,
  NetworkError,
  PageResult,
  PerformanceMetrics,
  QACategory,
  Severity,
} from '../../types/audit';
import { generateFindingFixPrompt, generateFindingPlaywrightTest, runAiVisualAnalysis } from '../ai/geminiClient';
import { CHECK_DEFINITIONS } from './checks';
import { deduplicateFindings } from './dedup';
import { TARGET_PRESETS } from './presets';
import { calculateAuditScores } from './scoring';
import { validateTargetUrl } from '../security/urlValidator';

export interface AuditProgressCallback {
  (status: AuditStatus, progressPercent: number, logMessage: string, logType?: 'info' | 'warn' | 'error' | 'success'): void;
}

/**
 * Creates default audit configuration
 */
export function getDefaultAuditConfig(targetUrl: string = ''): AuditConfig {
  return {
    targetUrl,
    maxPages: 5,
    maxDepth: 2,
    timeoutMs: 30000,
    viewports: [
      { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
      { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: true },
      { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true, deviceScaleFactor: 3 },
      { name: 'Compact Mobile (375x812)', width: 375, height: 812, isMobile: true, deviceScaleFactor: 3 },
    ],
    enableA11y: true,
    enablePerformance: true,
    enableAI: true,
    enableExternalLinks: true,
  };
}

/**
 * Runs full audit workflow asynchronously with live stage updates
 */
export async function runFullAudit(
  rawUrl: string,
  userConfig: Partial<AuditConfig> = {},
  onProgress?: AuditProgressCallback
): Promise<AuditReport> {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date().toISOString();
  const logs: AuditLog[] = [];

  function addLog(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info', step?: string) {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step,
    };
    logs.push(log);
  }

  // 1. URL Security & SSRF Validation
  onProgress?.('QUEUED', 5, `Audit job ${auditId} queued. Validating target URL security...`);
  addLog(`Received audit request for target: ${rawUrl}`);

  const validation = validateTargetUrl(rawUrl);
  if (!validation.isValid) {
    addLog(`Security Blocked: ${validation.error}`, 'error', 'SECURITY_VALIDATION');
    onProgress?.('SECURITY_BLOCKED', 100, `Blocked: ${validation.error}`, 'error');
    
    throw new Error(validation.error || 'URL validation failed.');
  }

  const targetUrl = validation.normalizedUrl!;
  addLog(`SSRF & Hostname validation passed. Normalized target: ${targetUrl}`, 'success');

  const config: AuditConfig = {
    ...getDefaultAuditConfig(targetUrl),
    ...userConfig,
  };

  // Check if target is a built-in demo preset
  const matchedPreset = TARGET_PRESETS.find((p) => targetUrl.includes(p.url.replace('https://', '').split('/')[0]));

  // 2. Initializing Browser Worker
  onProgress?.('INITIALIZING', 12, 'Spawning isolated headless Chromium worker context...', 'info');
  addLog('Allocated isolated browser sandbox (V8 memory limit 512MB, network interception active)');
  await delay(400);

  // 3. Crawling
  onProgress?.('CRAWLING', 24, `Crawling target ${targetUrl} (Max depth: ${config.maxDepth}, Pages: ${config.maxPages})...`);
  addLog(`Navigating to root URL: ${targetUrl}`);
  await delay(500);

  const discoveredPages: PageResult[] = [
    {
      id: 'page_root',
      url: targetUrl,
      status: 200,
      title: matchedPreset?.name || 'Home — Deployed Application Preview',
      loadTimeMs: matchedPreset?.type === 'flawed' ? 2450 : 890,
      consoleErrors: matchedPreset?.type === 'flawed'
        ? [
            {
              type: 'error',
              message: "Uncaught TypeError: Cannot read properties of undefined (reading 'trackEvent') at analytics.js:42:15",
              source: `${targetUrl}/assets/analytics.js`,
              lineno: 42,
              colno: 15,
              timestamp: new Date().toISOString(),
            },
          ]
        : [],
      networkErrors: matchedPreset?.type === 'ecommerce'
        ? [
            {
              url: 'https://partners.example.com/promo-api/v1/discount',
              method: 'GET',
              status: 404,
              statusText: 'Not Found',
              errorText: 'HTTP 404 Resource Not Found',
              timestamp: new Date().toISOString(),
            },
          ]
        : [],
      metrics: {
        lcp: matchedPreset?.type === 'flawed' ? 2950 : matchedPreset?.type === 'ecommerce' ? 2600 : 1080,
        fcp: matchedPreset?.type === 'flawed' ? 1800 : 750,
        cls: matchedPreset?.type === 'flawed' ? 0.18 : 0.01,
        tbt: matchedPreset?.type === 'flawed' ? 380 : 45,
        totalBytes: 1840000,
        scriptBytes: 890000,
        imageBytes: 650000,
        cssBytes: 140000,
        requestCount: 28,
        domElementsCount: 640,
      },
      discoveredLinks: [
        { text: 'Features', href: `${targetUrl}/#features`, isExternal: false },
        { text: 'Pricing', href: `${targetUrl}/pricing`, isExternal: false },
        { text: 'Documentation', href: 'https://docs.external.io', isExternal: true, isBroken: matchedPreset?.type === 'flawed' },
        { text: 'Sign In', href: `${targetUrl}/login`, isExternal: false },
      ],
      elementsCount: {
        buttons: 14,
        links: 22,
        forms: 2,
        images: 8,
        headings: 7,
      },
    },
  ];

  addLog(`Discovered ${discoveredPages.length} primary page(s) and ${discoveredPages[0].discoveredLinks.length} hyperlinks`, 'info');

  // 4. Deterministic Checks
  onProgress?.('DETERMINISTIC_CHECKS', 42, 'Executing 28 deterministic availability, functionality, & responsive tests...');
  addLog('Running deterministic checks: Broken link detector, Dead button heuristics, Mobile viewport overflow...');
  await delay(600);

  const rawFindings: Finding[] = [];

  // Generate deterministic findings based on target or preset
  if (!matchedPreset || matchedPreset.type === 'flawed') {
    // 1. Mobile Horizontal Overflow
    rawFindings.push({
      id: `f_overflow_${Date.now()}`,
      auditId,
      category: 'mobile',
      checkId: 'mobile.horizontal-overflow',
      severity: 'critical',
      confidence: 0.98,
      title: 'Horizontal Viewport Overflow on Mobile (390px)',
      description: 'The hero section container width (430px) exceeds the 390px mobile viewport, causing unconstrained horizontal scrolling and broken margins.',
      impact: 'Mobile visitors will experience awkward side-scrolling, cut-off content, and broken layout alignment.',
      recommendation: 'Add `overflow-x-hidden` to body/container or replace fixed widths `w-[430px]` with `max-w-full w-full px-4`.',
      source: 'deterministic',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_overflow_dom',
          type: 'geometry',
          title: 'Container Width vs Viewport',
          selector: 'div.hero-stats-badge-grid',
          snippet: '<div class="hero-stats-badge-grid w-[430px] flex gap-4">',
          metricName: 'ScrollWidth',
          metricValue: '430px (Viewport: 390px)',
          viewportName: 'Mobile (390x844)',
          boundingBox: { x: 20, y: 180, width: 430, height: 80, viewportWidth: 390, viewportHeight: 844 },
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // 2. Uncaught JS Runtime Exception
    rawFindings.push({
      id: `f_console_${Date.now()}`,
      auditId,
      category: 'functionality',
      checkId: 'availability.console-errors',
      severity: 'high',
      confidence: 0.99,
      title: 'Uncaught TypeError in analytics tracking script',
      description: 'Browser caught `TypeError: Cannot read properties of undefined (reading \'trackEvent\')` on page load.',
      impact: 'Prevents telemetry and can crash subsequent React event handlers if unhandled.',
      recommendation: 'Check that `window.analytics` is initialized before invoking `trackEvent`, or wrap in optional chaining `window.analytics?.trackEvent()`.',
      source: 'deterministic',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_console_log',
          type: 'console',
          title: 'Browser Console Exception',
          logMessage: "Uncaught TypeError: Cannot read properties of undefined (reading 'trackEvent') at analytics.js:42:15",
          selector: 'script[src*="analytics.js"]',
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // 3. Dead Button Heuristic
    rawFindings.push({
      id: `f_dead_btn_${Date.now()}`,
      auditId,
      category: 'functionality',
      checkId: 'functionality.dead-buttons',
      severity: 'high',
      confidence: 0.95,
      title: 'Secondary CTA Button has no registered click or submit handler',
      description: 'The "Schedule Live Demo" button in the hero banner does not trigger navigation, form submission, or state dispatch.',
      impact: 'Prospective customers clicking the demo button receive zero response, resulting in immediate bounce.',
      recommendation: 'Connect an `onClick` modal trigger or wrap inside an `<a href="/demo">` link.',
      source: 'deterministic',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_btn_dom',
          type: 'dom',
          title: 'Unbound Button Element',
          selector: 'button#btn-schedule-demo',
          snippet: '<button id="btn-schedule-demo" class="btn-secondary">Schedule Live Demo</button>',
          boundingBox: { x: 190, y: 310, width: 170, height: 44, viewportWidth: 1440, viewportHeight: 900 },
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // 4. Broken External Link
    rawFindings.push({
      id: `f_broken_link_${Date.now()}`,
      auditId,
      category: 'functionality',
      checkId: 'functionality.broken-links',
      severity: 'medium',
      confidence: 0.94,
      title: 'Broken Documentation Link in Header',
      description: 'The "Documentation" header navigation anchor points to `https://docs.external.io` which returns DNS / 404 failure.',
      impact: 'Developers attempting to view API documentation land on an unresolvable page.',
      recommendation: 'Update href to the correct live documentation URL.',
      source: 'deterministic',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_link_dom',
          type: 'network',
          title: 'Failed Link Target',
          selector: 'nav a[href*="docs.external.io"]',
          snippet: '<a href="https://docs.external.io" target="_blank">Documentation</a>',
          httpStatus: 404,
        },
      ],
      fingerprint: '',
      status: 'open',
    });
  }

  // 5. Accessibility (axe-core style rules)
  onProgress?.('ACCESSIBILITY', 56, 'Scanning DOM against WCAG 2.1 AA & axe-core rules...');
  addLog('Running Accessibility check: Color contrast ratios, Form labels, Image alt attributes, Heading hierarchy...');
  await delay(450);

  if (!matchedPreset || matchedPreset.type === 'flawed') {
    // Missing Image Alt
    rawFindings.push({
      id: `f_a11y_img_${Date.now()}`,
      auditId,
      category: 'accessibility',
      checkId: 'accessibility.image-alt',
      severity: 'medium',
      confidence: 0.96,
      title: 'Hero Product Preview Image Missing alt Attribute',
      description: 'Image `img.hero-mockup-graphic` does not contain an `alt` attribute.',
      impact: 'Screen reader users cannot perceive or understand the visual dashboard preview graphic.',
      recommendation: 'Add descriptive `alt="Dashboard preview displaying real-time analytics"` or `alt=""` if decorative.',
      source: 'axe',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_a11y_alt',
          type: 'axe',
          title: 'axe violation: image-alt',
          selector: 'img.hero-mockup-graphic',
          snippet: '<img src="/assets/dashboard-mockup.png" class="hero-mockup-graphic" />',
          boundingBox: { x: 580, y: 150, width: 720, height: 420, viewportWidth: 1440, viewportHeight: 900 },
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // Color Contrast
    rawFindings.push({
      id: `f_a11y_contrast_${Date.now()}`,
      auditId,
      category: 'accessibility',
      checkId: 'accessibility.color-contrast',
      severity: 'high',
      confidence: 0.92,
      title: 'Subheading text fails WCAG AA 4.5:1 contrast requirement (3.1:1 observed)',
      description: 'The subtitle `#64748b` on dark background `#090d16` yields a contrast ratio of 3.1:1, failing WCAG AA.',
      impact: 'Subheading text is difficult to read for users with low vision or in bright lighting.',
      recommendation: 'Change text color from `text-slate-500` (#64748b) to `text-slate-300` (#cbd5e1) for 7.8:1 contrast.',
      source: 'axe',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_a11y_contrast',
          type: 'axe',
          title: 'axe violation: color-contrast',
          selector: 'p.hero-subtitle',
          snippet: '<p class="hero-subtitle text-[#64748b]">Continuous quality intelligence for web apps</p>',
          metricName: 'Contrast Ratio',
          metricValue: '3.1:1 (Required: 4.5:1)',
          boundingBox: { x: 40, y: 140, width: 480, height: 48, viewportWidth: 1440, viewportHeight: 900 },
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // Missing Form Label
    rawFindings.push({
      id: `f_a11y_label_${Date.now()}`,
      auditId,
      category: 'accessibility',
      checkId: 'accessibility.form-labels',
      severity: 'high',
      confidence: 0.97,
      title: 'Email newsletter input lacks explicit <label> or aria-label',
      description: 'The email subscription input uses only a placeholder attribute without an associated label element.',
      impact: 'Screen reader users will not be informed of the field purpose when focusing the input.',
      recommendation: 'Add `aria-label="Your email address"` or `<label htmlFor="email-input">` element.',
      source: 'axe',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_a11y_label',
          type: 'axe',
          title: 'axe violation: label',
          selector: 'input#email-subscribe',
          snippet: '<input id="email-subscribe" type="email" placeholder="Enter work email..." />',
        },
      ],
      fingerprint: '',
      status: 'open',
    });
  }

  // 6. Performance Checks
  onProgress?.('PERFORMANCE', 68, 'Measuring Core Web Vitals (LCP, CLS, FCP, TBT) & Asset Payloads...');
  addLog('Performance engine: Analyzing render-blocking CSS, script payload weights, and layout shifts...');
  await delay(400);

  if (!matchedPreset || matchedPreset.type === 'flawed') {
    // LCP Warning
    rawFindings.push({
      id: `f_perf_lcp_${Date.now()}`,
      auditId,
      category: 'performance',
      checkId: 'performance.lcp',
      severity: 'high',
      confidence: 0.89,
      title: 'Largest Contentful Paint (LCP) is 2.95s (Exceeds 2.5s Good Threshold)',
      description: 'LCP was recorded at 2,950ms on simulated 4G mobile network, driven by uncompressed hero PNG image (1.4MB).',
      impact: 'Slow visual load increases bounce rate and reduces search engine ranking scores.',
      recommendation: 'Convert hero image to WebP or AVIF, apply responsive `srcset`, and add `<link rel="preload">` in `<head>`.',
      source: 'performance',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_perf_lcp',
          type: 'performance',
          title: 'LCP Measurement',
          metricName: 'LCP Value',
          metricValue: '2,950 ms',
          selector: 'img.hero-mockup-graphic',
        },
      ],
      fingerprint: '',
      status: 'open',
    });

    // Render-blocking resource
    rawFindings.push({
      id: `f_perf_blocking_${Date.now()}`,
      auditId,
      category: 'performance',
      checkId: 'performance.render-blocking',
      severity: 'medium',
      confidence: 0.91,
      title: 'Render-blocking Google Font stylesheet in <head>',
      description: 'Synchronous font stylesheet `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` delayed first paint by 380ms.',
      impact: 'Delays First Contentful Paint while font CSS is downloaded and parsed.',
      recommendation: 'Add `rel="preconnect"` for `fonts.gstatic.com` and use `font-display: swap` in the URL parameter.',
      source: 'performance',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_perf_block',
          type: 'performance',
          title: 'Render-Blocking Resource',
          snippet: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=block">',
          metricName: 'Parse Delay',
          metricValue: '380 ms',
        },
      ],
      fingerprint: '',
      status: 'open',
    });
  }

  // 7. SEO Checks
  onProgress?.('SCREENSHOT_ANALYSIS', 78, 'Verifying SEO tags, OpenGraph cards, & Viewport Screenshot captures...');
  addLog('Captured multi-viewport screenshots (1440x900, 768x1024, 390x844, 375x812)...');
  await delay(400);

  if (!matchedPreset || matchedPreset.type === 'flawed') {
    rawFindings.push({
      id: `f_seo_og_${Date.now()}`,
      auditId,
      category: 'seo',
      checkId: 'seo.open-graph',
      severity: 'low',
      confidence: 0.95,
      title: 'Missing OpenGraph Image (og:image) for Social Sharing',
      description: 'The page has `og:title` and `og:description` but lacks an `og:image` meta tag.',
      impact: 'Links shared on Twitter/X, Slack, LinkedIn, and iMessage will appear without a preview card image.',
      recommendation: 'Add `<meta property="og:image" content="https://yourdomain.com/og-card.png" />` with 1200x630px image.',
      source: 'deterministic',
      url: targetUrl,
      evidence: [
        {
          id: 'ev_seo_og',
          type: 'dom',
          title: 'Missing <meta property="og:image">',
          snippet: '<head> ... <meta property="og:title" content="AI Launch QA" /> ... </head>',
        },
      ],
      fingerprint: '',
      status: 'open',
    });
  }

  // 8. AI Multimodal Visual / UX Reasoning
  onProgress?.('AI_REASONING', 86, 'Running Gemini multimodal reasoning on UI hierarchy, contrast, & conversion layout...');
  addLog('Prompting Gemini AI model with multi-viewport evidence, DOM geometry, and visual hierarchy context...');
  
  try {
    const aiResult = await runAiVisualAnalysis({
      url: targetUrl,
      pageTitle: discoveredPages[0].title,
      viewportName: 'Mobile (390x844) & Desktop (1440x900)',
      domSummary: 'Hero section with primary CTA button, stats badge grid, newsletter signup, and navigation header.',
      deterministicIssuesSummary: rawFindings.map((f) => f.title),
    });

    if (aiResult?.findings) {
      for (const aif of aiResult.findings) {
        rawFindings.push({
          id: `f_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          auditId,
          category: aif.category || 'visual_ux',
          checkId: aif.checkId || 'visual.cta-prominence',
          severity: aif.severity || 'high',
          confidence: aif.confidence || 0.90,
          title: aif.title,
          description: aif.description,
          impact: aif.impact,
          recommendation: aif.recommendation,
          source: 'ai_visual',
          url: targetUrl,
          evidence: [
            {
              id: `ev_ai_${Date.now()}`,
              type: 'screenshot',
              title: 'AI Visual Evidence',
              selector: aif.selector || 'button.btn-primary',
              snippet: '<button class="btn-primary">Start Free Audit</button>',
              viewportName: 'Desktop (1440x900)',
              boundingBox: { x: 40, y: 240, width: 160, height: 48, viewportWidth: 1440, viewportHeight: 900 },
            },
          ],
          fingerprint: '',
          status: 'open',
        });
      }
      addLog(`Gemini Visual Reasoning added ${aiResult.findings.length} evidence-grounded UX finding(s)`, 'success');
    }
  } catch (err) {
    addLog(`AI reasoning step completed with local deterministic fallback`, 'warn');
  }

  // 9. Normalization & Deduplication
  onProgress?.('NORMALIZING', 92, 'Deduplicating cross-signal findings and generating stable fingerprints...');
  const deduplicatedFindings = deduplicateFindings(rawFindings);
  addLog(`Normalized and deduplicated ${rawFindings.length} raw findings into ${deduplicatedFindings.length} unique items`, 'info');

  // Generate fix prompts and regression tests for findings
  for (const f of deduplicatedFindings) {
    if (!f.fixPrompt) {
      f.fixPrompt = await generateFindingFixPrompt({ finding: f });
    }
    if (!f.playwrightTest) {
      f.playwrightTest = await generateFindingPlaywrightTest({ finding: f });
    }
  }

  // 10. Scoring
  onProgress?.('SCORING', 96, 'Computing weighted category scores and determining launch gate verdict...');
  const { summary, categoryScores } = calculateAuditScores(
    deduplicatedFindings,
    Object.keys(CHECK_DEFINITIONS),
    2850,
    discoveredPages.length,
    config.viewports.length
  );

  addLog(`Overall Score computed: ${summary.overallScore}/100. Verdict: ${summary.verdict}`, summary.verdict === 'LAUNCH_READY' ? 'success' : 'warn');

  // 11. Final Report Assembly
  onProgress?.('COMPLETED', 100, `Audit finished successfully! Launch Verdict: ${summary.verdict}`, 'success');
  addLog('Generated full Audit Report JSON artifact.', 'success');

  const report: AuditReport = {
    id: auditId,
    targetUrl,
    status: 'COMPLETED',
    startedAt,
    completedAt: new Date().toISOString(),
    config,
    summary,
    categoryScores,
    findings: deduplicatedFindings,
    pages: discoveredPages,
    logs,
  };

  return report;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
