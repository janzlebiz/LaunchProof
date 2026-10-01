/**
 * LaunchProof — Fullstack Server & Job Orchestrator
 * Integrates real Playwright browser execution, axe-core, Gemini Vision,
 * fixture endpoints, network IP pinning, durable queue ledger, and concurrency gate.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupFixtureRoutes } from './server/fixtures/fixturePages';
import { validateTargetUrlSecurity } from './server/security/urlValidator';
import { runBrowserAuditWorker } from './server/engine/browserWorker';
import { runGeminiMultimodalVisualReasoning } from './server/engine/aiReasoner';
import { executeRealRetestComparison } from './server/engine/retestComparator';
import { executePlaywrightTestScript } from './server/engine/playwrightRunner';
import { runAllAutomatedTests } from './server/testSuite';
import { auditStore } from './server/storage/auditStore';
import { queueManager } from './server/storage/queueManager';
import { AuditConfig } from './src/types/audit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// Setup Live Fixture Target Routes
setupFixtureRoutes(app);

// Initialize GoogleGenAI SDK on server side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Endpoint: POST /api/audits
 * Starts a real isolated browser audit job with strict concurrency gating
 */
app.post('/api/audits', async (req, res) => {
  try {
    const { url, config } = req.body;
    if (!url) return res.status(400).json({ error: 'Target URL is required' });

    // 1. Concurrency Capacity Gate
    const capacity = auditStore.canAcceptNewJob();
    if (!capacity.allowed) {
      return res.status(429).json({ error: capacity.reason || 'Server busy: Maximum concurrent audits reached.' });
    }

    // 2. Rate Limiting Check
    const rate = auditStore.checkRateLimit(url);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Rate limit reached. Please wait ${rate.waitSeconds}s before auditing this domain again.` });
    }

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullConfig: AuditConfig = {
      targetUrl: url,
      maxPages: config?.maxPages || 5,
      maxDepth: config?.maxDepth || 2,
      timeoutMs: config?.timeoutMs || 25000,
      viewports: config?.viewports || [
        { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
        { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: true },
        { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
      ],
      enableA11y: config?.enableA11y !== false,
      enablePerformance: config?.enablePerformance !== false,
      enableAI: config?.enableAI !== false,
      enableExternalLinks: config?.enableExternalLinks !== false,
    };

    // Enqueue into Durable Queue Ledger
    const enqueueRes = queueManager.enqueueJob(auditId, url, fullConfig);
    if (!enqueueRes.success) {
      return res.status(429).json({ error: enqueueRes.reason });
    }

    const job = auditStore.registerJob(auditId, url);

    // Launch worker asynchronously
    (async () => {
      try {
        const { report, rawHtml, screenshotBase64Map } = await runBrowserAuditWorker(
          auditId,
          url,
          fullConfig,
          job.abortController.signal,
          (status, percent, msg, level) => {
            auditStore.updateJob(auditId, status, percent, msg, level);
            queueManager.updateJobProgress(auditId, status, percent, msg);
          }
        );

        // Run real Gemini Vision reasoning with screenshots
        if (fullConfig.enableAI && ai) {
          auditStore.updateJob(auditId, 'AI_REASONING', 88, 'Running Gemini Vision on real screenshot evidence...', 'info');
          const aiResult = await runGeminiMultimodalVisualReasoning(
            ai,
            url,
            report.pages[0]?.title || 'Target Page',
            rawHtml,
            report.findings,
            screenshotBase64Map['Desktop (1440x900)'] || screenshotBase64Map['Mobile (390x844)']
          );

          if (aiResult.findings.length > 0) {
            report.findings.push(...aiResult.findings);
          }
          report.summary.aiReasoningStatus = aiResult.status;
        }

        auditStore.completeJob(auditId, report);
        queueManager.finalizeJob(auditId, 'COMPLETED');
      } catch (err: any) {
        auditStore.failJob(auditId, err.message || 'Audit failed');
        queueManager.finalizeJob(auditId, 'FAILED', err.message);
      }
    })();

    return res.json({ auditId, status: 'QUEUED' });
  } catch (err: any) {
    console.error('Error creating audit:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

/**
 * Endpoint: GET /api/audits/:id
 */
app.get('/api/audits/:id', (req, res) => {
  const { id } = req.params;
  const job = auditStore.getJob(id);

  if (!job) {
    const report = auditStore.getReport(id);
    if (report) {
      return res.json({ id, status: 'COMPLETED', progressPercent: 100, report });
    }
    return res.status(404).json({ error: `Audit '${id}' not found` });
  }

  return res.json({
    id: job.auditId,
    targetUrl: job.targetUrl,
    status: job.status,
    progressPercent: job.progressPercent,
    currentMessage: job.currentMessage,
    logs: job.logs,
    report: job.report,
    error: job.error,
    startedAt: job.startedAt,
  });
});

/**
 * Endpoint: POST /api/audits/:id/cancel
 */
app.post('/api/audits/:id/cancel', (req, res) => {
  const { id } = req.params;
  const success = auditStore.cancelJob(id);
  queueManager.finalizeJob(id, 'CANCELLED', 'Cancelled by user');
  return res.json({ success, status: 'CANCELLED' });
});

/**
 * Endpoint: POST /api/audits/:id/retest
 * Performs a real re-audit against the target and computes before/after diff
 */
app.post('/api/audits/:id/retest', async (req, res) => {
  try {
    const { id } = req.params;
    const previousReport = auditStore.getReport(id);
    if (!previousReport) {
      return res.status(404).json({ error: `Base audit '${id}' not found for retest` });
    }

    const controller = new AbortController();
    const { freshReport, comparison } = await executeRealRetestComparison(
      previousReport,
      previousReport.config,
      controller.signal,
      () => {}
    );

    auditStore.completeJob(freshReport.id, freshReport);
    return res.json({ freshReport, comparison });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Retest failed' });
  }
});

/**
 * Endpoint: POST /api/playwright/execute
 * Runs generated Playwright test against target with strict SSRF validation
 */
app.post('/api/playwright/execute', async (req, res) => {
  try {
    const { url, selector } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const result = await executePlaywrightTestScript(url, selector || 'body');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Execution error' });
  }
});

/**
 * Endpoint: GET /api/audits/history
 */
app.get('/api/audits/history', (_req, res) => {
  return res.json({ history: auditStore.getAllReports() });
});

/**
 * Endpoint: POST /api/tests/run-all
 */
app.post('/api/tests/run-all', async (_req, res) => {
  try {
    const results = await runAllAutomatedTests();
    const allPassed = results.every((r) => r.passed);
    return res.json({ success: true, allPassed, suites: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed test suites' });
  }
});

/**
 * Endpoint: POST /api/security/validate
 */
app.post('/api/security/validate', async (req, res) => {
  const { url } = req.body;
  const result = await validateTargetUrlSecurity(url);
  return res.json(result);
});

/**
 * Endpoint: POST /api/gemini/fix-prompt
 */
app.post('/api/gemini/fix-prompt', async (req, res) => {
  try {
    const { finding, framework } = req.body;
    if (!finding) return res.status(400).json({ error: 'Finding payload required' });

    if (!ai) {
      return res.json({
        fixPrompt: `### Fix Defect: ${finding.title}\nTarget: ${finding.url}\nSeverity: ${finding.severity.toUpperCase()}\n\nProblem:\n${finding.description}\n\nRecommendation:\n${finding.recommendation}`,
      });
    }

    const prompt = `Generate an actionable, engineering-grade AI coding prompt to fix the following website defect in LaunchProof.
Framework: ${framework || 'React + Tailwind CSS'}
Finding:
${JSON.stringify(finding, null, 2)}

Requirements:
- Target exact files and DOM elements
- Step-by-step code change
- Responsive & accessibility constraints
- Instructions to add a Playwright regression test`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ fixPrompt: response.text });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed' });
  }
});

/**
 * Endpoint: POST /api/gemini/regression-test
 */
app.post('/api/gemini/regression-test', async (req, res) => {
  try {
    const { finding } = req.body;
    if (!finding) return res.status(400).json({ error: 'Finding payload required' });

    if (!ai) {
      return res.json({
        playwrightTest: `import { test, expect } from '@playwright/test';\n\ntest('regression: ${finding.title}', async ({ page }) => {\n  await page.goto('${finding.url}');\n  await expect(page.locator('${finding.evidence?.[0]?.selector || 'body'}')).toBeVisible();\n});`,
      });
    }

    const prompt = `Generate a production-ready Playwright TypeScript regression test for this confirmed QA finding:
${JSON.stringify(finding, null, 2)}

Use '@playwright/test' syntax with test.describe, expect assertions, viewport configuration, and error listener.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    let code = response.text || '';
    code = code.replace(/^```(typescript|ts)?\n/, '').replace(/\n```$/, '');

    return res.json({ playwrightTest: code });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed' });
  }
});

/**
 * Start Vite in middleware mode
 */
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LaunchProof] Fullstack Engine listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
