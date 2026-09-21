import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Zap,
  Truck,
  Lightbulb,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Reveal from "./Reveal";
import { useFlash } from "../hook/useFlash";
import {
  COMMODITIES,
  FACTORS,
  factorRelevance,
  relevanceTrend,
  fmtUsd,
  type CommodityId,
  type Direction,
  type Factor,
  type Magnitude,
} from "../lib/model";
import { EVENTS, emit } from "../lib/events";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: typeof Zap }> = {
  Logistics: { bg: "bg-teal-400/10", text: "text-teal-300", border: "border-teal-400/30", icon: Truck },
  Operations: { bg: "bg-amber-400/10", text: "text-amber-300", border: "border-amber-400/30", icon: Zap },
  Strategy: { bg: "bg-blue-400/10", text: "text-blue-300", border: "border-blue-400/30", icon: Lightbulb },
  Finance: { bg: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-400/30", icon: TrendingUp },
  Risk: { bg: "bg-rose-400/10", text: "text-rose-300", border: "border-rose-400/30", icon: AlertTriangle },
};

const PRIORITY_COLORS = {
  High: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  Medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  Low: "text-slate-300 border-line bg-white/[0.03]",
};

function SolutionCard({
  solution,
  index,
  factors,
}: {
  solution: {
    id: string;
    title: string;
    description: string;
    impact: string;
    priority: "High" | "Medium" | "Low";
    category: string;
    relatedFactorIds: string[];
  };
  index: number;
  factors: Factor[];
}) {
  const cls = useFlash(solution.title.length);
  const categoryStyle = CATEGORY_COLORS[solution.category] ?? CATEGORY_COLORS.Strategy;
  const CategoryIcon = categoryStyle.icon;
  const relatedFactors = solution.relatedFactorIds
    .map((id) => factors.find((f) => f.id === id))
    .filter((f): f is Factor => f !== null)
    .slice(0, 3);

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel/60 p-5 transition-all duration-300 hover:border-line-strong hover:bg-panel ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${categoryStyle.border} ${categoryStyle.bg} ${categoryStyle.text}`}
          >
            <CategoryIcon className="h-3 w-3" />
            {solution.category}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[solution.priority]}`}>
            {solution.priority} Priority
          </span>
        </div>
        <span className="font-display text-xs font-bold text-slate-600">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <h3 className="mt-4 font-display text-base font-semibold text-white leading-snug">
        {solution.title}
      </h3>

      <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-400">{solution.description}</p>

      <div className="mt-4 rounded-xl border border-line bg-base/40 px-3 py-3">
        <div className="flex items-center gap-2">
          {solution.priority === "High" ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-rose-300" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Expected Impact</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{solution.impact}</p>
      </div>

      {relatedFactors.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Derived from factors:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {relatedFactors.map((f) => (
              <span
                key={f.id}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium border border-line bg-base/50 text-slate-400"
              >
                {f.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

interface SolutionsSectionProps {
  factors: Factor[];
  healthStatus: "Initializing AI" | "Online Model Connected" | "Offline Model";
  solutions?: { id: string; title: string; description: string; impact: string; priority: string; category: string; relatedFactorIds: string[] }[];
  onSolutionsUpdate?: (solutions: any[]) => void;
}

export default function SolutionsSection({
  factors,
  healthStatus,
  solutions,
  onSolutionsUpdate,
}: SolutionsSectionProps) {
  const isOnline = healthStatus === "Online Model Connected";
  const hasSolutions = solutions && solutions.length > 0;

  // Notify parent of solutions updates
  useEffect(() => {
    if (hasSolutions && onSolutionsUpdate) {
      onSolutionsUpdate(solutions);
    }
  }, [hasSolutions, solutions, onSolutionsUpdate]);

  const sorted = useMemo(() => {
    if (!hasSolutions) return [];
    return [...solutions].sort((a, b) => {
      const pa = a.priority === "High" ? 3 : a.priority === "Medium" ? 2 : 1;
      const pb = b.priority === "High" ? 3 : b.priority === "Medium" ? 2 : 1;
      return pb - pa;
    });
  }, [hasSolutions, solutions]);

  return (
    <section id="solutions" className="relative scroll-mt-20 border-t border-line py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="mb-10 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300/80">
              Dynamic Solutions
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {isOnline ? "AI-Curated Solutions" : "Dynamic Solutions"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {isOnline
                ? "Live AI-generated strategies derived from current market factors. Solutions adapt automatically as new trends are identified — the oldest solution is discarded when a new one appears."
                : "AI-generated strategies to help business owners and executives make better logistical and business decisions. Updates dynamically based on market conditions."}
            </p>
            {isOnline && (
              <p className="mt-2 text-xs text-teal-300/80">
                Status: {healthStatus}
              </p>
            )}
          </div>
        </Reveal>

        {hasSolutions ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((s, i) => (
              <Reveal key={s.id} delay={Math.min(i * 80, 320)}>
                <SolutionCard solution={s} index={i} factors={factors} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-panel/30 p-8 text-center min-h-[240px]">
                  <Lightbulb className="h-8 w-8 text-slate-600 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Solution {i + 1}</p>
                  <p className="text-xs text-slate-600 mt-1">Generating AI solutions based on current factors...</p>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal delay={400}>
          <p className="mt-8 text-center text-[11px] text-slate-600">
            Solutions are regenerated automatically as market factors change. Each solution is derived directly from the dynamic factors displayed above.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
