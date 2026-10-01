import React from 'react';
import {
  X,
  History,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { AuditReport } from '../types/audit';

interface AuditHistoryDrawerProps {
  isOpen: boolean;
  history: AuditReport[];
  onClose: () => void;
  onSelectAudit: (report: AuditReport) => void;
  onClearHistory: () => void;
}

export const AuditHistoryDrawer: React.FC<AuditHistoryDrawerProps> = ({
  isOpen,
  history,
  onClose,
  onSelectAudit,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Audit History & Benchmark Runs</h3>
              <p className="text-[11px] text-slate-400">{history.length} audit session(s) saved</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                title="Clear all stored audits"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-slate-500">
              <History className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-xs">No past audits in this session yet.</p>
            </div>
          ) : (
            history.map((item) => {
              const isBlocked = item.summary.verdict === 'LAUNCH_BLOCKED';
              const isReview = item.summary.verdict === 'NEEDS_REVIEW';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectAudit(item);
                    onClose();
                  }}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:border-cyan-500/50 cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-cyan-400 font-bold truncate max-w-[200px]">
                      {item.targetUrl}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        isBlocked
                          ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                          : isReview
                          ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {item.summary.verdict.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold font-mono text-white">
                        {item.summary.overallScore}
                      </span>
                      <span className="text-[10px] text-slate-500">/100</span>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {new Date(item.startedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span className="text-rose-400 font-medium">
                      {item.summary.criticalCount} Critical
                    </span>
                    <span>•</span>
                    <span className="text-amber-400 font-medium">
                      {item.summary.highCount} High
                    </span>
                    <span>•</span>
                    <span>{item.findings.length} Findings</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
