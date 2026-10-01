/**
 * AI Launch QA — Finding Deduplication & Fingerprinting Engine
 * Groups multiple observations of the same underlying defect and unifies evidence
 */

import { Finding } from '../../types/audit';

/**
 * Creates a deterministic fingerprint string for a finding
 */
export function generateFindingFingerprint(finding: Partial<Finding>): string {
  const category = (finding.category || 'unknown').toLowerCase();
  const checkId = (finding.checkId || 'general').toLowerCase();
  const url = (finding.url || '').split('?')[0].toLowerCase();
  
  // Extract primary selector from evidence if available
  const primarySelector =
    finding.evidence?.find((e) => e.selector)?.selector?.trim().toLowerCase() || '';

  const normalizedTitle = (finding.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .slice(0, 40);

  return `${category}::${checkId}::${url}::${primarySelector}::${normalizedTitle}`;
}

/**
 * Deduplicates an array of findings, merging duplicate evidence references and retaining higher confidence/severity
 */
export function deduplicateFindings(rawFindings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();

  const severityRank: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  for (const item of rawFindings) {
    const fingerprint = item.fingerprint || generateFindingFingerprint(item);
    
    if (!map.has(fingerprint)) {
      map.set(fingerprint, { ...item, fingerprint });
    } else {
      const existing = map.get(fingerprint)!;
      
      // Combine and deduplicate evidence items
      const combinedEvidence = [...existing.evidence];
      for (const ev of item.evidence) {
        if (!combinedEvidence.some((e) => e.id === ev.id || (e.selector && e.selector === ev.selector && e.type === ev.type))) {
          combinedEvidence.push(ev);
        }
      }

      // Upgrade severity if new finding has higher severity rank
      const highestSeverity =
        (severityRank[item.severity] || 0) > (severityRank[existing.severity] || 0)
          ? item.severity
          : existing.severity;

      // Keep the highest confidence score
      const highestConfidence = Math.max(existing.confidence, item.confidence);

      // Determine combined source
      const combinedSource =
        existing.source === item.source ? existing.source : 'combined';

      map.set(fingerprint, {
        ...existing,
        severity: highestSeverity,
        confidence: highestConfidence,
        source: combinedSource,
        evidence: combinedEvidence,
        recommendation: existing.recommendation || item.recommendation,
        impact: existing.impact || item.impact,
      });
    }
  }

  return Array.from(map.values());
}
