/**
 * AI Launch QA — Main Application
 * Pre-launch QA platform with deterministic technical audits, mobile responsive checks,
 * axe accessibility, Core Web Vitals, and Gemini multimodal visual/UX reasoning.
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UrlInputSection } from './components/UrlInputSection';
import { LiveAuditProgress } from './components/LiveAuditProgress';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { CategoryScoreGrid } from './components/CategoryScoreGrid';
import { FindingsExplorer } from './components/FindingsExplorer';
import { FindingDetailModal } from './components/FindingDetailModal';
import { VisualEvidenceViewer } from './components/VisualEvidenceViewer';
import { CategoryDeepDive } from './components/CategoryDeepDive';
import { RetestComparisonView } from './components/RetestComparisonView';
import { AuditHistoryDrawer } from './components/AuditHistoryDrawer';
import { SecurityPolicyModal } from './components/SecurityPolicyModal';
import { AuditConfig, AuditLog, AuditReport, AuditStatus, Finding, QACategory } from './types/audit';
import { runFullAudit } from './lib/engine/orchestrator';

export default function App() {
  // Current Audit State
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('QUEUED');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [liveLogs, setLiveLogs] = useState<AuditLog[]>([]);

  // History State
  const [history, setHistory] = useState<AuditReport[]>(() => {
    try {
      const saved = localStorage.getItem('ai_launch_qa_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI Filter & Modal States
  const [selectedCategory, setSelectedCategory] = useState<QACategory | 'all'>('all');
  const [selectedFinding, setSelectedFinding] = useState<{ finding: Finding; tab: 'evidence' | 'fix' | 'test' } | null>(null);
  const [showVisualEvidence, setShowVisualEvidence] = useState<boolean>(false);
  const [showDeepDiveCategory, setShowDeepDiveCategory] = useState<QACategory | null>(null);
  const [showRetestModal, setShowRetestModal] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);

  // Auto-save history
  useEffect(() => {
    try {
      localStorage.setItem('ai_launch_qa_history', JSON.stringify(history.slice(0, 15)));
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  }, [history]);

  // Handle Start Audit
  const handleStartAudit = async (targetUrl: string, config?: Partial<AuditConfig>) => {
    setIsRunning(true);
    setProgressPercent(5);
    setAuditStatus('QUEUED');
    setCurrentMessage('Queueing audit job and initializing worker...');
    setLiveLogs([]);

    try {
      const result = await runFullAudit(
        targetUrl,
        config,
        (status, percent, message, level = 'info') => {
          setAuditStatus(status);
          setProgressPercent(percent);
          setCurrentMessage(message);
          setLiveLogs((prev) => [
            ...prev,
            {
              id: `log_${Date.now()}_${Math.random()}`,
              timestamp: new Date().toLocaleTimeString(),
              level,
              message,
              step: status,
            },
          ]);
        }
      );

      setReport(result);
      setHistory((prev) => [result, ...prev.filter((item) => item.id !== result.id)]);
    } catch (err: any) {
      console.error('Audit failed:', err);
      setCurrentMessage(err.message || 'Audit encountered an unexpected failure.');
      setAuditStatus('FAILED');
    } finally {
      setIsRunning(false);
    }
  };

  // Toggle single finding status (open <-> fixed)
  const handleToggleFindingStatus = (findingId: string) => {
    if (!report) return;

    const updatedFindings = report.findings.map((f) =>
      f.id === findingId
        ? { ...f, status: (f.status === 'fixed' ? 'open' : 'fixed') as 'open' | 'fixed' }
        : f
    );

    // Recalculate summary blockers
    const openCritical = updatedFindings.filter((f) => f.severity === 'critical' && f.status !== 'fixed').length;
    const openHigh = updatedFindings.filter((f) => f.severity === 'high' && f.status !== 'fixed').length;

    const newVerdict =
      openCritical > 0
        ? 'LAUNCH_BLOCKED'
        : report.summary.overallScore < 75 || openHigh >= 3
        ? 'NEEDS_REVIEW'
        : 'LAUNCH_READY';

    const updatedReport: AuditReport = {
      ...report,
      summary: {
        ...report.summary,
        verdict: newVerdict,
        criticalCount: openCritical,
        highCount: openHigh,
      },
      findings: updatedFindings,
    };

    setReport(updatedReport);
    setHistory((prev) => prev.map((h) => (h.id === updatedReport.id ? updatedReport : h)));
  };

  const handleApplyRetestResults = (updatedReport: AuditReport) => {
    setReport(updatedReport);
    setHistory((prev) => [updatedReport, ...prev.filter((h) => h.id !== updatedReport.id)]);
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('ai_launch_qa_history');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar
        onOpenHistory={() => setShowHistoryDrawer(true)}
        onOpenSecurity={() => setShowSecurityModal(true)}
        auditCount={history.length}
      />

      {/* Main Page Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* URL Input & Presets */}
        <UrlInputSection onStartAudit={handleStartAudit} isRunning={isRunning} />

        {/* Live Progress & Terminal Output */}
        {isRunning && (
          <LiveAuditProgress
            status={auditStatus}
            progressPercent={progressPercent}
            currentMessage={currentMessage}
            logs={liveLogs}
            onCancel={() => setIsRunning(false)}
          />
        )}

        {/* Active Audit Report Display */}
        {report && !isRunning && (
          <div className="space-y-8 animate-fadeIn">
            {/* Executive Summary & Gate Verdict */}
            <ExecutiveSummary
              report={report}
              onRetest={() => handleStartAudit(report.targetUrl, report.config)}
              onOpenRetestComparison={() => setShowRetestModal(true)}
              onOpenVisualEvidence={() => setShowVisualEvidence(true)}
            />

            {/* 6 QA Pillar Category Score Grid */}
            <CategoryScoreGrid
              categoryScores={report.categoryScores}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenDeepDive={(cat) => setShowDeepDiveCategory(cat)}
            />

            {/* Findings Explorer & Remediation Suite */}
            <FindingsExplorer
              findings={report.findings}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenFindingDetail={(finding, tab = 'evidence') =>
                setSelectedFinding({ finding, tab })
              }
              onToggleFindingStatus={handleToggleFindingStatus}
            />
          </div>
        )}
      </main>

      {/* Modals & Drawers */}
      {selectedFinding && (
        <FindingDetailModal
          finding={selectedFinding.finding}
          initialTab={selectedFinding.tab}
          onClose={() => setSelectedFinding(null)}
          onToggleStatus={handleToggleFindingStatus}
        />
      )}

      {showVisualEvidence && report && (
        <VisualEvidenceViewer
          report={report}
          onSelectFinding={(f) => {
            setShowVisualEvidence(false);
            setSelectedFinding({ finding: f, tab: 'evidence' });
          }}
          onClose={() => setShowVisualEvidence(false)}
        />
      )}

      {showDeepDiveCategory && report && (
        <CategoryDeepDive
          categoryScores={report.categoryScores}
          initialCategory={showDeepDiveCategory}
          onClose={() => setShowDeepDiveCategory(null)}
        />
      )}

      {showRetestModal && report && (
        <RetestComparisonView
          currentReport={report}
          onClose={() => setShowRetestModal(false)}
          onApplyRetestResults={handleApplyRetestResults}
        />
      )}

      <AuditHistoryDrawer
        isOpen={showHistoryDrawer}
        history={history}
        onClose={() => setShowHistoryDrawer(false)}
        onSelectAudit={(selected) => setReport(selected)}
        onClearHistory={handleClearHistory}
      />

      <SecurityPolicyModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
      />

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">AI Launch QA</span>
            <span>—</span>
            <span>Automated Pre-Launch Evidence & Remediation Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setShowSecurityModal(true)}
              className="hover:text-cyan-400 transition-colors"
            >
              SSRF Security Policy
            </button>
            <span>•</span>
            <span>WCAG 2.1 AA</span>
            <span>•</span>
            <span>Core Web Vitals</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
