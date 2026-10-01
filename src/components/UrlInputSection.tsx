import React, { useState } from 'react';
import { Play, Sliders, Shield, ArrowRight, Sparkles, CheckCircle2, AlertTriangle, Globe } from 'lucide-react';
import { AuditConfig, TargetPreset } from '../types/audit';
import { TARGET_PRESETS } from '../lib/engine/presets';
import { validateTargetUrl } from '../lib/security/urlValidator';

interface UrlInputSectionProps {
  onStartAudit: (url: string, config?: Partial<AuditConfig>) => void;
  isRunning: boolean;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  onStartAudit,
  isRunning,
}) => {
  const [inputUrl, setInputUrl] = useState<string>('https://saas-demo.ailaunchqa.dev/v1/preview');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Custom Config State
  const [maxPages, setMaxPages] = useState<number>(5);
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [enableA11y, setEnableA11y] = useState<boolean>(true);
  const [enablePerformance, setEnablePerformance] = useState<boolean>(true);
  const [enableAI, setEnableAI] = useState<boolean>(true);
  const [selectedViewports, setSelectedViewports] = useState<string[]>([
    'Desktop (1440x900)',
    'Mobile (390x844)',
    'Tablet (768x1024)',
  ]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    if (val.trim()) {
      const result = validateTargetUrl(val);
      if (!result.isValid) {
        setValidationError(result.error || 'Invalid URL');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  };

  const handlePresetSelect = (preset: TargetPreset) => {
    setInputUrl(preset.url);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) {
      setValidationError('Please enter a target website URL.');
      return;
    }

    const result = validateTargetUrl(inputUrl);
    if (!result.isValid) {
      setValidationError(result.error || 'Invalid URL');
      return;
    }

    if (!acceptedTerms) {
      setValidationError('Please acknowledge the authorized-use terms before launching the audit.');
      return;
    }

    setValidationError(null);
    onStartAudit(result.normalizedUrl || inputUrl, {
      maxPages,
      maxDepth,
      enableA11y,
      enablePerformance,
      enableAI,
    });
  };

  const toggleViewport = (name: string) => {
    if (selectedViewports.includes(name)) {
      if (selectedViewports.length > 1) {
        setSelectedViewports(selectedViewports.filter((v) => v !== name));
      }
    } else {
      setSelectedViewports([...selectedViewports, name]);
    }
  };

  return (
    <div className="w-full">
      {/* Hero Headline */}
      <div className="text-center max-w-3xl mx-auto mb-8 pt-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-semibold text-cyan-300 mb-4 shadow-inner">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>Evidence-First Pre-Launch Quality Gate</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          What is wrong with your deployed web app{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            before you launch it?
          </span>
        </h1>
        <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
          Deterministic technical audits + axe accessibility + mobile responsive simulation + Gemini multimodal visual reasoning. Evidence before assumptions.
        </p>
      </div>

      {/* Main Audit Form Card */}
      <div className="max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Target URL Input Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Globe className="h-5 w-5 text-cyan-400" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={handleUrlChange}
                placeholder="https://your-deployed-app.vercel.app or example.com"
                disabled={isRunning}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-60 transition-all font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                disabled={isRunning}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-3 text-xs font-semibold transition-all ${
                  showConfig
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
                title="Configure Viewports and Audit Scope"
              >
                <Sliders className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </button>

              <button
                type="submit"
                disabled={isRunning}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isRunning ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Auditing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Run Pre-Launch QA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation or SSRF error */}
          {validationError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-500/40 px-3 py-2 text-xs text-rose-300 animate-fadeIn">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Preset Buttons for Quick Testing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Quick Test Targets & Benchmarks:</span>
              <span className="text-[11px] text-slate-500">1-click audit simulation</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TARGET_PRESETS.map((preset) => {
                const isSelected = inputUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500/40'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{preset.name}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          preset.badgeColor === 'amber'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                            : preset.badgeColor === 'emerald'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Config Section */}
          {showConfig && (
            <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Crawl & Limits */}
              <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Crawl & Scope Bounds</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Max Pages to Crawl</label>
                    <select
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                    >
                      <option value={1}>1 Page (Root Only)</option>
                      <option value={3}>3 Pages</option>
                      <option value={5}>5 Pages (Recommended)</option>
                      <option value={10}>10 Pages (Deep)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Max Depth</label>
                    <select
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                    >
                      <option value={1}>Depth 1</option>
                      <option value={2}>Depth 2</option>
                      <option value={3}>Depth 3</option>
                    </select>
                  </div>
                </div>

                {/* Check Module Toggles */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableA11y}
                      onChange={(e) => setEnableA11y(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>axe-core A11y</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePerformance}
                      onChange={(e) => setEnablePerformance(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Core Web Vitals</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableAI}
                      onChange={(e) => setEnableAI(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span>Gemini Visual/UX</span>
                  </label>
                </div>
              </div>

              {/* Viewport Selection */}
              <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Target Viewports</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Desktop (1440x900)',
                    'Mobile (390x844)',
                    'Tablet (768x1024)',
                    'Compact Mobile (375x812)',
                  ].map((vp) => {
                    const isChecked = selectedViewports.includes(vp);
                    return (
                      <button
                        key={vp}
                        type="button"
                        onClick={() => toggleViewport(vp)}
                        className={`text-left p-2 rounded-lg border text-[11px] font-medium transition-all ${
                          isChecked
                            ? 'border-cyan-500/60 bg-cyan-950/30 text-cyan-200'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {vp}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Terms & Authorization Checkbox */}
          <div className="pt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20"
              />
              <span>I confirm I am authorized to audit this target URL and its public resources.</span>
            </label>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
              <Shield className="h-3 w-3 text-emerald-400" />
              Isolated Chromium Sandbox
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
