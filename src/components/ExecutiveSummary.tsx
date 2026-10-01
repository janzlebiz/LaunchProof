import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Download,
  Share2,
  FileCode,
  RotateCcw,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  Clock,
  Smartphone,
  Eye,
} from 'lucide-react';
import { AuditReport } from '../types/audit';
import { generateAuditPdf } from '../lib/pdf/reportPdf';

interface ExecutiveSummaryProps {
  report: AuditReport;
  onRetest: () => void;
  onOpenRetestComparison: () => void;
  onOpenVisualEvidence: () => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  report,
  onRetest,
  onOpenRetestComparison,
  onOpenVisualEvidence,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { summary } = report;
  const isBlocked = summary.verdict === 'LAUNCH_BLOCKED';
  const isReview = summary.verdict === 'NEEDS_REVIEW';
  const isReady = summary.verdict === 'LAUNCH_READY';

  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    try {
      const doc = generateAuditPdf(report);
      const filename = `AI_Launch_QA_Report_${report.targetUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_report_${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner: Launch Gate Verdict */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl transition-all ${
          isBlocked
            ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/70 via-slate-900 to-slate-950 text-rose-100 shadow-rose-950/30'
            : isReview
            ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-950 text-amber-100 shadow-amber-950/30'
            : 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 text-emerald-100 shadow-emerald-950/30'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Verdict Info */}
          <div className="flex items-start gap-4 max-w-3xl">
            <div
              className={`p-3.5 rounded-2xl ring-1 shadow-lg shrink-0 ${
                isBlocked
                  ? 'bg-rose-500/20 text-rose-400 ring-rose-500/40'
                  : isReview
                  ? 'bg-amber-500/20 text-amber-400 ring-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/40'
              }`}
            >
              {isBlocked ? (
                <ShieldAlert className="h-8 w-8" />
              ) : isReview ? (
                <AlertTriangle className="h-8 w-8" />
              ) : (
                <ShieldCheck className="h-8 w-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono tracking-wider uppercase font-semibold text-slate-400">
                  Pre-Launch Verification Gate
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide uppercase border ${
                    isBlocked
                      ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                      : isReview
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  }`}
                >
                  {summary.verdict.replace('_', ' ')}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {isBlocked
                  ? 'Deployment Blocked: Critical QA Failures'
                  : isReview
                  ? 'Caution: High Priority Issues Detected'
                  : 'Launch Approved: High Quality Standard'}
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1">
                {summary.verdictReason}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono text-cyan-300">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {report.targetUrl}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Audit Duration: {(summary.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          {/* Overall Score Dial */}
          <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 shrink-0 min-w-[160px]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Score</span>
            <div className="flex items-baseline gap-1 my-1">
              <span
                className={`text-4xl sm:text-5xl font-black font-mono ${
                  summary.overallScore >= 85
                    ? 'text-emerald-400'
                    : summary.overallScore >= 70
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {summary.overallScore}
              </span>
              <span className="text-sm font-semibold text-slate-500">/100</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Weighted across 6 pillars
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition-all shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all"
            >
              <FileCode className="h-3.5 w-3.5 text-indigo-400" />
              <span>{copiedJson ? 'JSON Saved!' : 'Export JSON'}</span>
            </button>

            <button
              onClick={handleShareLink}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all"
            >
              <Share2 className="h-3.5 w-3.5 text-slate-400" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Report'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenVisualEvidence}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-all"
            >
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>Visual Evidence Viewer</span>
            </button>

            <button
              onClick={onOpenRetestComparison}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/30 hover:bg-indigo-900/40 px-3.5 py-2 text-xs font-semibold text-indigo-300 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Verify Fix / Retest</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Critical Blockers */}
        <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Critical Blockers</div>
          <div className="text-2xl font-black text-rose-300 font-mono mt-0.5">{summary.criticalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Stops deployment</div>
        </div>

        {/* High Severity */}
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">High Priority</div>
          <div className="text-2xl font-black text-amber-300 font-mono mt-0.5">{summary.highCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">High user impact</div>
        </div>

        {/* Medium & Low */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Medium / Low</div>
          <div className="text-2xl font-black text-slate-200 font-mono mt-0.5">
            {summary.mediumCount + summary.lowCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Polish & warnings</div>
        </div>

        {/* Total Findings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Total Findings</div>
          <div className="text-2xl font-black text-cyan-300 font-mono mt-0.5">{summary.totalFindings}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Deduplicated</div>
        </div>

        {/* Pages Audited */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pages Tested</div>
          <div className="text-2xl font-black text-slate-200 font-mono mt-0.5">{summary.pagesAudited}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Bounded crawl</div>
        </div>

        {/* Viewports */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-left">
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Viewports</div>
          <div className="text-2xl font-black text-indigo-300 font-mono mt-0.5">{summary.viewportsTested}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Desktop & Mobile</div>
        </div>
      </div>
    </div>
  );
};
