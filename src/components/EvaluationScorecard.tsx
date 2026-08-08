import type { ScoreData } from "../utils/storage";

interface EvaluationScorecardProps {
  scores: ScoreData;
}

const dimensions: { key: "relevance" | "clarity" | "depth" | "confidence"; label: string; description: string; color: string }[] = [
  { key: "relevance", label: "Relevance", description: "How well your answer addressed the question", color: "text-accent" },
  { key: "clarity", label: "Clarity", description: "Structure, conciseness, and articulation", color: "text-primary" },
  { key: "depth", label: "Depth", description: "Technical depth and comprehensiveness", color: "text-secondary" },
  { key: "confidence", label: "Confidence", description: "Conviction and certainty in delivery", color: "text-accent" },
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
        <p className="text-xs text-foreground/40 uppercase tracking-wider">Overall Score</p>
      </div>

      {/* Dimension Scores */}
      <div className="grid grid-cols-2 gap-3">
        {dimensions.map((dim) => (
          <div key={dim.key} className="card !p-4 text-center animate-fade-in">
            <ScoreRing value={scores[dim.key]} color={dim.color} />
            <p className="text-sm font-semibold mt-2">{dim.label}</p>
            <p className="text-[11px] text-foreground/50 leading-tight mt-1">{dim.description}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      {scores.summary && (
        <div className="bg-muted rounded-xl p-4 border border-border/30">
          <p className="text-xs text-foreground/40 uppercase tracking-wider font-semibold mb-2">Summary</p>
          <p className="text-sm leading-relaxed text-foreground/80">{scores.summary}</p>
        </div>
      )}
    </div>
  );
}