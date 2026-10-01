import React, { useEffect, useRef } from 'react';
import { Terminal, Shield, CheckCircle2, AlertCircle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { AuditLog, AuditStatus } from '../types/audit';

interface LiveAuditProgressProps {
  status: AuditStatus;
  progressPercent: number;
  currentMessage: string;
  logs: AuditLog[];
  onCancel?: () => void;
}

const AUDIT_STAGES: Array<{ key: AuditStatus; label: string }> = [
  { key: 'INITIALIZING', label: 'Sandbox' },
  { key: 'CRAWLING', label: 'Crawler' },
  { key: 'DETERMINISTIC_CHECKS', label: 'Deterministic' },
  { key: 'ACCESSIBILITY', label: 'axe A11y' },
  { key: 'PERFORMANCE', label: 'Vitals' },
  { key: 'AI_REASONING', label: 'Gemini AI' },
  { key: 'NORMALIZING', label: 'Dedup' },
  { key: 'SCORING', label: 'Report' },
];

export const LiveAuditProgress: React.FC<LiveAuditProgressProps> = ({
  status,
  progressPercent,
  currentMessage,
  logs,
  onCancel,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const currentStageIndex = AUDIT_STAGES.findIndex((s) => s.key === status);

  return (
    <div className="max-w-4xl mx-auto my-8 rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-fadeIn">
      {/* Header & Percentage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Auditing Target in Progress</span>
              <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                {status}
              </span>
            </h3>
            <p className="text-xs text-slate-400">{currentMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {progressPercent}%
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-500/50 hover:text-rose-300 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800 mb-6">
        <div
          className="bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/50"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* State Machine Step Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 mb-5">
        {AUDIT_STAGES.map((stage, idx) => {
          const isDone = currentStageIndex > idx || status === 'COMPLETED';
          const isCurrent = currentStageIndex === idx;

          return (
            <div
              key={stage.key}
              className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                isCurrent
                  ? 'border-cyan-500 bg-cyan-950/60 text-cyan-300 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/30'
                  : isDone
                  ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-400'
                  : 'border-slate-800/80 bg-slate-950/40 text-slate-500'
              }`}
            >
              <div className="mb-1">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-slate-700" />
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Live Terminal Log Viewer */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2 text-slate-400">
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold">Audit Worker Execution Trace</span>
          </div>
          <span className="text-[10px] text-slate-500">Live Chromium Sandbox stdout</span>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
              <span
                className={`font-semibold shrink-0 ${
                  log.level === 'error'
                    ? 'text-rose-400'
                    : log.level === 'warn'
                    ? 'text-amber-400'
                    : log.level === 'success'
                    ? 'text-emerald-400'
                    : 'text-cyan-400'
                }`}
              >
                {log.level.toUpperCase()}:
              </span>
              <span className="text-slate-300">{log.message}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
