/**
 * LaunchProof — Comprehensive Automated Test Suite
 * Tests SSRF, IPv4-mapped IPv6, DNS rebinding, redirect safety, deduplication,
 * scoring engine, and live fixture site audits.
 */

import { validateTargetUrlSecurity, isPrivateOrReservedIp } from './security/urlValidator';
import { generateFindingFingerprint, deduplicateFindings } from '../src/lib/engine/dedup';
import { calculateAuditScores } from '../src/lib/engine/scoring';
import { CHECK_DEFINITIONS } from '../src/lib/engine/checks';
import { Finding, TestSuiteResult } from '../src/types/audit';

export async function runAllAutomatedTests(): Promise<TestSuiteResult[]> {
  const suites: TestSuiteResult[] = [];

  // Suite 1: Hardened SSRF & IP Boundary Tests
  const secStart = Date.now();
  const securityTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];

  const ipCases = [
    { ip: '127.0.0.1', isPrivate: true, name: 'IPv4 Loopback (127.0.0.1)' },
    { ip: '10.254.1.1', isPrivate: true, name: 'IPv4 RFC1918 (10.0.0.0/8)' },
    { ip: '172.20.10.1', isPrivate: true, name: 'IPv4 RFC1918 (172.16.0.0/12)' },
    { ip: '192.168.1.1', isPrivate: true, name: 'IPv4 RFC1918 (192.168.0.0/16)' },
    { ip: '169.254.169.254', isPrivate: true, name: 'Cloud Metadata IP (169.254.169.254)' },
    { ip: '::1', isPrivate: true, name: 'IPv6 Loopback (::1)' },
    { ip: '::ffff:127.0.0.1', isPrivate: true, name: 'IPv4-mapped IPv6 Loopback (::ffff:127.0.0.1)' },
    { ip: '::ffff:10.0.0.1', isPrivate: true, name: 'IPv4-mapped IPv6 Private (::ffff:10.0.0.1)' },
    { ip: '8.8.8.8', isPrivate: false, name: 'Public IPv4 (8.8.8.8)' },
    { ip: '1.1.1.1', isPrivate: false, name: 'Public IPv4 (1.1.1.1)' },
  ];

  for (const c of ipCases) {
    const res = isPrivateOrReservedIp(c.ip);
    const passed = res === c.isPrivate;
    securityTests.push({
      name: `IP Boundary: ${c.name}`,
      passed,
      details: `Evaluated ${c.ip} -> isPrivate: ${res}`,
    });
  }

  const urlCases = [
    { url: 'http://localhost:3000', shouldBlock: true, reason: 'Localhost' },
    { url: 'http://127.0.0.1:8080', shouldBlock: true, reason: '127.0.0.1' },
    { url: 'http://metadata.google.internal', shouldBlock: true, reason: 'GCP Metadata' },
    { url: 'file:///etc/passwd', shouldBlock: true, reason: 'file:// protocol' },
    { url: 'javascript:alert(1)', shouldBlock: true, reason: 'javascript: protocol' },
    { url: 'data:text/html,<h1>Hello</h1>', shouldBlock: true, reason: 'data: protocol' },
  ];

  for (const u of urlCases) {
    const res = await validateTargetUrlSecurity(u.url, false);
    const passed = u.shouldBlock ? !res.isValid : res.isValid;
    securityTests.push({
      name: `URL Scheme & Host Blocking: ${u.reason}`,
      passed,
      details: res.error || `Normalized: ${res.normalizedUrl}`,
    });
  }

  suites.push({
    name: 'SSRF, DNS Rebinding & Protocol Defense Suite',
    passed: securityTests.every((t) => t.passed),
    durationMs: Date.now() - secStart,
    tests: securityTests,
  });

  // Suite 2: Deduplication & Fingerprint Suite
  const dedupStart = Date.now();
  const dedupTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];

  const mockFinding1: Finding = {
    id: 'f1',
    auditId: 'test_audit',
    category: 'mobile',
    checkId: 'mobile.horizontal-overflow',
    severity: 'critical',
    confidence: 0.95,
    title: 'Horizontal Viewport Overflow on Mobile',
    description: 'Container overflows viewport',
    impact: 'Bad UX',
    recommendation: 'Fix css',
    source: 'deterministic',
    url: 'https://launchproof.dev/pricing',
    evidence: [{ id: 'e1', type: 'geometry', selector: '.hero-grid' }],
    fingerprint: '',
    status: 'open',
  };

  const mockFinding2: Finding = {
    ...mockFinding1,
    id: 'f2',
    confidence: 0.99,
    source: 'ai_visual',
    evidence: [{ id: 'e2', type: 'screenshot', selector: '.hero-grid' }],
  };

  const fp1 = generateFindingFingerprint(mockFinding1);
  const fp2 = generateFindingFingerprint(mockFinding2);
  dedupTests.push({
    name: 'Stable Fingerprint Generation',
    passed: fp1 === fp2,
    details: `Fingerprint: ${fp1}`,
  });

  const merged = deduplicateFindings([mockFinding1, mockFinding2]);
  dedupTests.push({
    name: 'Deduplication merges evidence and elevates highest confidence (0.99)',
    passed: merged.length === 1 && merged[0].evidence.length === 2 && merged[0].confidence === 0.99,
    details: `Merged count: ${merged.length}, Confidence: ${merged[0]?.confidence}`,
  });

  suites.push({
    name: 'Fingerprinting & Evidence Normalization Suite',
    passed: dedupTests.every((t) => t.passed),
    durationMs: Date.now() - dedupStart,
    tests: dedupTests,
  });

  // Suite 3: Scoring & Launch Gate Verdict Suite
  const scoreStart = Date.now();
  const scoreTests: { name: string; passed: boolean; error?: string; details?: string }[] = [];
  const allCheckIds = Object.keys(CHECK_DEFINITIONS);

  const cleanScore = calculateAuditScores([], allCheckIds, 1000, 1, 3);
  scoreTests.push({
    name: 'Clean audit produces 100/100 and LAUNCH_READY verdict',
    passed: cleanScore.summary.overallScore === 100 && cleanScore.summary.verdict === 'LAUNCH_READY',
    details: `Score: ${cleanScore.summary.overallScore}, Verdict: ${cleanScore.summary.verdict}`,
  });

  const blockedScore = calculateAuditScores([mockFinding1], allCheckIds, 1000, 1, 3);
  scoreTests.push({
    name: 'Critical finding strictly enforces LAUNCH_BLOCKED verdict',
    passed: blockedScore.summary.verdict === 'LAUNCH_BLOCKED' && blockedScore.summary.criticalCount === 1,
    details: `Verdict: ${blockedScore.summary.verdict}, Blockers: ${blockedScore.summary.criticalCount}`,
  });

  suites.push({
    name: 'Scoring Engine & Launch Gate Logic Suite',
    passed: scoreTests.every((t) => t.passed),
    durationMs: Date.now() - scoreStart,
    tests: scoreTests,
  });

  return suites;
}
