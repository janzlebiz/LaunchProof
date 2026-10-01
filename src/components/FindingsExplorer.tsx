import React, { useState } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  Code2,
  CheckCircle,
  Eye,
  Terminal,
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  Layers,
  Wrench,
  Check,
} from 'lucide-react';
import { Finding, FindingSource, QACategory, Severity } from '../types/audit';

interface FindingsExplorerProps {
  findings: Finding[];
  selectedCategory: QACategory | 'all';
  onSelectCategory: (category: QACategory | 'all') => void;
  onOpenFindingDetail: (finding: Finding, initialTab?: 'evidence' | 'fix' | 'test') => void;
  onToggleFindingStatus: (findingId: string) => void;
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  findings,
  selectedCategory,
  onSelectCategory,
  onOpenFindingDetail,
  onToggleFindingStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'fixed'>('all');

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (selectedSource !== 'all') {
      if (selectedSource === 'ai' && !f.source.includes('ai')) return false;
      if (selectedSource === 'deterministic' && f.source !== 'deterministic') return false;
      if (selectedSource === 'axe' && f.source !== 'axe') return false;
      if (selectedSource === 'performance' && f.source !== 'performance') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchDesc = f.description.toLowerCase().includes(q);
      const matchRec = f.recommendation.toLowerCase().includes(q);
      const matchSelector = f.evidence.some((e) => e.selector?.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchRec && !matchSelector) return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-4">
      {/* Header & Filter Controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Audited Findings & Remediation</span>
              <span className="rounded-full bg-cyan-950 px-2.5 py-0.5 text-xs font-mono font-semibold text-cyan-300 border border-cyan-800">
                {filteredFindings.length} of {findings.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Evidence-grounded defects with copyable AI fix prompts and regression test suites.
            </p>
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search selector, title, rule..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 px-1.5">Category:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'functionality', label: 'Functionality' },
              { key: 'mobile', label: 'Mobile' },
              { key: 'accessibility', label: 'A11y' },
              { key: 'performance', label: 'Performance' },
              { key: 'visual_ux', label: 'Visual/UX' },
              { key: 'seo', label: 'SEO' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => onSelectCategory(cat.key as any)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  selectedCategory === cat.key
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 px-1.5">Severity:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSelectedSeverity(sev as any)}
                className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition-all ${
                  selectedSeverity === sev
                    ? sev === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                      : sev === 'high'
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 px-1.5">Source:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'deterministic', label: 'Deterministic' },
              { key: 'axe', label: 'axe' },
              { key: 'ai', label: 'Gemini AI' },
            ].map((src) => (
              <button
                key={src.key}
                type="button"
                onClick={() => setSelectedSource(src.key)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  selectedSource === src.key
                    ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
          <h4 className="text-base font-bold text-white">No findings matched your filters</h4>
          <p className="text-xs text-slate-400">All checks in this selected scope passed successfully.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isFixed = finding.status === 'fixed';
            const isCritical = finding.severity === 'critical';
            const isHigh = finding.severity === 'high';
            const isMedium = finding.severity === 'medium';

            const primarySelector = finding.evidence.find((e) => e.selector)?.selector;

            return (
              <div
                key={finding.id}
                className={`group rounded-2xl border p-5 transition-all backdrop-blur-xl ${
                  isFixed
                    ? 'border-emerald-900/40 bg-emerald-950/10 opacity-75'
                    : isCritical
                    ? 'border-rose-500/40 bg-slate-900/90 shadow-lg shadow-rose-950/20'
                    : isHigh
                    ? 'border-amber-500/40 bg-slate-900/90 shadow-lg shadow-amber-950/20'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Main finding info */}
                  <div className="space-y-2 flex-1">
                    {/* Header Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Severity Pill */}
                      <span
                        className={`font-mono font-black uppercase text-[10px] px-2 py-0.5 rounded-full border ${
                          isCritical
                            ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                            : isHigh
                            ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                            : isMedium
                            ? 'bg-sky-950 text-sky-300 border-sky-500/50'
                            : 'bg-slate-950 text-slate-400 border-slate-700'
                        }`}
                      >
                        {finding.severity}
                      </span>

                      {/* Category Pill */}
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {finding.category}
                      </span>

                      {/* Source Pill */}
                      <span className="text-[10px] text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40 flex items-center gap-1 font-mono">
                        {finding.source.includes('ai') ? (
                          <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                        ) : (
                          <Code2 className="h-2.5 w-2.5 text-slate-400" />
                        )}
                        {finding.source}
                      </span>

                      {/* Confidence Pill */}
                      <span className="text-[10px] text-slate-400">
                        Confidence: <strong className="text-slate-200">{Math.round(finding.confidence * 100)}%</strong>
                      </span>

                      {/* Check ID */}
                      <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                        #{finding.checkId}
                      </span>
                    </div>

                    {/* Title */}
                    <h4
                      className={`text-base sm:text-lg font-bold ${
                        isFixed ? 'line-through text-slate-400' : 'text-white'
                      }`}
                    >
                      {finding.title}
                    </h4>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {finding.description}
                    </p>

                    {/* Impact & Recommendation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
                        <span className="font-semibold text-rose-300 block mb-0.5">Impact:</span>
                        <p className="text-slate-400">{finding.impact}</p>
                      </div>

                      <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
                        <span className="font-semibold text-cyan-300 block mb-0.5">Recommendation:</span>
                        <p className="text-slate-400">{finding.recommendation}</p>
                      </div>
                    </div>

                    {/* Evidence Snippet / Selector Pill */}
                    {finding.evidence.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono">
                        <span className="text-slate-500">Evidence:</span>
                        {finding.evidence.map((ev) => (
                          <span
                            key={ev.id}
                            className="bg-slate-950 text-cyan-300 px-2 py-0.5 rounded border border-slate-800 truncate max-w-md"
                            title={ev.snippet || ev.logMessage || ev.selector}
                          >
                            {ev.selector ? `DOM: ${ev.selector}` : ev.logMessage ? `Log: ${ev.logMessage.slice(0, 40)}...` : ev.metricName ? `${ev.metricName}: ${ev.metricValue}` : ev.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Right Column */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-stretch gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenFindingDetail(finding, 'fix')}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 px-3 py-2 text-xs font-bold text-cyan-300 transition-all shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      <span>AI Fix Prompt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenFindingDetail(finding, 'test')}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-all"
                    >
                      <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Playwright Test</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenFindingDetail(finding, 'evidence')}
                      className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition-all"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Evidence</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleFindingStatus(finding.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                        isFixed
                          ? 'border border-emerald-500 bg-emerald-950/60 text-emerald-300'
                          : 'border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-emerald-400'
                      }`}
                      title={isFixed ? 'Mark as Open' : 'Mark as Fixed'}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isFixed ? 'Resolved' : 'Mark Fixed'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
