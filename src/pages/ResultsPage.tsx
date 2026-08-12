import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Download, Sparkles, RefreshCw, Globe, ExternalLink, Clock, Zap, CheckCircle2, Timer, Code2 } from "lucide-react";
import EvaluationScorecard from "../components/EvaluationScorecard";
import ResumeScorecard from "../components/ResumeScorecard";
import AICostReport from "../components/AICostReport";
import { loadSession, saveSession, clearSession } from "../utils/storage";
import type { InterviewSession } from "../utils/storage";
import { downloadResultsAsPDF } from "../utils/pdf";

export default function ResultsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.status !== "completed") {
      navigate("/", { replace: true });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session || !session.scores) {
    return null;
  }

  const handleTryAgain = () => {
    clearSession();
    navigate("/");
  };

  const handleRetrySpecificQuestion = (index: number) => {
    const updatedSession: InterviewSession = {
      ...session,
      currentQuestionIndex: index,
      status: "in_progress",
    };
    saveSession(updatedSession);
    navigate("/interview");
  };

  const handleDownloadPDF = () => {
    downloadResultsAsPDF(session);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] space-y-8">
      {/* Header */}
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Interview Complete
        </div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground mb-2">
          Your Performance Report
        </h1>
        <p className="text-foreground/60">
          Target Position: <strong className="text-foreground">{session.role}</strong> ({session.experienceLevel || "Fresher / Entry Level"}) at{" "}
          <strong className="text-foreground">{session.company}</strong>
        </p>
      </div>

      {/* Resume Score Match Breakdown */}
      {session.resumeScore && (
        <section className="animate-slide-up">
          <ResumeScorecard
            resumeScore={session.resumeScore}
            company={session.company}
            role={session.role}
          />
        </section>
      )}

      {/* Overall Interview Performance Scorecard */}
      <section className="animate-slide-up">
        <h2 className="text-lg font-bold text-foreground mb-3">Interview Delivery Scores</h2>
        <EvaluationScorecard scores={session.scores} questions={session.questions} />
      </section>

      {/* AI Processing Cost Ledger */}
      <section className="animate-slide-up">
        <h2 className="text-lg font-bold text-foreground mb-3">Billing & AI Cost Ledger</h2>
        <AICostReport session={session} />
      </section>

      {/* Questions Review */}
      <section className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <h2 className="text-lg font-bold text-foreground mb-4">Question Review & Retry</h2>
        <div className="space-y-3">
          {session.questions.map((q, i) => (
            <div key={q.id} className="card p-4 animate-fade-in space-y-3" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Stage & Agent Badge */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                      <Sparkles className="w-2.5 h-2.5" /> {q.stageName || "Stage Interview"}
                    </span>
                    {q.agentName && (
                      <span className="text-[11px] font-semibold text-foreground/80">
                        Evaluated by: {q.agentName}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-foreground mb-1">
                    <span className="text-primary">Q{i + 1}:</span> {q.text}
                  </p>

                  {/* Provenance badge */}
                  <div className="flex items-center gap-2 my-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-semibold">
                      <Globe className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{q.sourceName || "Glassdoor / LeetCode"}</span>
                    </span>
                    {q.originExplanation && (
                      <span className="text-[11px] text-foreground/60 italic">
                        &bull; {q.originExplanation}
                      </span>
                    )}
                    {q.sourceUrl && (
                      <a
                        href={q.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-[10px] font-semibold ml-auto"
                      >
                        Source Link <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {q.followUpQuestion && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 p-2.5 rounded-lg text-xs font-medium">
                      <strong>Interviewer Follow-Up Probe:</strong> "{q.followUpQuestion}"
                    </div>
                  )}

                  {q.answerTranscript ? (
                    <p className="text-xs text-foreground/70 leading-relaxed mt-1 bg-muted/40 p-2.5 rounded-lg italic">
                      "{q.answerTranscript}"
                    </p>
                  ) : !q.writtenCode && (
                    <p className="text-xs text-foreground/40 italic">No answer recorded</p>
                  )}

                  {q.writtenCode && (
                    <div className="mt-2 bg-zinc-950 text-emerald-400 p-3 rounded-lg border border-zinc-800 text-xs font-mono overflow-x-auto">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-sans font-semibold mb-1">
                        <Code2 className="w-3 h-3 text-primary" /> Submitted Code / Written Solution:
                      </div>
                      <pre className="whitespace-pre-wrap">{q.writtenCode}</pre>
                    </div>
                  )}
                  {q.feedback && (
                    <p className="text-xs text-foreground/80 leading-relaxed mt-2 bg-primary/5 border border-primary/10 p-2.5 rounded-lg">
                      <strong className="text-primary font-bold">Question Feedback:</strong> {q.feedback}
                    </p>
                  )}

                  {/* 4-Dimension Metric Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[10px] font-semibold">
                    {q.relevance !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground/70">
                        Relevance: <strong className="text-foreground">{q.relevance}/10</strong>
                      </span>
                    )}
                    {q.clarity !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground/70">
                        Clarity: <strong className="text-foreground">{q.clarity}/10</strong>
                      </span>
                    )}
                    {q.depth !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground/70">
                        Depth: <strong className="text-foreground">{q.depth}/10</strong>
                      </span>
                    )}
                    {q.confidence !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground/70">
                        Confidence: <strong className="text-foreground">{q.confidence}/10</strong>
                      </span>
                    )}
                  </div>

                  {/* Time to Answer & Pacing / Confidence Analysis */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2.5 border-t border-border/50 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                      Time to Answer: <strong className="font-mono text-foreground">{q.timeToAnswerSeconds !== undefined ? `${q.timeToAnswerSeconds}s` : "N/A"}</strong>
                    </span>

                    {q.timeToAnswerSeconds !== undefined && (
                      q.timeToAnswerSeconds < 8 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[11px] font-semibold">
                          <Zap className="w-3 h-3 text-amber-500 shrink-0" /> Answered Very Fast ({q.timeToAnswerSeconds}s)
                        </span>
                      ) : q.timeToAnswerSeconds <= 120 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> Good Pacing & Thoughtfulness ({q.timeToAnswerSeconds}s)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[11px] font-semibold">
                          <Timer className="w-3 h-3 text-indigo-500 shrink-0" /> Extended Response ({q.timeToAnswerSeconds}s)
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {q.score !== undefined && (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{q.score}/10</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRetrySpecificQuestion(i)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
                    title="Retry this specific question"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry Q{i + 1}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 no-print animate-fade-in" style={{ animationDelay: "0.6s" }}>
        <button className="btn-secondary cursor-pointer" onClick={handleTryAgain}>
          <RotateCcw className="w-4 h-4" />
          Start New Practice
        </button>
        <button className="btn-primary cursor-pointer" onClick={handleDownloadPDF}>
          <Download className="w-4 h-4" />
          Download PDF Report
        </button>
      </div>
    </main>
  );
}