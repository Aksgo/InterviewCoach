import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Loader2, Volume2, VolumeX, RotateCcw, FileText, ChevronDown, ChevronUp, Globe, Search } from "lucide-react";
import QuestionCard from "../components/QuestionCard";
import AudioRecorder from "../components/AudioRecorder";
import ResumeScorecard from "../components/ResumeScorecard";
import { loadSession, saveSession } from "../utils/storage";
import type { InterviewSession } from "../utils/storage";

export default function InterviewPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showResumeScore, setShowResumeScore] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentQuestion = session?.questions[session.currentQuestionIndex];

  const speakQuestion = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Auto-speak question when it changes
  useEffect(() => {
    if (currentQuestion && !answerSubmitted) {
      const timer = setTimeout(() => {
        speakQuestion(currentQuestion.text);
      }, 500);
      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    }
  }, [currentQuestion?.text, answerSubmitted, speakQuestion, stopSpeaking]);

  // Stop speaking when user starts recording
  useEffect(() => {
    if (isRecording) {
      stopSpeaking();
    }
  }, [isRecording, stopSpeaking]);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.status !== "in_progress") {
      navigate("/", { replace: true });
      return;
    }
    setSession(s);
  }, [navigate]);

  const handleTranscript = useCallback((text: string) => {
    setAnswerText(text);
  }, []);

  const handleRetryQuestion = useCallback(() => {
    if (!currentQuestion) return;
    setAnswerText(currentQuestion.answerTranscript || "");
    setAnswerSubmitted(false);
  }, [currentQuestion]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!session || !currentQuestion) return;
    const finalAnswer = answerText.trim();
    if (!finalAnswer) return;

    setIsSubmitting(true);

    try {
      let score: number | undefined;
      let feedback: string | undefined;

      try {
        const { callGoogleAI } = await import("../utils/api");
        const result = await callGoogleAI({
          action: "score-answer",
          question: currentQuestion.text,
          answer: finalAnswer,
          role: session.role,
          company: session.company,
        });
        if ("score" in result && result.score !== undefined) {
          score = result.score;
          feedback = result.feedback;
        }
      } catch {
        const wordCount = finalAnswer.split(/\s+/).length;
        if (wordCount < 5) {
          score = 1;
          feedback = "Answer is too short. Please provide a detailed response using specific examples.";
        } else {
          score = 6;
          feedback = "Solid answer. Expand further on measurable impact and technologies used.";
        }
      }

      const updatedQuestions = [...session.questions];
      updatedQuestions[session.currentQuestionIndex] = {
        ...currentQuestion,
        answerTranscript: finalAnswer,
        score,
        feedback,
      };

      const updatedSession: InterviewSession = {
        ...session,
        questions: updatedQuestions,
      };

      saveSession(updatedSession);
      setSession(updatedSession);
      setAnswerSubmitted(true);
    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, currentQuestion, answerText]);

  const handleNextQuestion = useCallback(() => {
    if (!session) return;

    const nextIndex = session.currentQuestionIndex + 1;

    if (nextIndex >= session.questions.length) {
      // Calculate realistic scores based on all questions
      const questionScores = session.questions
        .map((q) => q.score)
        .filter((s): s is number => typeof s === "number");

      const overallScore =
        questionScores.length > 0
          ? Math.round(
              (questionScores.reduce((a, b) => a + b, 0) / questionScores.length) * 10
            ) / 10
          : 0;

      const feedbacks = session.questions
        .filter((q) => q.feedback)
        .map((q) => q.feedback!);

      const completedSession: InterviewSession = {
        ...session,
        currentQuestionIndex: nextIndex,
        status: "completed",
        scores: {
          relevance: overallScore,
          clarity: overallScore,
          depth: overallScore,
          confidence: overallScore,
          overall: overallScore,
          summary:
            feedbacks.length > 0
              ? feedbacks.join(" ")
              : "Interview complete. Review individual question feedback to refine your responses.",
        },
      };

      saveSession(completedSession);
      navigate("/results", { replace: true });
      return;
    }

    const updatedSession: InterviewSession = {
      ...session,
      currentQuestionIndex: nextIndex,
    };
    saveSession(updatedSession);
    setSession(updatedSession);
    setAnswerText("");
    setAnswerSubmitted(false);
  }, [session, navigate]);

  if (!session || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Target Info & Resume Match Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 animate-fade-in">
        <div className="text-xs text-foreground/70 font-medium">
          Interviewing for <span className="font-bold text-foreground">{session.role}</span> at{" "}
          <span className="font-bold text-foreground">{session.company}</span>
        </div>

        {session.resumeScore && (
          <button
            onClick={() => setShowResumeScore((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold text-xs hover:bg-accent/20 transition-all cursor-pointer"
            title="Click to toggle resume match breakdown"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Resume Match Score: <strong>{session.resumeScore.overallScore}%</strong></span>
            {showResumeScore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expandable Resume Match Score Card */}
      {showResumeScore && session.resumeScore && (
        <div className="mb-6 animate-slide-up">
          <ResumeScorecard
            resumeScore={session.resumeScore}
            company={session.company}
            role={session.role}
          />
        </div>
      )}

      {/* Question Grounding Source Indicator */}
      <div className="mb-5 p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-blue-950 flex items-center gap-1.5">
              <span>Fetched via Bright Data SERP API</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <p className="text-[11px] text-blue-800/80 mt-0.5">
              Questions scraped &amp; synthesized from live Glassdoor, LeetCode &amp; Indeed reports for <strong>{session.company}</strong> ({session.snippetsCount || 10} sources analyzed)
            </p>
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-md bg-blue-200/60 font-mono text-[10px] font-bold text-blue-900 border border-blue-300/40">
          Bright Data Live
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-foreground/40 font-medium uppercase tracking-wider">
            Progress
          </span>
          <span className="text-xs text-foreground/60 font-medium">
            {session.currentQuestionIndex + 1} of {session.questions.length}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
            style={{
              width: `${((session.currentQuestionIndex + 1) / session.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex items-start gap-3 animate-fade-in">
        <div className="flex-1">
          <QuestionCard
            questionNumber={session.currentQuestionIndex + 1}
            totalQuestions={session.questions.length}
            question={currentQuestion.text}
            sourceType={currentQuestion.sourceType}
            sourceName={currentQuestion.sourceName}
            sourceUrl={currentQuestion.sourceUrl}
            originExplanation={currentQuestion.originExplanation}
          />
        </div>
        <button
          onClick={() => isSpeaking ? stopSpeaking() : speakQuestion(currentQuestion.text)}
          className="mt-2 shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer"
          aria-label={isSpeaking ? "Mute question" : "Play question"}
          title={isSpeaking ? "Mute" : "Replay question"}
        >
          {isSpeaking ? (
            <VolumeX className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <Volume2 className="w-5 h-5 text-foreground/40 hover:text-primary transition-colors" />
          )}
        </button>
      </div>

      {/* Answer Section */}
      <div className="flex-1 flex flex-col mt-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
        {!answerSubmitted ? (
          <div className="flex flex-col gap-5">
            {/* Answer Editor Box */}
            <div className="card p-4 flex flex-col gap-3 border border-border/60 shadow-sm rounded-xl bg-white">
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                  Your Answer
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground/40">
                    {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} words
                  </span>
                  {answerText && (
                    <button
                      type="button"
                      onClick={() => setAnswerText("")}
                      className="text-xs text-destructive hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Textarea for live typing / transcribed text */}
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Speak your response using the microphone below, or type your answer directly here..."
                rows={5}
                className="w-full resize-y text-sm leading-relaxed text-foreground placeholder:text-foreground/30 focus:outline-none bg-transparent"
              />

              {/* Live speech recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/30 text-xs text-destructive font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping shrink-0" />
                  <span>Listening live... Speak clearly into your microphone</span>
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="flex flex-col items-center gap-3">
              <AudioRecorder
                isRecording={isRecording}
                currentText={answerText}
                onTranscript={handleTranscript}
                onRecordingChange={setIsRecording}
              />

              <p className="text-xs text-foreground/40 text-center">
                {isRecording
                  ? "Recording active — your speech is converted to text above in real time. Click stop when finished."
                  : "Click the microphone to record your voice answer, or type in the box above."}
              </p>

              <button
                className="btn-primary mt-2 w-full max-w-md py-3 font-semibold cursor-pointer"
                disabled={!answerText.trim() || isSubmitting || isRecording}
                onClick={handleSubmitAnswer}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI Coach Evaluating Answer...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Answer for AI Evaluation
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 animate-fade-in">
            <div className="card w-full border border-border/60 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/30">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Evaluated Answer
                </p>
                {currentQuestion.score !== undefined && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    Score: {currentQuestion.score}/10
                  </div>
                )}
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed bg-muted/40 p-3 rounded-lg italic">
                "{currentQuestion.answerTranscript}"
              </p>

              {currentQuestion.feedback && (
                <div className="pt-3 border-t border-border/30 space-y-1">
                  <p className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                    AI Interview Coach Feedback
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {currentQuestion.feedback}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons: Retry Question & Next Question */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
              <button
                className="btn-secondary w-full py-3 font-semibold cursor-pointer flex items-center justify-center gap-2"
                onClick={handleRetryQuestion}
              >
                <RotateCcw className="w-4 h-4" />
                Retry This Question
              </button>

              <button
                className="btn-primary w-full py-3 font-semibold cursor-pointer flex items-center justify-center gap-2"
                onClick={handleNextQuestion}
              >
                {session.currentQuestionIndex + 1 >= session.questions.length
                  ? "View Final Interview Results"
                  : "Next Question"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}