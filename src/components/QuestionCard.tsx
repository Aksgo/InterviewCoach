import { MessageSquare, Globe, Sparkles, ExternalLink, Info } from "lucide-react";

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  sourceType?: "brightdata_web_scraped" | "ai_generated_resume_tailored";
  sourceName?: string;
  sourceUrl?: string;
  originExplanation?: string;
}

export default function QuestionCard({
  questionNumber,
  totalQuestions,
  question,
  sourceType = "brightdata_web_scraped",
  sourceName = "Bright Data SERP",
  sourceUrl,
  originExplanation,
}: QuestionCardProps) {
  const isWebScraped = sourceType === "brightdata_web_scraped" || sourceName.toLowerCase().includes("glassdoor") || sourceName.toLowerCase().includes("leetcode") || sourceName.toLowerCase().includes("indeed") || sourceName.toLowerCase().includes("bright");

  return (
    <div className="card animate-fade-in space-y-3" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {questionNumber}
          </span>
          <span className="text-xs text-foreground/40 font-medium uppercase tracking-wider">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>

        {isWebScraped ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold">
            <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Fetched via Bright Data ({sourceName})</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>AI Formed on Resume Match</span>
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-1" />
        <div className="space-y-2 flex-1">
          <p className="text-lg font-semibold leading-relaxed text-foreground">
            {question}
          </p>

          {/* Origin explanation & Source link */}
          {(originExplanation || sourceUrl) && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-foreground/80 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                {originExplanation && (
                  <p className="leading-relaxed">
                    <strong className="text-foreground">{isWebScraped ? "Web Origin:" : "AI Origin:"}</strong> {originExplanation}
                  </p>
                )}
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-[11px]"
                  >
                    View Original Report Source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}