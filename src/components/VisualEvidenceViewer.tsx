import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AuditReport, Finding } from '../types/audit';

interface VisualEvidenceViewerProps {
  report: AuditReport;
  onSelectFinding: (finding: Finding) => void;
  onClose: () => void;
}

export const VisualEvidenceViewer: React.FC<VisualEvidenceViewerProps> = ({
  report,
  onSelectFinding,
  onClose,
}) => {
  const [activeViewport, setActiveViewport] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');

  const viewportConfig = {
    desktop: { name: 'Desktop (1440x900)', width: 'max-w-4xl', scale: 'scale-100' },
    tablet: { name: 'Tablet (768x1024)', width: 'max-w-xl', scale: 'scale-95' },
    mobile: { name: 'Mobile (390x844)', width: 'max-w-xs', scale: 'scale-100' },
  };

  const mobileFindings = report.findings.filter((f) => f.category === 'mobile' || f.category === 'visual_ux');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Visual Evidence & Multi-Viewport Sandbox</h3>
              <p className="text-xs text-slate-400">Target: {report.targetUrl}</p>
            </div>
          </div>

          {/* Viewport Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveViewport('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeViewport === 'desktop'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setActiveViewport('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeViewport === 'tablet'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="h-3.5 w-3.5" />
              <span>Tablet</span>
            </button>
            <button
              onClick={() => setActiveViewport('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeViewport === 'mobile'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile 390px</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Canvas Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40 flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Mock Browser Frame */}
          <div className={`w-full ${viewportConfig[activeViewport].width} transition-all duration-300`}>
            <div className="rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
              {/* Browser Address Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2 text-xs">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-slate-400 truncate max-w-xs text-[11px]">
                  {report.targetUrl}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {viewportConfig[activeViewport].name}
                </span>
              </div>

              {/* Mock Rendered Page Area */}
              <div className="p-4 sm:p-6 bg-slate-950 space-y-4 font-sans text-left">
                {/* Header Mock */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="font-bold text-white text-sm">AppLogo</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Features</span>
                    <span>Pricing</span>
                    {/* Defect Highlight: Broken Doc Link */}
                    <span className="relative p-1 rounded border border-rose-500/80 bg-rose-500/10 text-rose-300 font-mono text-[10px] animate-pulse">
                      Docs (404)
                    </span>
                  </div>
                </div>

                {/* Hero Section Mock */}
                <div className="space-y-3 pt-2">
                  <div className="h-7 w-3/4 bg-slate-800 rounded font-extrabold text-white text-base flex items-center px-2">
                    Build Faster With Intelligent Automation
                  </div>

                  {/* Defect Highlight: Contrast Issue */}
                  <div className="relative p-2 rounded border border-amber-500/80 bg-amber-500/10 text-slate-400 text-xs">
                    <span className="text-[#64748b]">
                      Continuous quality intelligence for modern web applications.
                    </span>
                    <span className="absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1 rounded">
                      Low Contrast (3.1:1)
                    </span>
                  </div>

                  {/* Defect Highlight: Buttons (Dead CTA / Clipping) */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow">
                      Start Free Audit
                    </button>

                    <div className="relative">
                      <button className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-lg border border-rose-500/80 bg-rose-500/10">
                        Schedule Live Demo
                      </button>
                      <span className="absolute -top-2 -right-1 bg-rose-600 text-white text-[8px] font-bold px-1 rounded">
                        Dead Click
                      </span>
                    </div>
                  </div>
                </div>

                {/* Defect Highlight: Horizontal Overflow Box on Mobile */}
                {activeViewport === 'mobile' && (
                  <div className="mt-4 p-3 rounded-xl border-2 border-rose-500 bg-rose-950/40 text-rose-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Horizontal Overflow Detected (w-[430px] on 390px Viewport)</span>
                    </div>
                    <p className="text-[11px] text-rose-300 leading-tight">
                      This element overflows 40px past the screen right margin, causing side-scrolling.
                    </p>
                  </div>
                )}

                {/* Mock Card Grid */}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
                    <div className="h-3 w-16 bg-slate-700 rounded mb-1.5" />
                    <div className="h-2 w-full bg-slate-800 rounded mb-1" />
                    <div className="h-2 w-2/3 bg-slate-800 rounded" />
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
                    <div className="h-3 w-16 bg-slate-700 rounded mb-1.5" />
                    <div className="h-2 w-full bg-slate-800 rounded mb-1" />
                    <div className="h-2 w-2/3 bg-slate-800 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Overlay Findings Panel */}
          <div className="w-full lg:w-80 rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Defects in this Viewport
              </span>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {mobileFindings.length} Items
              </span>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {mobileFindings.map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectFinding(f)}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950 hover:border-cyan-500/50 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                        f.severity === 'critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {f.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white leading-snug">
                    {f.title}
                  </h5>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {f.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
