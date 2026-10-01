/**
 * LaunchProof — Core Domain Types and Interfaces
 * Automated Pre-Launch Website QA Platform
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingSource =
  | 'deterministic'
  | 'axe'
  | 'performance'
  | 'ai_visual'
  | 'ai_reasoning'
  | 'combined';

export type QACategory =
  | 'functionality'
  | 'mobile'
  | 'accessibility'
  | 'performance'
  | 'seo'
  | 'visual_ux';

export type AuditStatus =
  | 'QUEUED'
  | 'INITIALIZING'
  | 'CRAWLING'
  | 'DETERMINISTIC_CHECKS'
  | 'ACCESSIBILITY'
  | 'PERFORMANCE'
  | 'SCREENSHOT_ANALYSIS'
  | 'AI_REASONING'
  | 'NORMALIZING'
  | 'SCORING'
  | 'REPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SECURITY_BLOCKED';

export type LaunchVerdict = 'LAUNCH_READY' | 'LAUNCH_BLOCKED' | 'NEEDS_REVIEW';

export type ExecutionEngine = 'PLAYWRIGHT_CHROMIUM' | 'HTTP_INSPECTOR';

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
}

export interface AuditConfig {
  targetUrl: string;
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  viewports: ViewportConfig[];
  enableA11y: boolean;
  enablePerformance: boolean;
  enableAI: boolean;
  enableExternalLinks: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface EvidenceReference {
  id: string;
  type: 'screenshot' | 'dom' | 'console' | 'network' | 'axe' | 'performance' | 'geometry';
  title?: string;
  selector?: string;
  snippet?: string;
  metricName?: string;
  metricValue?: string | number;
  logMessage?: string;
  httpStatus?: number;
  screenshotId?: string;
  screenshotBase64?: string;
  boundingBox?: BoundingBox;
  viewportName?: string;
  timestamp?: string;
}

export interface Finding {
  id: string;
  auditId: string;
  pageId?: string;
  category: QACategory;
  checkId: string;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  source: FindingSource;
  url: string;
  evidence: EvidenceReference[];
  fingerprint: string;
  fixPrompt?: string;
  playwrightTest?: string;
  status: 'open' | 'fixed' | 'needs_review';
}

export interface CheckItemResult {
  id: string;
  name: string;
  category: QACategory;
  passed: boolean;
  severityIfFailed: Severity;
  details: string;
  findingsCount: number;
  executed: boolean;
}

export interface CategoryScore {
  category: QACategory;
  name: string;
  score: number;
  weight: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  status: 'pass' | 'warn' | 'fail';
  checks: CheckItemResult[];
}

export interface BrowserError {
  type: 'error' | 'warning' | 'uncaught_exception' | 'unhandled_rejection';
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
}

export interface NetworkError {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  errorText?: string;
  timestamp: string;
}

export interface PerformanceMetrics {
  ttfb: number; // Time to First Byte (ms)
  loadTimeMs: number; // Page load time (ms)
  lcp: number; // Largest Contentful Paint (ms)
  fcp: number; // First Contentful Paint (ms)
  cls: number; // Cumulative Layout Shift
  tbt: number; // Total Blocking Time (ms)
  totalBytes: number;
  htmlBytes: number;
  scriptBytes: number;
  imageBytes: number;
  cssBytes: number;
  requestCount: number;
  domElementsCount: number;
  renderBlockingCount: number;
}

export interface PageResult {
  id: string;
  url: string;
  status: number;
  title: string;
  loadTimeMs: number;
  consoleErrors: BrowserError[];
  networkErrors: NetworkError[];
  metrics: PerformanceMetrics;
  discoveredLinks: { text: string; href: string; isExternal: boolean; status?: number; isBroken?: boolean }[];
  elementsCount: {
    buttons: number;
    links: number;
    forms: number;
    images: number;
    headings: number;
    scripts: number;
  };
  screenshots?: Record<string, string>;
  htmlSnippet?: string;
}

export interface AuditSummary {
  overallScore: number;
  verdict: LaunchVerdict;
  verdictReason: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalFindings: number;
  pagesAudited: number;
  viewportsTested: number;
  checksExecuted: number;
  durationMs: number;
  executionEngine: ExecutionEngine;
  aiReasoningStatus: 'SUCCESS' | 'UNAVAILABLE' | 'SKIPPED' | 'FAILED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step?: string;
}

export interface AuditReport {
  id: string;
  targetUrl: string;
  status: AuditStatus;
  startedAt: string;
  completedAt?: string;
  config: AuditConfig;
  summary: AuditSummary;
  categoryScores: CategoryScore[];
  findings: Finding[];
  pages: PageResult[];
  logs: AuditLog[];
  errorMessage?: string;
}

export interface RetestComparison {
  beforeAuditId: string;
  afterAuditId: string;
  beforeScore: number;
  afterScore: number;
  scoreDelta: number;
  beforeVerdict: LaunchVerdict;
  afterVerdict: LaunchVerdict;
  resolvedFindings: Finding[];
  persistingFindings: Finding[];
  newFindings: Finding[];
}

export interface TargetPreset {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  url: string;
  description: string;
  type: 'flawed' | 'healthy' | 'ecommerce';
  expectedIssues: string[];
}

export interface TestSuiteResult {
  name: string;
  passed: boolean;
  durationMs: number;
  tests: {
    name: string;
    passed: boolean;
    error?: string;
    details?: string;
  }[];
}
