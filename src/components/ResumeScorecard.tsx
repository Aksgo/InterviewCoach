import { CheckCircle2, AlertTriangle, Lightbulb, FileCheck } from "lucide-react";
import type { ResumeScoreData } from "../utils/storage";

interface ResumeScorecardProps {
  resumeScore: ResumeScoreData;
  company: string;
  role: string;
}

export default function ResumeScorecard({ resumeScore, company, role }: ResumeScorecardProps) {
  const { overallScore, matchLevel, summary, strengths, gaps, recommendations } = resumeScore;

  // Determine score color badge
  const scoreColorClass =
    overallScore >= 80
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : overallScore >= 65
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-rose-600 bg-rose-50 border-rose-200";

  return (
    <div className="card p-5 border border-border/60 shadow-sm rounded-xl space-y-5 animate-fade-in bg-white">
      {/* Header with Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-foreground">Resume Match Analysis</h3>
          </div>
          <p className="text-xs text-foreground/60">
            Tailored match for <span className="font-semibold text-foreground">{role}</span> at{" "}
            <span className="font-semibold text-foreground">{company}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${scoreColorClass}`}>
            {matchLevel}
          </div>
          <div className="flex items-baseline gap-1 bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/20">
            <span className="text-2xl font-extrabold text-accent">{overallScore}%</span>
            <span className="text-xs text-foreground/50 font-medium">Match Score</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="p-3.5 rounded-lg bg-muted/50 border border-border/40 text-xs text-foreground/80 leading-relaxed">
          <span className="font-semibold text-foreground">ATS Assessment: </span>
          {summary}
        </div>
      )}

      {/* Detailed Analysis Grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Matching Strengths</span>
            </div>
            <ul className="space-y-1.5 text-xs text-emerald-900/80">
              {strengths.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps / Missing keywords */}
        {gaps && gaps.length > 0 && (
          <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Missing Keywords / Gaps</span>
            </div>
            <ul className="space-y-1.5 text-xs text-amber-900/80">
              {gaps.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
              <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Tailoring Tips</span>
            </div>
            <ul className="space-y-1.5 text-xs text-blue-900/80">
              {recommendations.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
