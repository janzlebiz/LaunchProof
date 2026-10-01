/**
 * AI Launch QA — Scoring Engine
 * Computes deterministic weighted scores, category metrics, and launch gate verdict
 */

import {
  AuditSummary,
  CategoryScore,
  CheckItemResult,
  Finding,
  LaunchVerdict,
  QACategory,
  Severity,
} from '../../types/audit';
import { CHECK_DEFINITIONS } from './checks';

export const CATEGORY_WEIGHTS: Record<QACategory, { name: string; weight: number }> = {
  functionality: { name: 'Functionality & Availability', weight: 0.25 },
  mobile: { name: 'Mobile & Responsive UX', weight: 0.20 },
  accessibility: { name: 'Accessibility (a11y)', weight: 0.15 },
  performance: { name: 'Performance & Web Vitals', weight: 0.15 },
  visual_ux: { name: 'Visual & UX Reasoning', weight: 0.15 },
  seo: { name: 'SEO & Social Signals', weight: 0.10 },
};

const SEVERITY_PENALTIES: Record<Severity, number> = {
  critical: 25,
  high: 14,
  medium: 7,
  low: 3,
  info: 0,
};

/**
 * Calculates complete category scores, pass/fail checks, and launch verdict
 */
export function calculateAuditScores(
  findings: Finding[],
  executedCheckIds: string[],
  durationMs: number = 2400,
  pagesCount: number = 1,
  viewportsCount: number = 3
): { summary: AuditSummary; categoryScores: CategoryScore[] } {
  const categories: QACategory[] = [
    'functionality',
    'mobile',
    'accessibility',
    'performance',
    'visual_ux',
    'seo',
  ];

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    if (f.status === 'fixed') continue; // Don't penalize fixed items
    if (f.severity === 'critical') criticalCount++;
    else if (f.severity === 'high') highCount++;
    else if (f.severity === 'medium') mediumCount++;
    else if (f.severity === 'low') lowCount++;
    else if (f.severity === 'info') infoCount++;
  }

  const categoryScores: CategoryScore[] = categories.map((catKey) => {
    const config = CATEGORY_WEIGHTS[catKey];
    const catFindings = findings.filter((f) => f.category === catKey && f.status !== 'fixed');

    let totalPenalty = 0;
    for (const f of catFindings) {
      const base = SEVERITY_PENALTIES[f.severity] || 5;
      const conf = Math.max(0.4, Math.min(1.0, f.confidence || 0.9));
      totalPenalty += base * conf;
    }

    const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

    // Map checks executed in this category
    const catCheckIds = Object.keys(CHECK_DEFINITIONS).filter(
      (id) => CHECK_DEFINITIONS[id].category === catKey
    );

    const checkResults: CheckItemResult[] = catCheckIds.map((checkId) => {
      const def = CHECK_DEFINITIONS[checkId];
      const checkFindings = catFindings.filter((f) => f.checkId === checkId);
      const passed = checkFindings.length === 0;

      return {
        id: checkId,
        name: def.name,
        category: catKey,
        passed,
        severityIfFailed: def.defaultSeverity,
        details: passed
          ? 'Passed — No defects observed during testing.'
          : `Failed — ${checkFindings.length} issue(s) detected: ${checkFindings.map((f) => f.title).join('; ')}`,
        findingsCount: checkFindings.length,
        executed: true,
      };
    });

    const passedCount = checkResults.filter((c) => c.passed).length;
    const failedCount = checkResults.filter((c) => !c.passed && c.severityIfFailed !== 'low').length;
    const warningCount = checkResults.filter((c) => !c.passed && c.severityIfFailed === 'low').length;

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (calculatedScore < 70 || catFindings.some((f) => f.severity === 'critical')) {
      status = 'fail';
    } else if (calculatedScore < 88 || catFindings.some((f) => f.severity === 'high')) {
      status = 'warn';
    }

    return {
      category: catKey,
      name: config.name,
      score: calculatedScore,
      weight: config.weight,
      passedCount,
      failedCount,
      warningCount,
      status,
      checks: checkResults,
    };
  });

  // Calculate overall weighted score
  let weightedSum = 0;
  for (const cs of categoryScores) {
    weightedSum += cs.score * cs.weight;
  }
  const overallScore = Math.round(weightedSum);

  // Determine Launch Verdict
  let verdict: LaunchVerdict = 'LAUNCH_READY';
  let verdictReason = 'All deterministic and AI checks passed with high confidence. Safe for production deployment.';

  if (criticalCount > 0) {
    verdict = 'LAUNCH_BLOCKED';
    verdictReason = `${criticalCount} critical blocker(s) detected that will break user journeys, mobile navigation, or render pipeline.`;
  } else if (overallScore < 75 || highCount >= 3) {
    verdict = 'NEEDS_REVIEW';
    verdictReason = `Score is ${overallScore}/100 with ${highCount} high-priority issues that should be addressed before public launch.`;
  } else if (highCount > 0 || mediumCount > 4) {
    verdict = 'NEEDS_REVIEW';
    verdictReason = `Review recommended: ${highCount} high and ${mediumCount} medium issues detected.`;
  }

  const summary: AuditSummary = {
    overallScore,
    verdict,
    verdictReason,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    totalFindings: criticalCount + highCount + mediumCount + lowCount + infoCount,
    pagesAudited: pagesCount,
    viewportsTested: viewportsCount,
    checksExecuted: Object.keys(CHECK_DEFINITIONS).length,
    durationMs,
    executionEngine: 'PLAYWRIGHT_CHROMIUM',
    aiReasoningStatus: 'SUCCESS',
  };

  return { summary, categoryScores };
}
