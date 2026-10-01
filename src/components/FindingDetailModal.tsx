import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Code2,
  Eye,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  Terminal,
  Smartphone,
  Monitor,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Finding } from '../types/audit';

interface FindingDetailModalProps {
  finding: Finding | null;
  initialTab?: 'evidence' | 'fix' | 'test';
  onClose: () => void;
  onToggleStatus: (findingId: string) => void;
}

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({
  finding,
  initialTab = 'evidence',
  onClose,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'evidence' | 'fix' | 'test'>(initialTab);
  const [copiedFix, setCopiedFix] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);

  if (!finding) return null;

  const isFixed = finding.status === 'fixed';
  const isCritical = finding.severity === 'critical';
  const isHigh = finding.severity === 'high';

  const handleCopyFix = () => {
    if (finding.fixPrompt) {
      navigator.clipboard.writeText(finding.fixPrompt);
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 2000);
    }
  };

  const handleCopyTest = () => {
    if (finding.playwrightTest) {
      navigator.clipboard.writeText(finding.playwrightTest);
      setCopiedTest(true);
      setTimeout(() => setCopiedTest(false), 2000);
    }
  };

  const primaryEvidence = finding.evidence[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="space-y-1.5 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`font-mono font-black uppercase text-[10px] px-2 py-0.5 rounded-full border ${
                  isCritical
                    ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                    : isHigh
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                    : 'bg-sky-950 text-sky-300 border-sky-500/50'
                }`}
              >
                {finding.severity}
              </span>
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {finding.category}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {finding.checkId}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {finding.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleStatus(finding.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isFixed
                  ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-emerald-500/50'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isFixed ? 'Resolved' : 'Mark as Fixed'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Tab Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all mr-6 ${
              activeTab === 'evidence'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>Visual Evidence & DOM Geometry</span>
          </button>

          <button
            onClick={() => setActiveTab('fix')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all mr-6 ${
              activeTab === 'fix'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>AI Fix Prompt (Agent Ready)</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all ${
              activeTab === 'test'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-4 w-4 text-indigo-400" />
            <span>Playwright Regression Test</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Tab 1: Evidence & Mockup */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {/* Finding Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 space-y-1">
                  <span className="font-bold text-slate-300 block">Problem Statement</span>
                  <p className="text-slate-400 leading-relaxed">{finding.description}</p>
                </div>
                <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 space-y-1">
                  <span className="font-bold text-emerald-300 block">Recommended Solution</span>
                  <p className="text-slate-400 leading-relaxed">{finding.recommendation}</p>
                </div>
              </div>

              {/* Viewport Simulation & Bounding Box Visualizer */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Smartphone className="h-4 w-4 text-cyan-400" />
                    <span>Viewport Render & Defect Location Overlay</span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    {primaryEvidence?.viewportName || 'Mobile 390x844'}
                  </span>
                </div>

                {/* Simulated Screen Frame */}
                <div className="relative mx-auto w-full max-w-lg h-64 rounded-xl border-2 border-slate-700 bg-slate-900 p-4 flex flex-col justify-between overflow-hidden shadow-inner">
                  {/* Browser Bar */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                      <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                      <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                      {finding.url}
                    </span>
                    <span className="text-[10px] text-slate-500">100%</span>
                  </div>

                  {/* Visual Content Placeholder with Defect Highlight */}
                  <div className="relative flex-1 rounded bg-slate-950/90 border border-slate-800/80 p-3 flex flex-col justify-center items-center">
                    <div className="w-full space-y-2">
                      <div className="h-3 w-3/4 bg-slate-800 rounded mx-auto" />
                      <div className="h-2 w-1/2 bg-slate-800/60 rounded mx-auto" />
                    </div>

                    {/* Defect Bounding Box Highlight */}
                    <div className="my-3 relative p-2.5 rounded-lg border-2 border-rose-500 bg-rose-500/10 text-rose-300 text-center animate-pulse">
                      <span className="text-[11px] font-mono font-bold block">
                        {primaryEvidence?.selector || 'Defective Target Element'}
                      </span>
                      <span className="text-[9px] text-rose-400">
                        {primaryEvidence?.metricValue || primaryEvidence?.snippet || 'Defect boundary identified'}
                      </span>
                      <span className="absolute -top-2.5 -right-2 bg-rose-600 text-white text-[9px] font-bold px-1 rounded shadow">
                        ISSUE
                      </span>
                    </div>

                    <div className="w-full grid grid-cols-3 gap-2">
                      <div className="h-6 bg-slate-800/40 rounded" />
                      <div className="h-6 bg-slate-800/40 rounded" />
                      <div className="h-6 bg-slate-800/40 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence Details List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Raw Evidence Logs & DOM Selectors
                </span>
                {finding.evidence.map((ev, i) => (
                  <div
                    key={ev.id || i}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-bold text-cyan-400">{ev.title || ev.type.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-500">ID: {ev.id}</span>
                    </div>

                    {ev.selector && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">Selector: </span>
                        <span className="text-amber-300">{ev.selector}</span>
                      </div>
                    )}

                    {ev.snippet && (
                      <div className="text-slate-400 text-[11px] bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto">
                        <code>{ev.snippet}</code>
                      </div>
                    )}

                    {ev.logMessage && (
                      <div className="text-rose-400 text-[11px] bg-rose-950/40 p-2 rounded border border-rose-900/40">
                        <code>{ev.logMessage}</code>
                      </div>
                    )}

                    {ev.metricName && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">{ev.metricName}:</span>
                        <span className="font-bold text-cyan-300">{ev.metricValue}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: AI Fix Prompt */}
          {activeTab === 'fix' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Agent-Ready Remediation Prompt
                  </h4>
                  <p className="text-xs text-slate-400">
                    Copy and paste into Google AI Studio, Cursor, Claude Code, v0, or Bolt.
                  </p>
                </div>
                <button
                  onClick={handleCopyFix}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 text-xs shadow-md transition-all"
                >
                  {copiedFix ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedFix ? 'Copied to Clipboard!' : 'Copy Fix Prompt'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto scrollbar-thin">
                {finding.fixPrompt || 'Generating fix prompt...'}
              </div>
            </div>
          )}

          {/* Tab 3: Playwright Regression Test */}
          {activeTab === 'test' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Playwright TypeScript Regression Test
                  </h4>
                  <p className="text-xs text-slate-400">
                    Runs in CI to confirm the issue is resolved and never regresses.
                  </p>
                </div>
                <button
                  onClick={handleCopyTest}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-3 py-1.5 text-xs shadow-md transition-all"
                >
                  {copiedTest ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedTest ? 'Copied Test Code!' : 'Copy Playwright Test'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-indigo-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto scrollbar-thin">
                {finding.playwrightTest || 'Generating Playwright test...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
