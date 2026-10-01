import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Terminal,
  Activity,
} from 'lucide-react';
import { TestSuiteResult } from '../types/audit';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [suites, setSuites] = useState<TestSuiteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/tests/run-all', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuites(data.suites || []);
    } catch (err: any) {
      setError(err.message || 'Failed to execute test suite.');
    } finally {
      setIsRunning(false);
    }
  };

  const totalTests = suites?.reduce((acc, s) => acc + s.tests.length, 0) || 0;
  const passedTests = suites?.reduce((acc, s) => acc + s.tests.filter((t) => t.passed).length, 0) || 0;
  const allPassed = suites ? suites.every((s) => s.passed) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Automated QA & Security Test Runner</h3>
              <p className="text-xs text-slate-400">Unit, SSRF security boundary, deduplication, and scoring verification</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action & Status Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 transition-all"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{isRunning ? 'Running Test Suites...' : 'Run All Test Suites'}</span>
          </button>

          {suites && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`font-bold px-2 py-0.5 rounded-full border ${
                  allPassed
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                    : 'bg-rose-950 text-rose-300 border-rose-500/50'
                }`}
              >
                {allPassed ? 'ALL SUITES PASSED' : 'TESTS FAILED'}
              </span>
              <span className="text-slate-400">
                ({passedTests}/{totalTests} tests passed)
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {!suites && !isRunning && !error && (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <ShieldCheck className="h-10 w-10 text-cyan-400/50 mx-auto" />
              <p className="text-xs">Click "Run All Test Suites" to verify SSRF blocking, fingerprinting, and scoring algorithms.</p>
            </div>
          )}

          {suites && (
            <div className="space-y-4">
              {suites.map((suite, idx) => (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      {suite.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                      <span className="text-xs font-bold text-white">{suite.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{suite.durationMs}ms</span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    {suite.tests.map((test, tIdx) => (
                      <div
                        key={tIdx}
                        className={`flex items-start justify-between p-2 rounded ${
                          test.passed ? 'bg-slate-900/40 text-slate-300' : 'bg-rose-950/30 text-rose-300'
                        }`}
                      >
                        <span className="truncate max-w-md">{test.name}</span>
                        <span className="shrink-0 font-bold ml-2">
                          {test.passed ? (
                            <span className="text-emerald-400">PASS</span>
                          ) : (
                            <span className="text-rose-400">FAIL</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
