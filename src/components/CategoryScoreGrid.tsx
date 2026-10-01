import React from 'react';
import {
  Activity,
  Smartphone,
  Accessibility,
  Zap,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { CategoryScore, QACategory } from '../types/audit';

interface CategoryScoreGridProps {
  categoryScores: CategoryScore[];
  selectedCategory: QACategory | 'all';
  onSelectCategory: (category: QACategory | 'all') => void;
  onOpenDeepDive: (category: QACategory) => void;
}

const CATEGORY_ICONS: Record<QACategory, React.ReactNode> = {
  functionality: <Activity className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  accessibility: <Accessibility className="h-4 w-4" />,
  performance: <Zap className="h-4 w-4" />,
  visual_ux: <Sparkles className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
};

export const CategoryScoreGrid: React.FC<CategoryScoreGridProps> = ({
  categoryScores,
  selectedCategory,
  onSelectCategory,
  onOpenDeepDive,
}) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          QA Category Pillar Breakdown
        </h3>
        <button
          onClick={() => onSelectCategory('all')}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
            selectedCategory === 'all'
              ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
              : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'
          }`}
        >
          View All Findings
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {categoryScores.map((cat) => {
          const isSelected = selectedCategory === cat.category;
          const isPass = cat.status === 'pass';
          const isWarn = cat.status === 'warn';

          return (
            <div
              key={cat.category}
              onClick={() => onSelectCategory(cat.category)}
              className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-950/40'
                  : 'border-slate-800/90 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isPass
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                          : isWarn
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {CATEGORY_ICONS[cat.category]}
                    </div>
                    <span className="text-xs font-bold text-slate-200">
                      {cat.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      isPass
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : isWarn
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                        : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {cat.status.toUpperCase()}
                  </span>
                </div>

                {/* Score & Weight */}
                <div className="flex items-baseline justify-between mt-3 mb-1.5">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        cat.score >= 85
                          ? 'text-emerald-400'
                          : cat.score >= 70
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {cat.score}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">/100</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Weight: {Math.round(cat.weight * 100)}%
                  </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      cat.score >= 85
                        ? 'bg-emerald-500'
                        : cat.score >= 70
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>

              {/* Pass / Fail metrics & Deep dive link */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    {cat.passedCount} Passed
                  </span>
                  {cat.failedCount > 0 && (
                    <span className="flex items-center gap-1 text-rose-400 font-medium">
                      <XCircle className="h-3 w-3" />
                      {cat.failedCount} Failed
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDeepDive(cat.category);
                  }}
                  className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 font-semibold group-hover:translate-x-0.5 transition-transform"
                >
                  <span>Checks</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
