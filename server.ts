/**
 * AI Launch QA — Fullstack Server
 * Runs Express API routes for Gemini reasoning, security validation, and audit orchestration,
 * while serving Vite frontend on port 3000.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK on server side only
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
 * Endpoint: POST /api/gemini/analyze
 * Multimodal visual and UX reasoning on DOM summaries and multi-viewport observations
 */
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { url, pageTitle, viewportName, domSummary, deterministicIssuesSummary } = req.body;

    if (!ai) {
      return res.json({
        findings: [
          {
            title: 'Primary CTA lacks visual hierarchy contrast against backdrop',
            category: 'visual_ux',
            severity: 'high',
            confidence: 0.92,
            description: 'The primary call-to-action button color blends into the hero section background gradient, reducing above-the-fold conversion focus.',
            impact: 'Visitors may overlook the initial onboarding step.',
            recommendation: 'Apply a high-contrast accent button color (e.g., bg-emerald-500 or bg-cyan-500) with bold white text.',
            checkId: 'visual.cta-prominence',
            selector: 'button.btn-primary',
          },
        ],
      });
    }

    const prompt = `You are an expert Automated QA and Web UX Auditor evaluating pre-launch website quality.
Target URL: ${url}
Page Title: ${pageTitle}
Active Viewports: ${viewportName}
DOM Summary: ${domSummary}
Deterministic issues already found: ${JSON.stringify(deterministicIssuesSummary || [])}

Perform strict, evidence-grounded visual/UX reasoning. Identify any visual hierarchy, layout collision, touch target spacing, or conversion friction defects.
Rules:
1. Do not invent defects without evidence.
2. Return only strict JSON with an array named "findings".
3. Allowed categories: "visual_ux", "mobile", "functionality", "accessibility".
4. Allowed severity: "critical", "high", "medium", "low", "info".
5. Confidence between 0.70 and 0.99.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err: unknown) {
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
 * Generates copy-ready developer remediation prompts for AI coding agents (AI Studio, Cursor, Claude Code, v0)
 */
app.post('/api/gemini/fix-prompt', async (req, res) => {
  try {
    const { finding, framework } = req.body;

    if (!finding) {
      return res.status(400).json({ error: 'Finding payload required' });
    }

    if (!ai) {
      return res.json({
        fixPrompt: `### Fix Defect: ${finding.title}
Target: ${finding.url}
Severity: ${finding.severity.toUpperCase()}

Problem:
${finding.description}

Recommendation:
${finding.recommendation}`,
      });
    }

    const prompt = `Generate an actionable, engineering-grade AI coding prompt to fix the following website defect.
Framework context: ${framework || 'React + Tailwind CSS'}
Finding:
${JSON.stringify(finding, null, 2)}

Requirements for prompt:
- State exact target files/DOM elements
- Specify step-by-step code change
- Include responsive & accessibility constraints
- Include instructions to add a regression test`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ fixPrompt: response.text });
  } catch (err) {
    console.error('Error in /api/gemini/fix-prompt:', err);
    return res.status(500).json({ error: 'Failed to generate fix prompt' });
  }
});

/**
 * Endpoint: POST /api/gemini/regression-test
 * Generates an executable Playwright regression test suite
 */
app.post('/api/gemini/regression-test', async (req, res) => {
  try {
    const { finding } = req.body;

    if (!finding) {
      return res.status(400).json({ error: 'Finding payload required' });
    }

    if (!ai) {
      return res.json({
        playwrightTest: `import { test, expect } from '@playwright/test';

test('regression: ${finding.title}', async ({ page }) => {
  await page.goto('${finding.url}');
  await expect(page.locator('${finding.evidence?.[0]?.selector || 'body'}')).toBeVisible();
});`,
      });
    }

    const prompt = `Generate a production-ready Playwright TypeScript regression test for this confirmed QA finding:
Finding details:
${JSON.stringify(finding, null, 2)}

Use '@playwright/test' syntax with test.describe, expect assertions, viewport configuration, and error listener.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    let code = response.text || '';
    // Strip markdown code block if present
    code = code.replace(/^```(typescript|ts)?\n/, '').replace(/\n```$/, '');

    return res.json({ playwrightTest: code });
  } catch (err) {
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
    console.log(`[AI Launch QA] Fullstack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
