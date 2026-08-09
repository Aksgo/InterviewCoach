import type { ScoreData } from "../utils/storage";
import { AlertTriangle, TrendingUp, Sparkles, FileText } from "lucide-react";

interface EvaluationScorecardProps {
  scores: ScoreData;
}

const dimensions: { key: "relevance" | "clarity" | "depth" | "confidence"; label: string; description: string; color: string }[] = [
  { key: "relevance", label: "Relevance", description: "How directly answers address prompt & role", color: "text-accent" },
  { key: "clarity", label: "Clarity", description: "STAR structure, logical flow & articulation", color: "text-primary" },
  { key: "depth", label: "Depth", description: "Metrics, technical terms & quantifiable impact", color: "text-secondary" },
  { key: "confidence", label: "Confidence", description: "Conviction, action verbs & delivery tone", color: "text-accent" },
];

function ScoreRing({ value, color }: { value: number; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 10) * circumference;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="oklch(0.91 0.0927 180.43)" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        className={`${color} transition-all duration-1000 ease-out`}
      />
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-lg font-bold" fontSize="16">
        {value}
      </text>
    </svg>
  );
}

export default function EvaluationScorecard({ scores }: EvaluationScorecardProps) {
  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center mb-2">
          <ScoreRing value={scores.overall} color="text-accent" />
        </div>
        <p className="text-2xl font-bold text-foreground">{scores.overall}/10</p>
        <p className="text-xs text-foreground/40 uppercase tracking-wider font-semibold">Overall Delivery Score</p>
      </div>

      {/* Dimension Scores */}
      <div className="grid grid-cols-2 gap-3">
        {dimensions.map((dim) => (
          <div key={dim.key} className="card !p-4 text-center animate-fade-in flex flex-col items-center">
            <ScoreRing value={scores[dim.key]} color={dim.color} />
            <p className="text-sm font-semibold mt-2">{dim.label}</p>
            <p className="text-[11px] text-foreground/50 leading-tight mt-1">{dim.description}</p>
          </div>
        ))}
      </div>

      {/* Net Executive Summary */}
      {scores.summary && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-slate-900">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Executive Performance Summary</h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-normal">{scores.summary}</p>
        </div>
      )}

      {/* Topics Breakdown: Mistakes & Suggested Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Topic 1: Mistakes & Weaknesses */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4.5 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-950 font-bold text-sm border-b border-amber-200/60 pb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Key Mistakes &amp; Weaknesses</span>
          </div>
          {scores.mistakes && scores.mistakes.length > 0 ? (
            <ul className="space-y-2 text-xs text-amber-900">
              {scores.mistakes.map((m, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-900/70 italic">No major structural mistakes detected across your answers.</p>
          )}
        </div>

        {/* Topic 2: Suggested Improvements */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4.5 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm border-b border-emerald-200/60 pb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Suggested Improvements</span>
          </div>
          {scores.improvements && scores.improvements.length > 0 ? (
            <ul className="space-y-2 text-xs text-emerald-900">
              {scores.improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-900/70 italic">Continue practicing to maintain answer conciseness and articulation.</p>
          )}
        </div>
      </div>
    </div>
  );
}