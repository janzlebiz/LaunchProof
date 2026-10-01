/**
 * LaunchProof — Automated Test Suite & Quality Gate
 * Executes automated unit, security, deduplication, and scoring tests
 */

import { validateUrlSecurityServer } from './auditEngine';
import { generateFindingFingerprint, deduplicateFindings } from '../src/lib/engine/dedup';
import { calculateAuditScores } from '../src/lib/engine/scoring';
import { CHECK_DEFINITIONS } from '../src/lib/engine/checks';
import { Finding, TestSuiteResult } from '../src/types/audit';

export async function runAllAutomatedTests(): Promise<TestSuiteResult[]> {
  const suites: TestSuiteResult[] = [];

  // Suite 1: SSRF & URL Security Tests
  const secStart = Date.now();
  const securityTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];

  const dangerousTargets = [
    { url: 'http://localhost:3000', shouldBlock: true, reason: 'Localhost blocked' },
    { url: 'http://127.0.0.1:8080', shouldBlock: true, reason: 'Loopback IPv4 blocked' },
    { url: 'http://10.0.0.1/admin', shouldBlock: true, reason: 'Private RFC1918 10.0.0.0/8 blocked' },
    { url: 'http://172.16.0.1', shouldBlock: true, reason: 'Private RFC1918 172.16.0.0/12 blocked' },
    { url: 'http://192.168.1.1/router', shouldBlock: true, reason: 'Private RFC1918 192.168.0.0/16 blocked' },
    { url: 'http://169.254.169.254/latest/meta-data', shouldBlock: true, reason: 'Cloud metadata IP blocked' },
    { url: 'file:///etc/passwd', shouldBlock: true, reason: 'file:// protocol blocked' },
    { url: 'javascript:alert(1)', shouldBlock: true, reason: 'javascript: protocol blocked' },
    { url: 'https://example.com', shouldBlock: false, reason: 'Public HTTPS domain allowed' },
  ];

  for (const t of dangerousTargets) {
    const res = await validateUrlSecurityServer(t.url);
    const passed = t.shouldBlock ? !res.isValid : res.isValid;
    securityTests.push({
      name: `Validate ${t.url} (${t.reason})`,
      passed,
      error: passed ? undefined : `Expected ${t.shouldBlock ? 'blocked' : 'allowed'}, but got: ${res.error || 'allowed'}`,
      details: res.error || `Normalized: ${res.normalizedUrl}`,
    });
  }

  suites.push({
    name: 'Security & SSRF Hardening Suite',
    passed: securityTests.every((t) => t.passed),
    durationMs: Date.now() - secStart,
    tests: securityTests,
  });

  // Suite 2: Deduplication & Fingerprint Suite
  const dedupStart = Date.now();
  const dedupTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];

  const mockFindingA: Finding = {
    id: 'f1',
    auditId: 'test_audit',
    category: 'mobile',
    checkId: 'mobile.horizontal-overflow',
    severity: 'critical',
    confidence: 0.95,
    title: 'Horizontal overflow on mobile',
    description: 'Container overflows viewport',
    impact: 'Bad UX',
    recommendation: 'Fix css',
    source: 'deterministic',
    url: 'https://example.com/pricing',
    evidence: [{ id: 'e1', type: 'geometry', selector: '.hero-grid' }],
    fingerprint: '',
    status: 'open',
  };

  const mockFindingB: Finding = {
    ...mockFindingA,
    id: 'f2',
    confidence: 0.98,
    source: 'ai_visual',
    evidence: [{ id: 'e2', type: 'screenshot', selector: '.hero-grid' }],
  };

  const fpA = generateFindingFingerprint(mockFindingA);
  const fpB = generateFindingFingerprint(mockFindingB);
  const fpMatch = fpA === fpB;

  dedupTests.push({
    name: 'Deterministic Fingerprint Equality',
    passed: fpMatch,
    details: `Fingerprint: ${fpA}`,
  });

  const merged = deduplicateFindings([mockFindingA, mockFindingB]);
  dedupTests.push({
    name: 'Deduplication merges duplicates into single finding',
    passed: merged.length === 1 && merged[0].evidence.length === 2 && merged[0].confidence === 0.98,
    details: `Merged length: ${merged.length}, Evidence count: ${merged[0]?.evidence?.length}`,
  });

  suites.push({
    name: 'Finding Fingerprinting & Deduplication Suite',
    passed: dedupTests.every((t) => t.passed),
    durationMs: Date.now() - dedupStart,
    tests: dedupTests,
  });

  // Suite 3: Scoring & Launch Verdict Gate
  const scoreStart = Date.now();
  const scoreTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];

  const checkIds = Object.keys(CHECK_DEFINITIONS);

  // Test 1: Clean report has 100 score and LAUNCH_READY
  const cleanScores = calculateAuditScores([], checkIds, 1000, 1, 3);
  scoreTests.push({
    name: 'Zero findings yields 100/100 score and LAUNCH_READY verdict',
    passed: cleanScores.summary.overallScore === 100 && cleanScores.summary.verdict === 'LAUNCH_READY',
    details: `Score: ${cleanScores.summary.overallScore}, Verdict: ${cleanScores.summary.verdict}`,
  });

  // Test 2: Critical finding triggers LAUNCH_BLOCKED regardless of other scores
  const criticalScores = calculateAuditScores([mockFindingA], checkIds, 1000, 1, 3);
  scoreTests.push({
    name: 'Critical finding immediately enforces LAUNCH_BLOCKED verdict',
    passed: criticalScores.summary.verdict === 'LAUNCH_BLOCKED' && criticalScores.summary.criticalCount === 1,
    details: `Verdict: ${criticalScores.summary.verdict}, Blockers: ${criticalScores.summary.criticalCount}`,
  });

  suites.push({
    name: 'Scoring Engine & Launch Gate Suite',
    passed: scoreTests.every((t) => t.passed),
    durationMs: Date.now() - scoreStart,
    tests: scoreTests,
  });

  return suites;
}
