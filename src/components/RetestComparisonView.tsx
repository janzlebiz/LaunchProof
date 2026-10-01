import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Check,
  Loader2,
} from 'lucide-react';
import { AuditReport, Finding, LaunchVerdict, RetestComparison } from '../types/audit';

interface RetestComparisonViewProps {
  currentReport: AuditReport;
  onClose: () => void;
  onApplyRetestResults: (updatedReport: AuditReport) => void;
}

export const RetestComparisonView: React.FC<RetestComparisonViewProps> = ({
  currentReport,
  onClose,
  onApplyRetestResults,
}) => {
  const [isRetesting, setIsRetesting] = useState(false);
  const [retestResult, setRetestResult] = useState<{ freshReport: AuditReport; comparison: RetestComparison } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunRealRetest = async () => {
    setIsRetesting(true);
    setError(null);

    try {
      const res = await fetch(`/api/audits/${currentReport.id}/retest`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Retest failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setRetestResult(data);
    } catch (err: any) {
      setError(err.message || 'Retest failed.');
    } finally {
      setIsRetesting(false);
    }
  };

  const beforeScore = currentReport.summary.overallScore;
  const beforeVerdict = currentReport.summary.verdict;

  const afterScore = retestResult ? retestResult.freshReport.summary.overallScore : beforeScore;
  const afterVerdict = retestResult ? retestResult.freshReport.summary.verdict : beforeVerdict;
  const scoreDelta = retestResult ? retestResult.comparison.scoreDelta : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Real Retest & Fresh Evidence Verification</h3>
              <p className="text-xs text-slate-400">
                Runs a fresh browser audit against {currentReport.targetUrl} and computes live diff.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comparison Header Cards */}
        <div className="p-5 sm:p-6 bg-slate-950/40 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Baseline Audit</span>
            <div className="text-3xl font-black text-rose-400 font-mono my-1">{beforeScore} / 100</div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
              {beforeVerdict.replace('_', ' ')}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 text-center">
            <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-lg">
              <TrendingUp className="h-5 w-5" />
              <span>{scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`} pts</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {retestResult ? `${retestResult.comparison.resolvedFindings.length} resolved` : 'Ready to execute'}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-center">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Fresh Retest Result</span>
            <div className="text-3xl font-black text-emerald-400 font-mono my-1">{afterScore} / 100</div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              {afterVerdict.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {!retestResult && !isRetesting && (
            <div className="text-center py-12 space-y-3">
              <RotateCcw className="h-10 w-10 text-cyan-400/50 mx-auto" />
              <h4 className="text-sm font-bold text-white">Execute Real Target Retest</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                LaunchProof will open a new isolated browser context, crawl {currentReport.targetUrl}, test responsive viewports, evaluate axe-core, and compute the fresh verification delta.
              </p>
              <button
                onClick={handleRunRealRetest}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs shadow-lg hover:from-cyan-400 hover:to-indigo-500"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Run Fresh Retest Audit</span>
              </button>
            </div>
          )}

          {isRetesting && (
            <div className="text-center py-16 space-y-3">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs font-mono text-cyan-300">Running fresh browser audit worker against {currentReport.targetUrl}...</p>
            </div>
          )}

          {retestResult && (
            <div className="space-y-4">
              {/* Resolved Findings */}
              {retestResult.comparison.resolvedFindings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Resolved Defects ({retestResult.comparison.resolvedFindings.length})</span>
                  </span>
                  <div className="space-y-2">
                    {retestResult.comparison.resolvedFindings.map((rf) => (
                      <div key={rf.id} className="p-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 text-xs flex items-center justify-between">
                        <span className="text-emerald-200 line-through">{rf.title}</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                          RESOLVED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Persisting Findings */}
              {retestResult.comparison.persistingFindings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Still Present ({retestResult.comparison.persistingFindings.length})</span>
                  </span>
                  <div className="space-y-2">
                    {retestResult.comparison.persistingFindings.map((pf) => (
                      <div key={pf.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-xs flex items-center justify-between">
                        <span className="text-slate-300">{pf.title}</span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                          STILL OPEN
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Close
          </button>

          {retestResult && (
            <button
              onClick={() => {
                onApplyRetestResults(retestResult.freshReport);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold shadow hover:from-cyan-400 hover:to-indigo-500 transition-all"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Adopt Fresh Retest Report ({afterScore}/100)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
