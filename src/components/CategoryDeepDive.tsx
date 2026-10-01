import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Smartphone,
  Accessibility,
  Zap,
  Sparkles,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { CategoryScore, QACategory } from '../types/audit';

interface CategoryDeepDiveProps {
  categoryScores: CategoryScore[];
  initialCategory?: QACategory;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<QACategory, React.ReactNode> = {
  functionality: <Activity className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  accessibility: <Accessibility className="h-4 w-4" />,
  performance: <Zap className="h-4 w-4" />,
  visual_ux: <Sparkles className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
};

export const CategoryDeepDive: React.FC<CategoryDeepDiveProps> = ({
  categoryScores,
  initialCategory = 'functionality',
  onClose,
}) => {
  const [selectedCat, setSelectedCat] = useState<QACategory>(initialCategory);

  const activeCategory = categoryScores.find((c) => c.category === selectedCat) || categoryScores[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Full QA Check Registry & Rules</span>
              <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                28 Deterministic & AI Tests
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Inspect pass/fail results for every discrete audit check.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-950/40 px-5 text-xs font-semibold scrollbar-none">
          {categoryScores.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setSelectedCat(cat.category)}
              className={`flex items-center gap-2 py-3 border-b-2 transition-all mr-5 shrink-0 ${
                selectedCat === cat.category
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {CATEGORY_ICONS[cat.category]}
              <span>{cat.name}</span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  cat.score >= 85
                    ? 'bg-emerald-950 text-emerald-400'
                    : cat.score >= 70
                    ? 'bg-amber-950 text-amber-400'
                    : 'bg-rose-950 text-rose-400'
                }`}
              >
                {cat.score}
              </span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Category Metric Header */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{activeCategory.name}</span>
                <span className="text-xs text-slate-400">
                  (Category Weight: {Math.round(activeCategory.weight * 100)}%)
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeCategory.passedCount} checks passed, {activeCategory.failedCount} failures, {activeCategory.warningCount} warnings
              </p>
            </div>

            <div className="flex items-baseline gap-1 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xl font-black text-cyan-400 font-mono">
                {activeCategory.score}
              </span>
              <span className="text-xs text-slate-500">/100</span>
            </div>
          </div>

          {/* List of checks in this category */}
          <div className="space-y-2.5">
            {activeCategory.checks.map((check) => (
              <div
                key={check.id}
                className={`rounded-xl border p-3.5 text-xs transition-all ${
                  check.passed
                    ? 'border-slate-800 bg-slate-950/60'
                    : 'border-rose-500/40 bg-rose-950/20 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {check.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {check.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          #{check.id}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                        {check.details}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      check.passed
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                    }`}
                  >
                    {check.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
