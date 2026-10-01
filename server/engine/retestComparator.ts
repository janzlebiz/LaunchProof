/**
 * LaunchProof — Real Retest & Fresh Evidence Comparison Engine
 * Executes a fresh audit against the target, extracts fresh evidence,
 * and performs strict diffing against the baseline audit.
 */

import { AuditConfig, AuditReport, Finding, RetestComparison } from '../../src/types/audit';
import { generateFindingFingerprint } from '../../src/lib/engine/dedup';
import { runBrowserAuditWorker } from './browserWorker';

export async function executeRealRetestComparison(
  previousReport: AuditReport,
  config: AuditConfig,
  abortSignal: AbortSignal,
  onUpdate: (status: string, percent: number, msg: string) => void
): Promise<{ freshReport: AuditReport; comparison: RetestComparison }> {
  const freshAuditId = `retest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Run a completely fresh audit on the target
  const { report: freshReport } = await runBrowserAuditWorker(
    freshAuditId,
    previousReport.targetUrl,
    config,
    abortSignal,
    (status, percent, msg) => onUpdate(status, percent, msg)
  );

  // Derive stable fingerprints for all baseline and fresh findings
  const prevFingerprints = new Map<string, Finding>();
  for (const pf of previousReport.findings) {
    const fp = pf.fingerprint || generateFindingFingerprint(pf);
    prevFingerprints.set(fp, pf);
  }

  const freshFingerprints = new Map<string, Finding>();
  for (const ff of freshReport.findings) {
    const fp = ff.fingerprint || generateFindingFingerprint(ff);
    freshFingerprints.set(fp, ff);
  }

  const resolvedFindings: Finding[] = [];
  for (const [fp, pf] of prevFingerprints.entries()) {
    if (!freshFingerprints.has(fp)) {
      resolvedFindings.push({ ...pf, status: 'fixed' });
    }
  }

  const persistingFindings: Finding[] = [];
  const newFindings: Finding[] = [];

  for (const [fp, ff] of freshFingerprints.entries()) {
    if (prevFingerprints.has(fp)) {
      persistingFindings.push(ff);
    } else {
      newFindings.push(ff);
    }
  }

  const scoreDelta = freshReport.summary.overallScore - previousReport.summary.overallScore;

  const comparison: RetestComparison = {
    beforeAuditId: previousReport.id,
    afterAuditId: freshReport.id,
    beforeScore: previousReport.summary.overallScore,
    afterScore: freshReport.summary.overallScore,
    scoreDelta,
    beforeVerdict: previousReport.summary.verdict,
    afterVerdict: freshReport.summary.verdict,
    resolvedFindings,
    persistingFindings,
    newFindings,
  };

  return { freshReport, comparison };
}
