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
} from 'lucide-react';
import { AuditReport, Finding, LaunchVerdict } from '../types/audit';

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
  // Local state of findings marked as fixed in this retest simulation
  const [fixedItemIds, setFixedItemIds] = useState<string[]>(
    currentReport.findings.filter((f) => f.status === 'fixed').map((f) => f.id)
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasRunRetest, setHasRunRetest] = useState(false);

  const toggleFix = (id: string) => {
    if (fixedItemIds.includes(id)) {
      setFixedItemIds(fixedItemIds.filter((item) => item !== id));
    } else {
      setFixedItemIds([...fixedItemIds, id]);
    }
  };

  const handleFixAll = () => {
    setFixedItemIds(currentReport.findings.map((f) => f.id));
  };

  const beforeScore = currentReport.summary.overallScore;
  const beforeVerdict = currentReport.summary.verdict;

  // Calculate simulated after score
  const remainingFindings = currentReport.findings.filter((f) => !fixedItemIds.includes(f.id));
  const remainingCritical = remainingFindings.filter((f) => f.severity === 'critical').length;
  const remainingHigh = remainingFindings.filter((f) => f.severity === 'high').length;

  let simulatedAfterScore = Math.min(
    100,
    Math.round(beforeScore + (fixedItemIds.length * 12))
  );
  if (remainingFindings.length === 0) simulatedAfterScore = 100;

  let simulatedAfterVerdict: LaunchVerdict = 'LAUNCH_READY';
  if (remainingCritical > 0) simulatedAfterVerdict = 'LAUNCH_BLOCKED';
  else if (simulatedAfterScore < 75 || remainingHigh >= 3) simulatedAfterVerdict = 'NEEDS_REVIEW';

  const scoreDelta = simulatedAfterScore - beforeScore;

  const handleRunRetest = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setHasRunRetest(true);
    }, 800);
  };

  const handleApplyChanges = () => {
    const updatedFindings: Finding[] = currentReport.findings.map((f) => ({
      ...f,
      status: fixedItemIds.includes(f.id) ? 'fixed' : 'open',
    }));

    const updatedReport: AuditReport = {
      ...currentReport,
      summary: {
        ...currentReport.summary,
        overallScore: simulatedAfterScore,
        verdict: simulatedAfterVerdict,
        verdictReason:
          simulatedAfterVerdict === 'LAUNCH_READY'
            ? 'All critical blockers resolved. QA gate verified for launch.'
            : `${remainingCritical} blocker(s) remain open.`,
        criticalCount: remainingCritical,
        highCount: remainingHigh,
      },
      findings: updatedFindings,
    };

    onApplyRetestResults(updatedReport);
    onClose();
  };

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
              <h3 className="text-base font-bold text-white">Retest & Fix Verification Engine</h3>
              <p className="text-xs text-slate-400">
                Simulate or re-run automated audit after code remediation to verify delta.
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
          {/* Before */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Before Audit</span>
            <div className="text-3xl font-black text-rose-400 font-mono my-1">{beforeScore} / 100</div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
              {beforeVerdict.replace('_', ' ')}
            </span>
          </div>

          {/* Delta Arrow */}
          <div className="flex flex-col items-center justify-center p-2 text-center">
            <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-lg">
              <TrendingUp className="h-5 w-5" />
              <span>+{Math.max(0, scoreDelta)} pts</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {fixedItemIds.length} of {currentReport.findings.length} fixed
            </span>
          </div>

          {/* After */}
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-center">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Simulated After</span>
            <div className="text-3xl font-black text-emerald-400 font-mono my-1">{simulatedAfterScore} / 100</div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              {simulatedAfterVerdict.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Findings Checklist Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Mark Applied Remediation Fixes:
            </h4>
            <button
              onClick={handleFixAll}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
            >
              Mark All as Resolved
            </button>
          </div>

          <div className="space-y-2.5">
            {currentReport.findings.map((f) => {
              const isChecked = fixedItemIds.includes(f.id);

              return (
                <div
                  key={f.id}
                  onClick={() => toggleFix(f.id)}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    isChecked
                      ? 'border-emerald-500/50 bg-emerald-950/20'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by parent container click
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 rounded ${
                          f.severity === 'critical'
                            ? 'bg-rose-950 text-rose-300'
                            : 'bg-amber-950 text-amber-300'
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className={`text-xs font-bold ${isChecked ? 'text-emerald-300 line-through' : 'text-white'}`}>
                        {f.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{f.recommendation}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isChecked
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isChecked ? 'RESOLVED' : 'STILL PRESENT'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={handleApplyChanges}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Apply Retest & Update Report ({simulatedAfterScore}/100)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
