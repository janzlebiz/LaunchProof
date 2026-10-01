/**
 * LaunchProof — Multimodal Gemini Vision AI Reasoning Engine
 * Analyzes real screenshot images and DOM context with strict Zod validation.
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { Finding, QACategory, Severity } from '../../src/types/audit';

const AiFindingSchema = z.object({
  title: z.string(),
  category: z.enum(['functionality', 'mobile', 'accessibility', 'performance', 'visual_ux', 'seo']),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.number().min(0.6).max(1.0),
  description: z.string(),
  impact: z.string(),
  recommendation: z.string(),
  checkId: z.string(),
  selector: z.string().optional(),
});

const AiResponseSchema = z.object({
  findings: z.array(AiFindingSchema),
});

export async function runGeminiMultimodalVisualReasoning(
  aiClient: GoogleGenAI | null,
  targetUrl: string,
  pageTitle: string,
  domSnippet: string,
  existingFindings: Finding[],
  screenshotBase64?: string
): Promise<Finding[]> {
  if (!aiClient) {
    // If no AI key or AI offline, return empty without fabricating evidence
    return [];
  }

  try {
    const textPrompt = `You are the LaunchProof Web Quality & Visual Reasoning Engine.
Inspect this website for pre-launch visual hierarchy, UX friction, responsive composition, or layout defects.
Target URL: ${targetUrl}
Page Title: ${pageTitle}

Existing deterministic findings already identified:
${existingFindings.map((f) => `- [${f.category}] ${f.title}`).join('\n')}

Parsed DOM context:
${domSnippet.slice(0, 3000)}

Rules:
1. Do NOT invent defects. Every finding MUST be grounded in visible layout or DOM structure.
2. Return ONLY strict JSON matching this schema:
{
  "findings": [
    {
      "title": "...",
      "category": "visual_ux" | "mobile" | "accessibility" | "functionality",
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

    const parts: any[] = [];
    if (screenshotBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: screenshotBase64,
        },
      });
    }
    parts.push({ text: textPrompt });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    const validated = AiResponseSchema.safeParse(parsed);

    if (!validated.success) return [];

    const newFindings: Finding[] = validated.data.findings.map((f) => ({
      id: `f_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      auditId: '',
      category: f.category as QACategory,
      checkId: f.checkId,
      severity: f.severity as Severity,
      confidence: f.confidence,
      title: f.title,
      description: f.description,
      impact: f.impact,
      recommendation: f.recommendation,
      source: 'ai_visual',
      url: targetUrl,
      evidence: [
        {
          id: `ev_ai_${Date.now()}`,
          type: 'screenshot',
          title: 'Gemini Multimodal Visual Reasoning',
          selector: f.selector || 'body',
          viewportName: 'Desktop 1440x900',
        },
      ],
      fingerprint: '',
      status: 'open',
    }));

    return newFindings;
  } catch (err) {
    console.warn('Gemini vision reasoning skipped or failed:', err);
    return [];
  }
}
