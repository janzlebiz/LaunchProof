import React from 'react';
import { ShieldCheck, History, ShieldAlert, Sparkles, Terminal } from 'lucide-react';

interface NavbarProps {
  onOpenHistory: () => void;
  onOpenSecurity: () => void;
  auditCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenHistory,
  onOpenSecurity,
  auditCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-950">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-white">
                Launch<span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Proof</span>
              </span>
              <span className="rounded-full bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Automated Pre-Launch Evidence & AI Reasoning</p>
          </div>
        </div>

        {/* Right Action Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* SSRF Protection Badge */}
          <button
            onClick={onOpenSecurity}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-all shadow-sm"
            title="SSRF Protection & Isolation Policy"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
            <span>SSRF Shield Active</span>
          </button>

          {/* AI Reasoner Status */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/30 px-3 py-1.5 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Gemini Multimodal</span>
          </div>

          {/* Audit History Drawer Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-slate-800 transition-all"
          >
            <History className="h-3.5 w-3.5 text-slate-400" />
            <span>History</span>
            {auditCount > 0 && (
              <span className="ml-1 rounded-full bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 text-[10px] font-bold">
                {auditCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
