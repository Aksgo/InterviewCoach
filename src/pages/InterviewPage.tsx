import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Loader2, Volume2, VolumeX, FileText, ChevronDown, ChevronUp, Globe, Mic, Radio, Video, Sparkles, MessageSquare, ShieldCheck, UserCheck, PhoneOff, Code2, Terminal, HelpCircle, SkipForward } from "lucide-react";
import QuestionCard from "../components/QuestionCard";
import AudioRecorder from "../components/AudioRecorder";
import ResumeScorecard from "../components/ResumeScorecard";
import StreamingText from "../components/StreamingText";
import CodeEditor from "../components/CodeEditor";
import { loadSession, saveSession } from "../utils/storage";
import type { InterviewSession } from "../utils/storage";
import { generateSpeechmaticsTTS } from "../utils/api";
import { startThinkingSound, stopThinkingSound, playCallStartSound, playCallEndSound } from "../utils/audioEffects";

type CallStatus = "interviewer_speaking" | "listening" | "evaluating" | "interviewer_replying" | "transitioning";

export default function InterviewPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<InterviewSession | null>(null);
  
  // Call Engine States
  const [callStatus, setCallStatus] = useState<CallStatus>("interviewer_speaking");
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [autoStartMic, setAutoStartMic] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [writtenCode, setWrittenCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isTextRevealed, setIsTextRevealed] = useState(false);
  const [showResumeScore, setShowResumeScore] = useState(false);
  const [showCallWarning, setShowCallWarning] = useState(true);
  const [speechBlocked, setSpeechBlocked] = useState(false);
  const [lastInterviewerReply, setLastInterviewerReply] = useState<string | null>(null);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [followUpCount, setFollowUpCount] = useState<number>(0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const speakTimerRef = useRef<any>(null);
  const resumeIntervalRef = useRef<any>(null);
  const lastSpokenIndexRef = useRef<number | null>(null);
  const onSpeechEndCallbackRef = useRef<(() => void) | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQuestion = session?.questions[session.currentQuestionIndex];

  // Call timer increment
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Stop current audio playback
  const stopSpeaking = useCallback(() => {
    stopThinkingSound();
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch (err) {
        console.warn("Audio element pause error:", err);
      }
      audioElementRef.current = null;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn("Speech cancel error:", err);
      }
    }
    setIsSpeaking(false);
    setIsTtsLoading(false);
  }, []);

  // Browser speech synthesis fallback
  const fallbackToBrowserSpeech = useCallback((text: string, onEnded?: () => void) => {
    if (!("speechSynthesis" in window)) {
      stopThinkingSound();
      setSpeechBlocked(true);
      if (onEnded) onEnded();
      return;
    }

    stopSpeaking();

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn("Speech prep warning:", e);
    }

    setIsSpeaking(true);
    setSpeechBlocked(false);

    speakTimerRef.current = setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 0.94;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const maleVoice =
            voices.find(
              (v) =>
                v.lang.startsWith("en") &&
                (v.name.includes("Guy") ||
                  v.name.includes("Christopher") ||
                  v.name.includes("Ryan") ||
                  v.name.includes("Google US English Male") ||
                  v.name.includes("Daniel") ||
                  v.name.includes("David") ||
                  v.name.includes("Alex") ||
                  v.name.toLowerCase().includes("male"))
            ) || voices.find((v) => v.lang.startsWith("en"));

          if (maleVoice) {
            utterance.voice = maleVoice;
          }
        }

        utterance.onstart = () => {
          stopThinkingSound();
          setIsSpeaking(true);
          setIsTextRevealed(true);
          setSpeechBlocked(false);

          if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = setInterval(() => {
            if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
              window.speechSynthesis.resume();
            } else {
              clearInterval(resumeIntervalRef.current);
            }
          }, 3500);
        };

        utterance.onend = () => {
          stopThinkingSound();
          if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
          setIsSpeaking(false);
          setIsTextRevealed(true);
          if (onEnded) onEnded();
        };

        utterance.onerror = (e) => {
          stopThinkingSound();
          console.warn("Speech utterance error:", e);
          if (resumeIntervalRef.current) clearInterval(resumeIntervalRef.current);
          setIsSpeaking(false);
          setIsTextRevealed(true);
          if (e.error === "not-allowed" || e.error === "canceled") {
            setSpeechBlocked(true);
          }
          if (onEnded) onEnded();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        stopThinkingSound();
        console.error("Speech synthesis invocation failed:", err);
        setIsSpeaking(false);
        setIsTextRevealed(true);
        setSpeechBlocked(true);
        if (onEnded) onEnded();
      }
    }, 50);
  }, [stopSpeaking]);

  // Main Speechmatics TTS Invocation
  const speakText = useCallback(
    async (text: string, onEnded?: () => void) => {
      stopSpeaking();
      startThinkingSound();
      onSpeechEndCallbackRef.current = onEnded || null;

      setIsTtsLoading(true);
      setIsTextRevealed(false);
      try {
        const res = await generateSpeechmaticsTTS(text, "jack");
        setIsTtsLoading(false);

        if (res && res.audio) {
          const mimeType = res.mimeType || "audio/wav";
          const audioUrl = `data:${mimeType};base64,${res.audio}`;
          const audio = new Audio(audioUrl);
          audioElementRef.current = audio;

          audio.onplay = () => {
            stopThinkingSound();
            setIsSpeaking(true);
            setIsTextRevealed(true);
            setSpeechBlocked(false);
          };

          audio.onended = () => {
            stopThinkingSound();
            setIsSpeaking(false);
            setIsTextRevealed(true);
            audioElementRef.current = null;
            if (onSpeechEndCallbackRef.current) {
              const cb = onSpeechEndCallbackRef.current;
              onSpeechEndCallbackRef.current = null;
              cb();
            }
          };

          audio.onerror = (err) => {
            console.warn("Speechmatics Audio playback warning, falling back to browser speech:", err);
            audioElementRef.current = null;
            setIsTextRevealed(true);
            fallbackToBrowserSpeech(text, onEnded);
          };

          await audio.play();
        } else {
          console.warn("No audio returned from Speechmatics TTS, falling back to browser speech");
          setIsTextRevealed(true);
          fallbackToBrowserSpeech(text, onEnded);
        }
      } catch (err) {
        console.warn("Speechmatics TTS request failed, falling back to browser speech:", err);
        setIsTtsLoading(false);
        setIsTextRevealed(true);
        fallbackToBrowserSpeech(text, onEnded);
      }
    },
    [stopSpeaking, fallbackToBrowserSpeech]
  );

  // Load session on mount & play MS Teams Call Join sound
  useEffect(() => {
    const s = loadSession();
    if (!s || s.status !== "in_progress") {
      navigate("/", { replace: true });
      return;
    }
    setSession(s);
    playCallStartSound();
  }, [navigate]);

  // Auto-speak question when current question index changes
  useEffect(() => {
    if (
      currentQuestion &&
      lastSpokenIndexRef.current !== session?.currentQuestionIndex
    ) {
      lastSpokenIndexRef.current = session?.currentQuestionIndex ?? null;
      questionStartTimeRef.current = Date.now();
      setCallStatus("interviewer_speaking");
      setAnswerText("");
      setWrittenCode("");
      setLastInterviewerReply(null);
      setAutoStartMic(false);
      setIsTextRevealed(false);
      setIsFollowUp(false);
      setFollowUpCount(0);

      const timer = setTimeout(() => {
        speakText(currentQuestion.text, () => {
          // Question finished speaking -> automatically set call status to listening and trigger mic!
          setCallStatus("listening");
          setAutoStartMic(true);
        });
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentQuestion, session?.currentQuestionIndex, speakText]);

  // Stop speaking if candidate manually toggles mic or starts recording
  useEffect(() => {
    if (isRecording) {
      stopSpeaking();
      setCallStatus("listening");
    }
  }, [isRecording, stopSpeaking]);

  // Stop speaking and play MS Teams call end chime when ending call
  const handleEndCall = useCallback(async () => {
    stopSpeaking();
    stopThinkingSound();
    setIsRecording(false);
    setAutoStartMic(false);
    await playCallEndSound();

    if (session) {
      setCallStatus("transitioning");
      setIsSubmitting(true);
      try {
        const activeSession = session;
        const rels = activeSession.questions.map((q) => q.relevance).filter((n): n is number => typeof n === "number");
        const clas = activeSession.questions.map((q) => q.clarity).filter((n): n is number => typeof n === "number");
        const deps = activeSession.questions.map((q) => q.depth).filter((n): n is number => typeof n === "number");
        const confs = activeSession.questions.map((q) => q.confidence).filter((n): n is number => typeof n === "number");
        const questionScores = activeSession.questions.map((q) => q.score).filter((s): s is number => typeof s === "number");

        const avg = (arr: number[], fallback: number) =>
          arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : fallback;

        const overallScore = avg(questionScores, 0);
        const avgRel = avg(rels, overallScore);
        const avgCla = avg(clas, overallScore);
        const avgDep = avg(deps, overallScore);
        const avgConf = avg(confs, overallScore);

        let netSummary = "Interview ended early by candidate. Review individual question feedback and dimension breakdown for the completed questions.";
        let mistakes: string[] = [];
        let improvements: string[] = [];

        const answeredQuestions = activeSession.questions.filter(q => q.answerTranscript || q.writtenCode);
        if (answeredQuestions.length > 0) {
          try {
            const { callGoogleAI } = await import("../utils/api");
            const sumRes = await callGoogleAI({
              action: "summarize-interview",
              role: activeSession.role,
              company: activeSession.company,
              sessionQuestions: activeSession.questions,
              interviewTrack: activeSession.interviewTrack,
            });

            if ("summary" in sumRes && sumRes.summary) {
              netSummary = sumRes.summary;
              if (Array.isArray(sumRes.mistakes)) mistakes = sumRes.mistakes;
              if (Array.isArray(sumRes.improvements)) improvements = sumRes.improvements;
            }
          } catch (err) {
            console.warn("Failed to generate summary with AI:", err);
          }
        } else {
          mistakes = ["No questions answered: The interview was ended before any responses could be recorded."];
          improvements = ["Try answering at least one question during your next practice session to receive active spoken delivery evaluations."];
        }

        const completedSession: InterviewSession = {
          ...activeSession,
          status: "completed",
          scores: {
            relevance: avgRel,
            clarity: avgCla,
            depth: avgDep,
            confidence: avgConf,
            overall: overallScore,
            summary: netSummary,
            mistakes,
            improvements,
          },
        };

        saveSession(completedSession);
        navigate("/results", { replace: true });
      } catch (err) {
        console.error("Error finalizing early end call:", err);
        navigate("/");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      navigate("/");
    }
  }, [session, stopSpeaking, navigate]);

  // Ensure all AI speech stops if component unmounts
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const handleTranscript = useCallback((text: string) => {
    setAnswerText(text);
  }, []);

  // Submit Answer -> AI generates conversational reply -> speaks reply -> moves to next question
  const handleSubmitAnswer = useCallback(async () => {
    if (!session || !currentQuestion) return;
    const finalAnswer = answerText.trim();
    const finalWrittenCode = writtenCode.trim();
    if (!finalAnswer && !finalWrittenCode) return;

    // Start subtle call processing chime sound immediately
    startThinkingSound();

    const isFinalQuestion = session.currentQuestionIndex === session.questions.length - 1;

    // Build cumulative answer transcript if this turn is answering a follow-up probe
    const currentTurnNum = followUpCount + (isFollowUp ? 1 : 0);
    const fullAnswerTranscript = isFollowUp && currentQuestion.answerTranscript
      ? `${currentQuestion.answerTranscript}\n\n[Candidate Follow-Up Response #${currentTurnNum}]: ${finalAnswer}`
      : finalAnswer;

    const fullWrittenCode = isFollowUp && currentQuestion.writtenCode
      ? `${currentQuestion.writtenCode}\n\n// Follow-Up #${currentTurnNum} Addition:\n${finalWrittenCode}`
      : finalWrittenCode;

    // Clear answer input fields immediately so next response starts fresh
    setAnswerText("");
    setWrittenCode("");
    setIsSubmitting(true);
    setCallStatus("evaluating");
    setIsTextRevealed(false);

    try {
      let score: number | undefined;
      let feedback: string | undefined;
      let relevance: number | undefined;
      let clarity: number | undefined;
      let depth: number | undefined;
      let confidence: number | undefined;
      let needsElaboration = false;
      let followUpQuestion = "";
      let interviewerReply = isFinalQuestion
        ? "Thank you for sharing your responses today. That concludes our interview session!"
        : "Okay, sounds good! Let's move on to our next question.";

      try {
        const { callGoogleAI } = await import("../utils/api");
        const result = await callGoogleAI({
          action: "score-answer",
          question: currentQuestion.text,
          answer: fullAnswerTranscript,
          writtenCode: fullWrittenCode,
          isFollowUp,
          followUpCount,
          isFinalQuestion,
          role: session.role,
          company: session.company,
          experienceLevel: session.experienceLevel,
          interviewTrack: session.interviewTrack,
        });

        if ("score" in result && result.score !== undefined) {
          score = result.score;
          feedback = result.feedback;
          relevance = result.relevance;
          clarity = result.clarity;
          depth = result.depth;
          confidence = result.confidence;
          needsElaboration = !!result.needsElaboration;
          followUpQuestion = result.followUpQuestion || "";
          if (result.interviewerReply) {
            interviewerReply = result.interviewerReply;
          }
        }
      } catch {
        const wordCount = (fullAnswerTranscript + " " + fullWrittenCode).split(/\s+/).length;
        const currentTurnNum = followUpCount + (isFollowUp ? 1 : 0);
        const lowerAns = fullAnswerTranscript.toLowerCase();
        const isQuestionOrBrief = /(company|brief|tell me about|what is|could you repeat|repeat|clarify|explain|can you|what do you|who is|about the role)/i.test(lowerAns);

        if (currentTurnNum < 3 && (isQuestionOrBrief || wordCount < 15)) {
          needsElaboration = true;
          if (isQuestionOrBrief && lowerAns.includes("company")) {
            followUpQuestion = `Glad you asked! ${session.company || "Our company"} is dedicated to building innovative products and scaling high-impact engineering solutions. Now, could you please introduce yourself and walk me through your background?`;
          } else if (isQuestionOrBrief && (lowerAns.includes("repeat") || lowerAns.includes("clarify"))) {
            followUpQuestion = `Sure thing! The main question is: "${currentQuestion.text}". Whenever you're ready, please share your response.`;
          } else if (currentTurnNum === 2) {
            followUpQuestion = "Got it. Could you speak to the specific technical trade-offs, metrics, or edge cases involved in that approach?";
          } else if (currentTurnNum === 1) {
            followUpQuestion = "Understood. Could you elaborate a bit more on your technical approach, specific tools, or key metrics?";
          } else {
            followUpQuestion = "Got it. Could you elaborate a bit more on your approach or specific tools and metrics you used?";
          }
          interviewerReply = followUpQuestion;
          score = 5; relevance = 5; clarity = 6; depth = 4; confidence = 5;
          feedback = "Follow-up probe issued. Try providing more specific technical details, STAR examples, or metrics.";
        } else {
          score = 7; relevance = 7; clarity = 7; depth = 7; confidence = 7;
          feedback = "Solid response! Good coverage of your technical approach.";
          interviewerReply = isFinalQuestion
            ? "Thank you for walking me through all your answers today! That concludes our interview session."
            : "Okay, sounds good! Let's move on to the next question.";
        }
      }

      // Calculate time to answer in seconds
      const elapsedMs = Date.now() - (questionStartTimeRef.current || Date.now());
      const timeToAnswerSeconds = Math.max(1, Math.round(elapsedMs / 1000));

      // Store updated evaluation in session array
      const updatedQuestions = [...session.questions];
      updatedQuestions[session.currentQuestionIndex] = {
        ...currentQuestion,
        answerTranscript: fullAnswerTranscript,
        writtenCode: fullWrittenCode,
        followUpQuestion: needsElaboration ? followUpQuestion : currentQuestion.followUpQuestion,
        isProbed: needsElaboration || isFollowUp,
        score,
        relevance,
        clarity,
        depth,
        confidence,
        feedback,
        timeToAnswerSeconds,
      };

      const updatedSession: InterviewSession = {
        ...session,
        questions: updatedQuestions,
      };

      saveSession(updatedSession);
      setSession(updatedSession);
      setLastInterviewerReply(interviewerReply);
      setCallStatus("interviewer_replying");

      // AI speaks conversational reply aloud using Speechmatics TTS!
      speakText(interviewerReply, () => {
        if (needsElaboration) {
          // Continue follow-up turn cycle on current question until complete or skipped!
          setIsFollowUp(true);
          setFollowUpCount((prev) => prev + 1);
          setCallStatus("listening");
          setAutoStartMic(true);
        } else {
          // Turn complete -> reset follow-up count & move to next question or end interview
          setIsFollowUp(false);
          setFollowUpCount(0);
          handleMoveToNextQuestion(updatedSession);
        }
      });

    } catch (err) {
      console.error("Failed to submit answer:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, currentQuestion, answerText, writtenCode, isFollowUp, followUpCount, speakText]);

  // Handle explicit Skip Question / Skip Follow-Up action
  const handleSkipQuestion = useCallback(() => {
    if (!session || !currentQuestion) return;
    stopSpeaking();
    setIsRecording(false);
    setAutoStartMic(false);
    setAnswerText("");
    setWrittenCode("");

    const isFinalQuestion = session.currentQuestionIndex === session.questions.length - 1;
    const reply = isFinalQuestion
      ? "Understood, let's skip this. That concludes our interview session today! Thank you for your time."
      : "Understood, no problem at all. Let's move on to the next question.";

    setLastInterviewerReply(reply);
    setCallStatus("interviewer_replying");

    speakText(reply, () => {
      setIsFollowUp(false);
      setFollowUpCount(0);
      handleMoveToNextQuestion(session);
    });
  }, [session, currentQuestion, stopSpeaking, speakText]);

  // Transition to next question or end interview
  const handleMoveToNextQuestion = async (activeSession: InterviewSession) => {
    const nextIndex = activeSession.currentQuestionIndex + 1;

    if (nextIndex >= activeSession.questions.length) {
      // Completed all questions -> summarize & land on Results page
      setCallStatus("transitioning");
      setIsSubmitting(true);

      try {
        const rels = activeSession.questions.map((q) => q.relevance).filter((n): n is number => typeof n === "number");
        const clas = activeSession.questions.map((q) => q.clarity).filter((n): n is number => typeof n === "number");
        const deps = activeSession.questions.map((q) => q.depth).filter((n): n is number => typeof n === "number");
        const confs = activeSession.questions.map((q) => q.confidence).filter((n): n is number => typeof n === "number");
        const questionScores = activeSession.questions.map((q) => q.score).filter((s): s is number => typeof s === "number");

        const avg = (arr: number[], fallback: number) =>
          arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : fallback;

        const overallScore = avg(questionScores, 0);
        const avgRel = avg(rels, overallScore);
        const avgCla = avg(clas, overallScore);
        const avgDep = avg(deps, overallScore);
        const avgConf = avg(confs, overallScore);

        let netSummary = "Interview completed. Review individual question feedback and dimension breakdown to refine your performance.";
        let mistakes: string[] = [];
        let improvements: string[] = [];

        try {
          const { callGoogleAI } = await import("../utils/api");
          const sumRes = await callGoogleAI({
            action: "summarize-interview",
            role: activeSession.role,
            company: activeSession.company,
            sessionQuestions: activeSession.questions,
            interviewTrack: activeSession.interviewTrack,
          });

          if ("summary" in sumRes && sumRes.summary) {
            netSummary = sumRes.summary;
            if (Array.isArray(sumRes.mistakes)) mistakes = sumRes.mistakes;
            if (Array.isArray(sumRes.improvements)) improvements = sumRes.improvements;
          }
        } catch (err) {
          console.warn("Failed to generate summary with AI:", err);
        }

        const completedSession: InterviewSession = {
          ...activeSession,
          currentQuestionIndex: nextIndex,
          status: "completed",
          scores: {
            relevance: avgRel,
            clarity: avgCla,
            depth: avgDep,
            confidence: avgConf,
            overall: overallScore,
            summary: netSummary,
            mistakes,
            improvements,
          },
        };

        saveSession(completedSession);
        
        // Final wrap-up audio before navigating to results
        speakText("That completes all our questions for today! Finalizing your interview scorecard now.", async () => {
          await playCallEndSound();
          navigate("/results", { replace: true });
        });
        return;
      } catch (err) {
        console.error("Error finalizing interview:", err);
        navigate("/results", { replace: true });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Move to next question index
    const updatedSession: InterviewSession = {
      ...activeSession,
      currentQuestionIndex: nextIndex,
    };
    saveSession(updatedSession);
    setSession(updatedSession);
  };

  if (!session || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-foreground/70">Connecting to AI Call Room...</p>
      </div>
    );
  }

  const isTextAvailable = answerText.trim().length > 0 || writtenCode.trim().length > 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-950 text-white flex flex-col">
      
      {/* Call Header / Status Bar */}
      <header className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <span>LIVE INTERVIEW CALL</span>
              <span className="text-zinc-500">•</span>
              <span className="text-emerald-400 font-mono text-[11px]">{formatTime(callDuration)}</span>
            </p>
            <p className="text-[11px] text-zinc-400">
              {session.role} <span className="text-zinc-500">•</span> <strong className="text-primary">{session.experienceLevel || "Fresher"}</strong> at <strong className="text-zinc-200">{session.company}</strong>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {session.resumeScore && (
            <button
              onClick={() => setShowResumeScore((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Resume Match: <strong>{session.resumeScore.overallScore}%</strong></span>
              {showResumeScore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={handleEndCall}
            className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
            title="End Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Expandable Resume Match Score Card */}
      {showResumeScore && session.resumeScore && (
        <div className="p-4 bg-zinc-900 border-b border-zinc-800">
          <ResumeScorecard
            resumeScore={session.resumeScore}
            company={session.company}
            role={session.role}
          />
        </div>
      )}

      {/* Call Quality Warning Note */}
      {showCallWarning && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-zinc-900/95 border border-amber-500/30 rounded-xl p-3.5 text-xs text-zinc-300 flex items-start sm:items-center justify-between gap-3 shadow-lg animate-fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="font-extrabold text-white">Live Call Audio Optimization</p>
                <p className="text-zinc-400 mt-0.5">
                  To ensure best natural voice recording, please sit in a <span className="text-amber-400 font-semibold">silent background</span> with a <span className="text-amber-400 font-semibold">stable, good internet connection</span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCallWarning(false)}
              className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0"
            >
              Dismiss Notice
            </button>
          </div>
        </div>
      )}

      {/* Main Call Viewport (Side-by-Side on Large Screens: Left = Interviewer/Caller, Right = Candidate/Me) */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* LEFT COLUMN: AI Interviewer & Question Subtitle */}
        <div className="flex flex-col gap-6">
          {/* Stage & Agent Banner */}
          <div className="px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
              <span className="font-bold text-white">{currentQuestion.stageName || "Stage 1: Introduction & Background"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 font-medium">Source: {currentQuestion.sourceName || "Glassdoor / LeetCode"}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                Q{session.currentQuestionIndex + 1} of {session.questions.length}
              </span>
            </div>
          </div>

          {/* Primary Stage: AI Interviewer Call Window */}
          <div className="relative rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden min-h-[300px]">
            
            {/* Subtle background glow when speaking or listening */}
            <div
              className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
                isSpeaking
                  ? "bg-primary/10 opacity-100"
                  : isRecording
                  ? "bg-rose-500/10 opacity-100"
                  : "opacity-0"
              }`}
            />

            {/* AI Avatar Card */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="relative">
                {/* Pulse rings when AI speaking */}
                {isSpeaking && (
                  <>
                    <div className="absolute -inset-3 rounded-full bg-primary/30 animate-ping opacity-75" />
                    <div className="absolute -inset-6 rounded-full bg-accent/20 animate-pulse" />
                  </>
                )}

                {/* Pulse rings when Candidate recording */}
                {isRecording && (
                  <div className="absolute -inset-3 rounded-full bg-rose-500/30 animate-ping opacity-75" />
                )}

                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-primary via-accent to-indigo-500 p-1 shadow-xl flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-black text-white">
                    AI
                  </div>
                </div>

                {/* Status icon badge */}
                <div className="absolute bottom-0 right-0 p-2 rounded-full bg-zinc-900 border border-zinc-700 shadow-md">
                  {isSpeaking ? (
                    <Volume2 className="w-4 h-4 text-primary animate-bounce" />
                  ) : isRecording ? (
                    <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                  ) : isSubmitting ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>

              {/* AI Name & Title */}
              <div>
                <h2 className="text-lg font-bold text-white">Senior AI Technical Interviewer</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{currentQuestion.stageName || "Stage 1: Introduction & Background"}</p>
              </div>

              {/* Live Call Status Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-semibold shadow-inner">
                {callStatus === "interviewer_speaking" && (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-primary">Interviewer Speaking Question...</span>
                  </>
                )}
                {callStatus === "listening" && (
                  <>
                    <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span className="text-rose-400">Listening to Candidate... Speak Now</span>
                  </>
                )}
                {callStatus === "evaluating" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span className="text-amber-400">Evaluating Answer &amp; Formulating Response...</span>
                  </>
                )}
                {callStatus === "interviewer_replying" && (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                    <span className="text-emerald-400">Interviewer Replying to Answer...</span>
                  </>
                )}
                {callStatus === "transitioning" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span className="text-indigo-400">Preparing Next Question...</span>
                  </>
                )}
              </div>
            </div>

            {/* Interviewer Spoken Subtitle Banner / Last Reply */}
            <div className="mt-6 w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 text-left shadow-lg transition-all">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold mb-2">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  {lastInterviewerReply ? "Interviewer Response:" : "Question Subtitle:"}
                </span>
                {isTextRevealed && (
                  <button
                    onClick={() => {
                      setSpeechBlocked(false);
                      setIsTextRevealed(true);
                      speakText(lastInterviewerReply || currentQuestion.text);
                    }}
                    className="text-primary hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <Volume2 className="w-3 h-3" /> Replay Voice
                  </button>
                )}
              </div>

              {!isTextRevealed || callStatus === "evaluating" || callStatus === "transitioning" || isTtsLoading ? (
                <div className="flex items-center gap-3 py-3 px-3 bg-zinc-950/80 rounded-lg border border-zinc-800/80">
                  {/* Animated Voice Waveform equalizer */}
                  <div className="flex items-center gap-1 h-6 shrink-0 px-1">
                    <div className="w-1 bg-primary rounded-full animate-[bounce_1s_infinite_100ms] h-4" />
                    <div className="w-1 bg-primary rounded-full animate-[bounce_1s_infinite_300ms] h-6" />
                    <div className="w-1 bg-primary rounded-full animate-[bounce_1s_infinite_200ms] h-3" />
                    <div className="w-1 bg-primary rounded-full animate-[bounce_1s_infinite_400ms] h-5" />
                    <div className="w-1 bg-primary rounded-full animate-[bounce_1s_infinite_250ms] h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-primary animate-pulse">
                      {callStatus === "evaluating"
                        ? "Interviewer is evaluating your response..."
                        : callStatus === "interviewer_replying" || isTtsLoading
                        ? "Interviewer is synthesizing verbal response..."
                        : "Interviewer is preparing question..."}
                    </p>
                    <p className="text-[11px] text-zinc-400">Audio will play momentarily. Text reveals as spoken.</p>
                  </div>
                </div>
              ) : (
                <StreamingText
                  text={lastInterviewerReply || currentQuestion.text}
                  isSpeaking={isSpeaking}
                  isRevealed={isTextRevealed}
                  audioElement={audioElementRef.current}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Candidate Self-View & Live Speech-to-Text Container ("Me") */}
        <div className="flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-5 space-y-4 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Candidate (You) • Live Transcript
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} words
              </span>
            </div>

            {isFollowUp && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-3 font-medium animate-fade-in">
                <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <strong className="text-amber-200">Interviewer Follow-Up Probe #{followUpCount || 1}:</strong>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">The interviewer requested further elaboration. Speak or type your answer, or click Skip to move to the next question.</p>
                  </div>
                </div>
                <button
                  onClick={handleSkipQuestion}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shrink-0"
                  title="Skip this follow-up probe and move to the next question"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip Follow-Up</span>
                </button>
              </div>
            )}

            {/* Editable / Streamed Transcript Text Box */}
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Microphone starts automatically after interviewer question ends. Speak now or edit your response here..."
              rows={4}
              className="w-full resize-y text-base sm:text-sm text-white placeholder:text-zinc-400 bg-zinc-950/90 border border-zinc-700/80 rounded-xl p-4 leading-relaxed focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none min-h-[120px]"
            />

            {/* Written Code / Solution Sandbox Block */}
            <div className="space-y-2">
              <CodeEditor
                value={writtenCode}
                onChange={setWrittenCode}
                disabled={isSubmitting}
              />
            </div>

            {/* Microphone & Call Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border w-full">
              
              {/* Audio Recorder Controls */}
              <div className="flex items-center gap-3">
                <AudioRecorder
                  isRecording={isRecording}
                  currentText={answerText}
                  onTranscript={handleTranscript}
                  onRecordingChange={setIsRecording}
                  autoStart={autoStartMic}
                />
              </div>

              {/* Submit & Skip Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSkipQuestion}
                  disabled={isSubmitting}
                  className="px-3.5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm bg-muted hover:bg-muted/80 text-foreground/80 border border-border flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  title="Skip current question/follow-up"
                >
                  <SkipForward className="w-3.5 h-3.5 text-foreground/60 shrink-0" />
                  <span>{isFollowUp ? "Skip Follow-Up" : "Skip Question"}</span>
                </button>

                <button
                  onClick={handleSubmitAnswer}
                  disabled={!isTextAvailable || isSubmitting}
                  className={`px-4 sm:px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm whitespace-nowrap ${
                    isTextAvailable && !isSubmitting
                      ? "bg-accent hover:bg-accent/90 text-white shadow-accent/20"
                      : "bg-muted text-foreground/40 border border-border cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Submit Answer</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
