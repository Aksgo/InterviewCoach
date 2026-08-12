import React, { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { BarChart3, PieChart as PieIcon, Activity, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import type { ScoreData, InterviewQuestion } from "../utils/storage";

interface PerformanceChartsProps {
  scores: ScoreData;
  questions?: InterviewQuestion[];
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ scores, questions = [] }) => {
  const [activeTab, setActiveTab] = useState<"radar" | "breakdown" | "pacing">("radar");

  // Radar chart data for core delivery dimensions
  const radarData = [
    { metric: "Clarity", score: scores.clarity, fullMark: 10 },
    { metric: "Technical Depth", score: scores.depth, fullMark: 10 },
    { metric: "Confidence Score", score: scores.confidence, fullMark: 10 },
    { metric: "Relevance", score: scores.relevance, fullMark: 10 },
    { metric: "Overall Score", score: scores.overall, fullMark: 10 },
  ];

  // Question-by-question metrics breakdown
  const questionData = questions.map((q, idx) => ({
    name: `Q${idx + 1}`,
    stage: q.stageName || `Stage ${idx + 1}`,
    Clarity: q.clarity ?? scores.clarity,
    "Technical Depth": q.depth ?? scores.depth,
    "Confidence Score": q.confidence ?? scores.confidence,
    Relevance: q.relevance ?? scores.relevance,
    "Overall Score": q.score ?? scores.overall,
    timeSeconds: q.timeToAnswerSeconds ?? 15,
  }));

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 border border-border p-3 rounded-xl shadow-xl text-xs space-y-1 backdrop-blur-md">
          <p className="font-bold text-foreground border-b border-border/60 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="font-semibold flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold font-mono text-foreground">
                {entry.value}
                {entry.unit || "/10"}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-xs space-y-5">
      {/* Header & View Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>Performance Analytics Visualization</span>
              <span className="text-[10px] bg-primary/10 text-primary font-mono px-2 py-0.5 rounded-full font-bold">
                Recharts Powered
              </span>
            </h3>
            <p className="text-[11px] text-foreground/60">
              Interactive visualization of clarity, technical depth, and confidence metrics
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("radar")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "radar"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-primary" />
            <span>Delivery Radar</span>
          </button>

          {questions.length > 0 && (
            <button
              onClick={() => setActiveTab("breakdown")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "breakdown"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span>Per-Question Breakdown</span>
            </button>
          )}

          {questions.length > 0 && (
            <button
              onClick={() => setActiveTab("pacing")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "pacing"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pacing &amp; Duration</span>
            </button>
          )}
        </div>
      </div>

      {/* CHART CONTENT VIEWS */}

      {/* VIEW 1: RADAR CHART */}
      {activeTab === "radar" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
          <div className="md:col-span-7 h-[280px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="var(--border)" strokeOpacity={0.6} />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="var(--muted-foreground)" fontSize={10} />
                <Radar
                  name="Candidate Performance"
                  dataKey="score"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.45}
                  strokeWidth={2.5}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metric Summary Legend Grid */}
          <div className="md:col-span-5 space-y-2.5 text-left">
            <p className="text-xs font-bold text-foreground flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Delivery Dimension Ratings</span>
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Clarity &amp; Structure</p>
                  <p className="text-[10px] text-foreground/60">STAR format &amp; articulation</p>
                </div>
                <span className="text-base font-extrabold text-primary font-mono">{scores.clarity}/10</span>
              </div>

              <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Technical Depth</p>
                  <p className="text-[10px] text-foreground/60">System trade-offs &amp; code accuracy</p>
                </div>
                <span className="text-base font-extrabold text-accent font-mono">{scores.depth}/10</span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Confidence Score</p>
                  <p className="text-[10px] text-foreground/60">Conviction &amp; voice tone</p>
                </div>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {scores.confidence}/10
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Relevance &amp; Match</p>
                  <p className="text-[10px] text-foreground/60">Directness to role prompts</p>
                </div>
                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  {scores.relevance}/10
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: QUESTION-BY-QUESTION BREAKDOWN BAR CHART */}
      {activeTab === "breakdown" && questions.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Question Performance Scores (Clarity, Depth, Confidence)</span>
            <span className="text-foreground/50 text-[11px]">Hover over bars to inspect individual metrics</span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--foreground)" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 10]} stroke="var(--foreground)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="Clarity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Technical Depth" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Confidence Score" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Relevance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VIEW 3: RESPONSE TIME & PACING AREA CHART */}
      {activeTab === "pacing" && questions.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Response Duration per Question (Seconds)</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Optimal pacing: 15s - 90s per response
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={questionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--foreground)" fontSize={11} />
                <YAxis stroke="var(--foreground)" fontSize={11} unit="s" />
                <Tooltip
                  formatter={(value: any) => [`${value} seconds`, "Time to Answer"]}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="timeSeconds"
                  name="Answer Time (Seconds)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTime)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceCharts;
