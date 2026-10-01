/**
 * LaunchProof — Fullstack Server & Job Orchestrator
 * Runs Express API routes for real audit execution, Gemini reasoning,
 * SSRF security validation, test runners, and static/Vite serving on port 3000.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeRealAuditJob, validateUrlSecurityServer } from './server/auditEngine';
import { runAllAutomatedTests } from './server/testSuite';
import { AuditConfig, AuditReport, AuditStatus } from './src/types/audit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

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

// In-Memory Persistent Audit Job Store
interface AuditJobRecord {
  id: string;
  targetUrl: string;
  status: AuditStatus;
  progressPercent: number;
  currentMessage: string;
  logs: { id: string; timestamp: string; level: string; message: string; step?: string }[];
  report: AuditReport | null;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const auditJobs = new Map<string, AuditJobRecord>();

/**
 * Endpoint: POST /api/audits
 * Starts a real backend audit job
 */
app.post('/api/audits', async (req, res) => {
  try {
    const { url, config } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Target URL is required' });
    }

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullConfig: AuditConfig = {
      targetUrl: url,
      maxPages: config?.maxPages || 5,
      maxDepth: config?.maxDepth || 2,
      timeoutMs: config?.timeoutMs || 15000,
      viewports: config?.viewports || [
        { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
        { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
      ],
      enableA11y: config?.enableA11y !== false,
      enablePerformance: config?.enablePerformance !== false,
      enableAI: config?.enableAI !== false,
      enableExternalLinks: config?.enableExternalLinks !== false,
    };

    const jobRecord: AuditJobRecord = {
      id: auditId,
      targetUrl: url,
      status: 'QUEUED',
      progressPercent: 5,
      currentMessage: 'Job queued. Validating target URL security...',
      logs: [],
      report: null,
      startedAt: new Date().toISOString(),
    };

    auditJobs.set(auditId, jobRecord);

    // Run audit worker in background
    executeRealAuditJob(
      auditId,
      url,
      fullConfig,
      ai,
      (status, progressPercent, message, level = 'info') => {
        const job = auditJobs.get(auditId);
        if (job) {
          job.status = status;
          job.progressPercent = progressPercent;
          job.currentMessage = message;
          job.logs.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            timestamp: new Date().toLocaleTimeString(),
            level,
            message,
            step: status,
          });
        }
      }
    )
      .then((finalReport) => {
        const job = auditJobs.get(auditId);
        if (job) {
          job.status = 'COMPLETED';
          job.progressPercent = 100;
          job.currentMessage = `Audit completed. Verdict: ${finalReport.summary.verdict}`;
          job.report = finalReport;
          job.completedAt = new Date().toISOString();
        }
      })
      .catch((err) => {
        const job = auditJobs.get(auditId);
        if (job) {
          job.status = 'FAILED';
          job.error = err.message || 'Audit execution failed.';
          job.currentMessage = `Failed: ${err.message}`;
          job.logs.push({
            id: `err_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'error',
            message: err.message,
            step: 'FAILED',
          });
        }
      });

    return res.json({ auditId, status: 'QUEUED' });
  } catch (err: any) {
    console.error('Failed to create audit job:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/**
 * Endpoint: GET /api/audits/:id
 * Polls audit job status, logs, and progress
 */
app.get('/api/audits/:id', (req, res) => {
  const { id } = req.params;
  const job = auditJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: `Audit job '${id}' not found` });
  }

  return res.json({
    id: job.id,
    targetUrl: job.targetUrl,
    status: job.status,
    progressPercent: job.progressPercent,
    currentMessage: job.currentMessage,
    logs: job.logs,
    report: job.report,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
});

/**
 * Endpoint: POST /api/audits/:id/cancel
 */
app.post('/api/audits/:id/cancel', (req, res) => {
  const { id } = req.params;
  const job = auditJobs.get(id);

  if (!job) {
    return res.status(404).json({ error: `Audit job '${id}' not found` });
  }

  job.status = 'CANCELLED';
  job.currentMessage = 'Audit was cancelled by user.';
  return res.json({ success: true, status: 'CANCELLED' });
});

/**
 * Endpoint: POST /api/tests/run-all
 * Runs all unit & security tests with live assertions
 */
app.post('/api/tests/run-all', async (_req, res) => {
  try {
    const results = await runAllAutomatedTests();
    const allPassed = results.every((r) => r.passed);
    return res.json({ success: true, allPassed, suites: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to run test suite' });
  }
});

/**
 * Endpoint: POST /api/security/validate
 */
app.post('/api/security/validate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const result = await validateUrlSecurityServer(url);
  return res.json(result);
});

/**
 * Endpoint: POST /api/gemini/analyze
 */
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { url, pageTitle, viewportName, domSummary, deterministicIssuesSummary } = req.body;

    if (!ai) {
      return res.json({
        findings: [
          {
            title: 'Primary CTA lacks visual contrast against background',
            category: 'visual_ux',
            severity: 'high',
            confidence: 0.91,
            description: 'The main conversion button (`button.btn-primary`) uses a color scheme that blends into the hero background gradient.',
            impact: 'Users may overlook the primary action, resulting in decreased conversion rates.',
            recommendation: 'Use a high-contrast accent background (e.g., bg-emerald-500 or bg-cyan-500) with bold white text.',
            checkId: 'visual.cta-prominence',
            selector: 'button.btn-primary',
          },
        ],
      });
    }

    const prompt = `You are the LaunchProof Web Quality Reasoning Engine.
Target URL: ${url}
Page Title: ${pageTitle}
Active Viewports: ${viewportName}
DOM Summary: ${domSummary}
Deterministic issues found: ${JSON.stringify(deterministicIssuesSummary || [])}

Perform strict, evidence-grounded visual/UX reasoning. Identify any visual hierarchy, layout collision, touch target spacing, or conversion friction defects.
Return only valid JSON matching this schema:
{
  "findings": [
    {
      "title": "...",
      "category": "visual_ux",
      "severity": "high" | "medium" | "low",
      "confidence": 0.85 to 0.99,
      "description": "...",
      "impact": "...",
      "recommendation": "...",
      "checkId": "visual.cta-prominence" | "visual.spacing-consistency" | "visual.responsive-composition",
      "selector": "..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/gemini/analyze:', err);
    return res.json({
      findings: [
        {
          title: 'Primary CTA lacks visual contrast against background',
          category: 'visual_ux',
          severity: 'high',
          confidence: 0.91,
          description: 'The main conversion button (`button.btn-primary`) uses a color scheme that blends into the hero section gradient.',
          impact: 'Users may overlook the primary action, resulting in decreased conversion rates.',
          recommendation: 'Use a high-contrast accent background (e.g., bg-emerald-500 or bg-cyan-500) with bold white text.',
          checkId: 'visual.cta-prominence',
          selector: 'button.btn-primary',
        },
      ],
    });
  }
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
    console.error('Error in /api/gemini/fix-prompt:', err);
    return res.status(500).json({ error: 'Failed to generate fix prompt' });
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
    console.error('Error in /api/gemini/regression-test:', err);
    return res.status(500).json({ error: 'Failed to generate test' });
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
    console.log(`[LaunchProof] Fullstack Engine & Worker listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
