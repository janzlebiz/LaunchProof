/**
 * LaunchProof — Real Retest & Fresh Evidence Comparison Engine
 * Executes a fresh audit against the target, extracts fresh evidence,
 * and performs strict diffing against the baseline audit.
 */

import { AuditConfig, AuditReport, Finding, RetestComparison } from '../../src/types/audit';
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

  const prevFingerprints = new Set(previousReport.findings.map((f) => f.fingerprint || f.checkId));
  const freshFingerprints = new Set(freshReport.findings.map((f) => f.fingerprint || f.checkId));

  const resolvedFindings: Finding[] = previousReport.findings.filter(
    (pf) => !freshFingerprints.has(pf.fingerprint || pf.checkId)
  );

  const persistingFindings: Finding[] = freshReport.findings.filter(
    (ff) => prevFingerprints.has(ff.fingerprint || ff.checkId)
  );

  const newFindings: Finding[] = freshReport.findings.filter(
    (ff) => !prevFingerprints.has(ff.fingerprint || ff.checkId)
  );

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
