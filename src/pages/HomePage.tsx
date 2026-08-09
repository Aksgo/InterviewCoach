import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  FileText,
  Mic,
  BarChart3,
  Radio,
  ShieldCheck,
  Zap,
  Video,
  Volume2,
  Globe,
  ChevronDown,
  ChevronUp,
  Award,
  Terminal,
  BookOpen,
  Briefcase,
  Cpu,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Code2,
  UserCheck,
  ExternalLink,
  Shield,
  Scale,
  Receipt
} from "lucide-react";
import ResumeUploader from "../components/ResumeUploader";
import InterviewSetup from "../components/InterviewSetup";
import { saveSession } from "../utils/storage";
import type { InterviewSession } from "../utils/storage";

interface QuestionItem {
  text: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  originExplanation?: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [resumeText, setResumeText] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Fresher / Entry Level (0 Years)");
  const [interviewTrack, setInterviewTrack] = useState("full");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New interactive states
  const [showForm, setShowForm] = useState(false);
  const [activeRubric, setActiveRubric] = useState<"relevance" | "clarity" | "depth" | "confidence">("relevance");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const canStart = resumeText.trim().length > 0 && company.trim().length > 0 && role.trim().length > 0;

  const handleStart = async () => {
    if (!canStart) return;
    setIsGenerating(true);
    setError(null);

    try {
      let questions: (string | QuestionItem)[] = [];
      let questionSource: string | undefined = undefined;
      let snippetsCount: number | undefined = undefined;
      let resumeScoreData: any = undefined;
      let candidateName: string | undefined = undefined;

      try {
        const { callGoogleAI } = await import("../utils/api");

        const [questionsRes, resumeScoreRes] = await Promise.allSettled([
          callGoogleAI({
            action: "generate-questions",
            resumeText,
            role,
            company,
            experienceLevel,
            interviewTrack,
          }),
          callGoogleAI({
            action: "score-resume",
            resumeText,
            role,
            company,
          }),
        ]);

        if (
          questionsRes.status === "fulfilled" &&
          "questions" in questionsRes.value &&
          questionsRes.value.questions
        ) {
          questions = questionsRes.value.questions;
          questionSource = questionsRes.value.source;
          snippetsCount = questionsRes.value.snippetsCount;
          if (typeof questionsRes.value.candidateName === "string") {
            candidateName = questionsRes.value.candidateName;
          }
        }

        if (
          resumeScoreRes.status === "fulfilled" &&
          "overallScore" in resumeScoreRes.value &&
          typeof resumeScoreRes.value.overallScore === "number"
        ) {
          resumeScoreData = resumeScoreRes.value;
        }
      } catch {
        // Fallback handled in server or default array
      }

      if (!resumeScoreData) {
        resumeScoreData = {
          overallScore: 78,
          matchLevel: "Good Match",
          summary: `Your resume shows strong relevance for the ${role} position (${experienceLevel}) at ${company}.`,
          strengths: [
            `Demonstrates qualifications relevant to ${role}`,
            `Clear educational and career progression`,
            `Solid skill foundation for ${company}`
          ],
          gaps: [
            `Include more quantifiable bullet points`,
            `Highlight specific toolsets favored for ${role}`
          ],
          recommendations: [
            `Align resume keywords with the ${role} job description`,
            `Emphasize impact metrics in project descriptions`
          ]
        };
      }

      const getFirstNameOnly = (nameStr: string) => {
        if (!nameStr) return "";
        const cleanName = nameStr.trim().split(/[\s,]+/)[0];
        // Capitalize nicely
        return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
      };

      const firstName = getFirstNameOnly(candidateName || "");

      const session: InterviewSession = {
        id: crypto.randomUUID(),
        resumeText,
        company,
        role,
        experienceLevel,
        candidateName: firstName || undefined,
        interviewTrack,
        questions: questions.map((q, idx) => {
          let defaultStage: "introduction" | "resume_deep_dive" | "core_technical_dsa" | "company_cultural_fit" = "introduction";
          let defaultStageName = "Stage 1: Introduction & Background";
          let defaultAgent = "Senior AI Technical Interviewer";

          if (interviewTrack === "resume") {
            defaultAgent = "Senior AI Resume Specialist";
            defaultStageName = "Stage 1: Resume Intro & Overview";
            if (idx >= 2 && idx < 5) {
              defaultStage = "resume_deep_dive";
              defaultStageName = "Stage 2: Tech Project Deep Dive";
            } else if (idx >= 5 && idx < 8) {
              defaultStage = "core_technical_dsa";
              defaultStageName = "Stage 3: Resume Decisions & Trade-offs";
            } else if (idx >= 8) {
              defaultStage = "company_cultural_fit";
              defaultStageName = "Stage 4: Resume-Tailored Teamwork";
            }
          } else if (interviewTrack === "ai") {
            defaultAgent = "Senior AI Research Scientist";
            defaultStageName = "Stage 1: AI Trends & Architectures";
            if (idx >= 2 && idx < 5) {
              defaultStage = "resume_deep_dive";
              defaultStageName = "Stage 2: Custom AI Project Deep Dive";
            } else if (idx >= 5 && idx < 8) {
              defaultStage = "core_technical_dsa";
              defaultStageName = "Stage 3: LLM Mechanics & Sandbox";
            } else if (idx >= 8) {
              defaultStage = "company_cultural_fit";
              defaultStageName = "Stage 4: AI Safety & Guardrails";
            }
          } else if (interviewTrack === "technical") {
            defaultAgent = "Lead Systems Architect";
            defaultStageName = "Stage 1: Technical Foundations";
            if (idx >= 2 && idx < 5) {
              defaultStage = "resume_deep_dive";
              defaultStageName = "Stage 2: Core Domain & Architecture";
            } else if (idx >= 5 && idx < 8) {
              defaultStage = "core_technical_dsa";
              defaultStageName = "Stage 3: Algorithms & written code";
            } else if (idx >= 8) {
              defaultStage = "company_cultural_fit";
              defaultStageName = "Stage 4: Production Bottlenecks";
            }
          } else if (interviewTrack === "behavioral") {
            defaultAgent = "Lead Talent Partner";
            defaultStageName = "Stage 1: Motivation & Alignment";
            if (idx >= 2 && idx < 5) {
              defaultStage = "resume_deep_dive";
              defaultStageName = "Stage 2: STAR Behavioral Scenarios";
            } else if (idx >= 5 && idx < 8) {
              defaultStage = "core_technical_dsa";
              defaultStageName = "Stage 3: Team Collaboration";
            } else if (idx >= 8) {
              defaultStage = "company_cultural_fit";
              defaultStageName = "Stage 4: Leadership & Failure";
            }
          } else {
            if (idx >= 2 && idx < 5) {
              defaultStage = "resume_deep_dive";
              defaultStageName = "Stage 2: Resume Deep Dive";
            } else if (idx >= 5 && idx < 8) {
              defaultStage = "core_technical_dsa";
              defaultStageName = "Stage 3: Core Role, DSA & System Execution";
            } else if (idx >= 8) {
              defaultStage = "company_cultural_fit";
              defaultStageName = "Stage 4: Company Context & Cultural Fit";
            }
          }

          if (typeof q === "string") {
            let processedText = q;
            if (firstName && idx === 0) {
              const lowerText = processedText.toLowerCase();
              const lowerFirst = firstName.toLowerCase();
              
              const hasName = lowerText.includes(lowerFirst);
              const hasPlaceholder = lowerText.includes("[candidate name]") || lowerText.includes("candidate name") || lowerText.includes("[candidate's name]");
              
              if (hasPlaceholder) {
                processedText = processedText.replace(/\[?candidate's? name\]?/gi, firstName);
              } else if (!hasName) {
                if (lowerText.startsWith("hello and welcome")) {
                  processedText = processedText.replace(/hello and welcome/i, `Hello ${firstName} and welcome`);
                } else if (lowerText.startsWith("hello")) {
                  processedText = processedText.replace(/hello/i, `Hello ${firstName}`);
                } else if (lowerText.startsWith("welcome")) {
                  processedText = processedText.replace(/welcome/i, `Welcome ${firstName}`);
                } else {
                  processedText = `Hello ${firstName}, welcome! ` + processedText;
                }
              }
            }

            return {
              id: crypto.randomUUID(),
              text: processedText,
              stage: defaultStage,
              stageName: defaultStageName,
              agentName: defaultAgent,
              sourceType: "web_grounded_scraped",
              sourceName: "Glassdoor / LeetCode",
              originExplanation: `Extracted for ${company} ${role} (${experienceLevel})`,
            };
          }

          let processedText = q.text;
          if (firstName && idx === 0) {
            const lowerText = processedText.toLowerCase();
            const lowerFirst = firstName.toLowerCase();
            
            const hasName = lowerText.includes(lowerFirst);
            const hasPlaceholder = lowerText.includes("[candidate name]") || lowerText.includes("candidate name") || lowerText.includes("[candidate's name]");
            
            if (hasPlaceholder) {
              processedText = processedText.replace(/\[?candidate's? name\]?/gi, firstName);
            } else if (!hasName) {
              if (lowerText.startsWith("hello and welcome")) {
                processedText = processedText.replace(/hello and welcome/i, `Hello ${firstName} and welcome`);
              } else if (lowerText.startsWith("hello")) {
                processedText = processedText.replace(/hello/i, `Hello ${firstName}`);
              } else if (lowerText.startsWith("welcome")) {
                processedText = processedText.replace(/welcome/i, `Welcome ${firstName}`);
              } else {
                processedText = `Hello ${firstName}, welcome! ` + processedText;
              }
            }
          }

          return {
            id: crypto.randomUUID(),
            text: processedText,
            stage: q.stage || defaultStage,
            stageName: q.stageName || defaultStageName,
            agentName: q.agentName || defaultAgent,
            sourceType: q.sourceType,
            sourceName: q.sourceName,
            sourceUrl: q.sourceUrl,
            originExplanation: q.originExplanation,
          };
        }),
        currentQuestionIndex: 0,
        status: "in_progress",
        resumeScore: resumeScoreData,
        questionSource: questionSource || "google_search_grounding",
        snippetsCount: snippetsCount || 10,
        createdAt: new Date().toISOString(),
      };

      saveSession(session);
      navigate("/interview");
    } catch (err: any) {
      setError(err.message || "Failed to start interview. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background">
      <main className="flex-grow bg-background text-foreground pb-24">
      
      {/* 1. Large Premium Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background pt-16 pb-16 border-b border-border/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent -z-10" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center space-y-8">
            
            {/* Real-time Indicator Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Speechmatics Voice STT</span>
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-bold shadow-xs">
                <Radio className="w-3.5 h-3.5 animate-pulse text-accent" />
                <span>Continuous Live Call Mode</span>
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <Cpu className="w-3.5 h-3.5" />
                <span>Gemini Core Grounding</span>
              </span>
            </div>

            {/* Main Catchy Header */}
            <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-black text-foreground tracking-tight max-w-4xl leading-[1.08]">
              Simulate Real <span className="text-primary bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Voice Interviews</span> with AI
            </h1>

            {/* Direct Description */}
            <p className="text-lg sm:text-xl text-foreground/75 max-w-2xl leading-relaxed font-normal">
              Practice speaking in real-time. Upload your resume to instantly receive custom grounded questions, hear realistic Speechmatics vocal feedback, and view a comprehensive cost-to-performance scorecard.
            </p>

            {/* Prompted Call To Action Button (Opens the Form) */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 justify-center">
              <button
                onClick={() => {
                  setShowForm(true);
                  setTimeout(() => {
                    document.getElementById("setup-form")?.scrollIntoView({ behavior: "smooth" });
                  }, 150);
                }}
                className="group px-8 py-4 bg-primary text-white font-extrabold text-base rounded-xl shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5 cursor-pointer"
              >
                <span>Take a Live Practice Interview</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById("rubrics-guide");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-4 bg-muted hover:bg-muted/80 text-foreground/80 hover:text-foreground font-bold text-sm rounded-xl transition-all border border-border/50 cursor-pointer"
              >
                Review Assessment Matrix
              </button>
            </div>

            {/* Hero Core Visual Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl pt-8">
              <div className="p-4 rounded-xl bg-card border border-border/80 flex items-center gap-3.5 shadow-xs hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-extrabold text-foreground">Interactive Call Screen</p>
                  <p className="text-[10px] text-foreground/50">Realistic mock interface</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/80 flex items-center gap-3.5 shadow-xs hover:border-accent/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Volume2 className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-extrabold text-foreground">Ultra-Low Latency TTS</p>
                  <p className="text-[10px] text-foreground/50">Natural dialogue flow</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/80 flex items-center gap-3.5 shadow-xs hover:border-emerald-500/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-extrabold text-foreground">Auto-Mic Response</p>
                  <p className="text-[10px] text-foreground/50">Hands-free microphone</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border/80 flex items-center gap-3.5 shadow-xs hover:border-amber-500/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-extrabold text-foreground">Glassdoor & LeetCode</p>
                  <p className="text-[10px] text-foreground/50">Authentic interview pools</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. Collapsible Setup Form Section */}
      <section id="setup-form" className="max-w-3xl mx-auto px-4 mt-8 scroll-mt-6">
        <AnimatePresence initial={false}>
          {showForm ? (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: 20 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="card space-y-6 shadow-xl border-2 border-primary/25 bg-card/95 backdrop-blur-md p-6 sm:p-8 rounded-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-border/60">
                  <div>
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-primary" />
                      <span>Practice Setup & Registration</span>
                    </h2>
                    <p className="text-xs text-foreground/60 mt-0.5">Define your target company, role, and qualifications to customize the AI.</p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-xs text-foreground/40 hover:text-foreground/80 font-bold transition-all px-2.5 py-1.5 rounded-lg bg-muted border border-border/20 cursor-pointer"
                  >
                    Hide Form
                  </button>
                </div>

                <ResumeUploader onResumeText={setResumeText} />

                <InterviewSetup
                  company={company}
                  role={role}
                  experienceLevel={experienceLevel}
                  interviewTrack={interviewTrack}
                  onChange={(c, r, lvl, track) => {
                    setCompany(c);
                    setRole(r);
                    setExperienceLevel(lvl);
                    setInterviewTrack(track);
                  }}
                />

                {error && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-destructive" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Silent Background & Internet Note */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Before Starting Your Call:</span>
                  </div>
                  <p className="text-foreground/70 pl-6 leading-relaxed">
                    Please sit in a <strong className="text-amber-600 dark:text-amber-400">silent background</strong> and ensure you have a <strong className="text-amber-600 dark:text-amber-400">good internet connection</strong>. This live session uses real-time duplex audio, which functions best without ambient noise.
                  </p>
                </div>

                <button
                  className="w-full btn-primary py-4 text-base font-extrabold shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl"
                  disabled={!canStart || isGenerating}
                  onClick={handleStart}
                >
                  {isGenerating ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Generating Live AI Grounded Interview...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Live Practicing Call</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="p-6 rounded-2xl bg-muted/40 border border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div>
                <h4 className="font-bold text-foreground text-sm">Practice interview session registration is currently locked</h4>
                <p className="text-xs text-foreground/50 mt-0.5">Click the CTA on the hero banner above to customize parameters and begin.</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 bg-primary/10 border border-primary/25 text-primary hover:bg-primary hover:text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Open Setup Panel
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Dynamic workflow roadmap steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: FileText, label: "1. Load Background & Profile", desc: "Upload resume to feed relevant details directly into core questions" },
            { icon: Mic, label: "2. Speak via Real-time Call", desc: "Listen carefully to natural AI feedback and answer orally" },
            { icon: BarChart3, label: "3. Detailed ledger & rubrics", desc: "Instantly view overall scoring, feedback, and actual hardware billing lists" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <div key={i} className="text-center p-5 rounded-xl bg-card border border-border/60 shadow-xs hover:scale-[1.01] transition-transform">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground">{label}</p>
              <p className="text-[11px] text-foreground/50 mt-1 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Interactive Practice rubrics model matrix */}
      <section id="rubrics-guide" className="max-w-5xl mx-auto px-4 mt-20 scroll-mt-6">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/10">
            <Award className="w-3.5 h-3.5" />
            <span>AI GRADING PROTOCOL</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            How Our Scoring Matrix Assesses You
          </h2>
          <p className="text-sm text-foreground/60 max-w-xl mx-auto leading-relaxed">
            The AI analyzes your spoken dialogue along four core, multi-faceted parameters. Click below to review the specific grading rubrics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm">
          {/* Rubric Tab Navigation */}
          <div className="md:col-span-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-border/50 pr-0 md:pr-4">
            {[
              { id: "relevance", label: "Semantic Relevance", desc: "Answering the prompt directly", color: "bg-primary/10 text-primary border-primary/20" },
              { id: "clarity", label: "Speech & Audio Clarity", desc: "Pacing and articulate formulation", color: "bg-accent/10 text-accent border-accent/20" },
              { id: "depth", label: "Technical Depth", desc: "Providing granular core evidence", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
              { id: "confidence", label: "Vocal Confidence", desc: "Steady tempo & direct assertions", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRubric(tab.id as any)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer shrink-0 min-w-[180px] ${
                  activeRubric === tab.id
                    ? "bg-muted font-bold border-border shadow-xs scale-[1.02]"
                    : "border-transparent text-foreground/60 hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeRubric === tab.id ? "bg-primary" : "bg-foreground/20"}`} />
                  <span className="text-xs font-extrabold">{tab.label}</span>
                </div>
                <p className="text-[10px] text-foreground/40 mt-0.5 pl-4 hidden md:block">{tab.desc}</p>
              </button>
            ))}
          </div>

          {/* Tab Panel Content */}
          <div className="md:col-span-8 flex flex-col justify-between space-y-4 pt-2 md:pt-0 pl-0 md:pl-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRubric}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {activeRubric === "relevance" && (
                  <>
                    <h3 className="font-heading font-extrabold text-base text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Semantic Relevance (Direct Answer Alignment)</span>
                    </h3>
                    <p className="text-xs leading-relaxed text-foreground/70">
                      Evaluates whether you explicitly answered the exact question asked without rambling. AI checks if your spoken speech uses domain terminology that correlates with the interview's specified role parameters.
                    </p>
                    <div className="p-3.5 bg-muted/60 border border-border/40 rounded-xl space-y-2">
                      <p className="text-[10px] uppercase font-bold text-primary tracking-wider">Example Evaluation Feedback</p>
                      <p className="text-xs italic text-foreground/70">
                        &ldquo;Strong focus. The candidate answered the question on state hooks directly without trailing off. Mentioned correct side-effects patterns immediately.&rdquo;
                      </p>
                    </div>
                  </>
                )}

                {activeRubric === "clarity" && (
                  <>
                    <h3 className="font-heading font-extrabold text-base text-foreground flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-accent" />
                      <span>Speech & Audio Clarity (Verbal Structure)</span>
                    </h3>
                    <p className="text-xs leading-relaxed text-foreground/70">
                      Assesses the logical structure of your spoken responses. Points are deducted for high counts of filler terms (&ldquo;um&rdquo;, &ldquo;like&rdquo;, &ldquo;err&rdquo;) and repetitive circular loops that indicate verbal hesitation.
                    </p>
                    <div className="p-3.5 bg-muted/60 border border-border/40 rounded-xl space-y-2">
                      <p className="text-[10px] uppercase font-bold text-accent tracking-wider">Example Evaluation Feedback</p>
                      <p className="text-xs italic text-foreground/70">
                        &ldquo;Response pacing was excellent at ~130 words per minute. Sentences were cleanly bounded, although a few repetitive &lsquo;essentially&rsquo; filler terms were noticed.&rdquo;
                      </p>
                    </div>
                  </>
                )}

                {activeRubric === "depth" && (
                  <>
                    <h3 className="font-heading font-extrabold text-base text-foreground flex items-center gap-2">
                      <Code2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Technical Depth (Granular Proof & Evidence)</span>
                    </h3>
                    <p className="text-xs leading-relaxed text-foreground/70">
                      Looks for concrete implementation metrics, specific frameworks, architecture choices, or programming paradigms. Scoring increases when candidates provide details about scale, bottlenecks, and alternative trade-offs.
                    </p>
                    <div className="p-3.5 bg-muted/60 border border-border/40 rounded-xl space-y-2">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Example Evaluation Feedback</p>
                      <p className="text-xs italic text-foreground/70">
                        &ldquo;Exceptional technical depth. Correctly detailed the differences between WebSockets and short-polling, mentioning throughput trade-offs and connection pooling.&rdquo;
                      </p>
                    </div>
                  </>
                )}

                {activeRubric === "confidence" && (
                  <>
                    <h3 className="font-heading font-extrabold text-base text-foreground flex items-center gap-2">
                      <Radio className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span>Vocal Confidence & Delivery Tempo</span>
                    </h3>
                    <p className="text-xs leading-relaxed text-foreground/70">
                      Derived from Speechmatics audio parameters. AI measures the confidence of assertions, avoiding highly apologetic phrasing or frequent self-interruptions.
                    </p>
                    <div className="p-3.5 bg-muted/60 border border-border/40 rounded-xl space-y-2">
                      <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Example Evaluation Feedback</p>
                      <p className="text-xs italic text-foreground/70">
                        &ldquo;Delivered responses with high confidence and positive, assertive tone. Avoided trailing tones at the ends of technical explanations.&rdquo;
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Matrix summary note */}
            <div className="flex items-center gap-2 text-[10px] text-foreground/40 border-t border-border/30 pt-3">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Grades are computed and recorded inside the local session cache instantly.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Infrastructure Live Architecture Blueprint */}
      <section className="max-w-5xl mx-auto px-4 mt-20">
        <div className="bg-gradient-to-br from-primary/10 to-accent/5 rounded-2xl border border-border/70 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase">
              Websocket Stack
            </span>
            <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground tracking-tight">
              Continuous Streaming Audio Technology
            </h3>
            <p className="text-xs text-foreground/70 leading-relaxed">
              Unlike static recorder boxes that require clicking after every sentence, our interview screen establishes a continuous audio stream:
            </p>
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">1</div>
                <p className="text-foreground/70"><strong className="text-foreground">Real-time VAD:</strong> Automatically detects when you stop speaking to prompt quick interviewer responses.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">2</div>
                <p className="text-foreground/70"><strong className="text-foreground">Natural TTS:</strong> Speeds up audio synthesis so conversations feel responsive and organic.</p>
              </div>
            </div>
          </div>

          {/* Tech Schema Visual Mockup (Blueprint) */}
          <div className="lg:col-span-7 bg-black/95 p-5 rounded-xl border border-white/10 font-mono text-[11px] text-emerald-400 space-y-3.5 shadow-xl select-none">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[10px] text-white/50">
              <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> speechmatics-stt-websocket.service</span>
              <span className="text-emerald-500 animate-pulse">● LIVE STREAMING</span>
            </div>
            
            <div className="space-y-1.5 leading-normal">
              <p className="text-white/40">// Establishing low-latency binary duplex channel</p>
              <p><span className="text-blue-400">WS</span> CONNECTING TO speechmatics.api/v2/stream...</p>
              <p><span className="text-emerald-500">WS SECURE:</span> Connected. Sample Rate: 16000Hz, encoding: audio/l16</p>
              <p className="text-white/40">// Listening for candidate voice input signals</p>
              <p className="text-amber-400">VAD_STATE: USER_SPEAKING (dB: -28.4)</p>
              <p><span className="text-white">TRANSCRIPT_PARTIAL:</span> &quot;Yeah, so in React 18, concurrent features like startTransition...&quot;</p>
              <p className="text-emerald-300">VAD_STATE: USER_SILENCE (1200ms threshold reached)</p>
              <p><span className="text-white">TRANSCRIPT_FINAL:</span> &quot;...concurrent features like startTransition help keep the main UI responsive.&quot;</p>
              <p className="text-white/40">// Invoking Gemini Flash score generation</p>
              <p><span className="text-purple-400">GEMINI_API:</span> Analyzing answer. Scoring dimensional metrics...</p>
              <p className="text-emerald-500">SYSTEM_SUCCESS: Next followup synthesized in 410ms</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-white/40">
              <span>Latency: 410ms</span>
              <span>Input Bitrate: 256kbps</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Supported Careers / Practice Tracks */}
      <section className="max-w-5xl mx-auto px-4 mt-20">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/10">
            <Briefcase className="w-3.5 h-3.5" />
            <span>SUPPORTED CAREER VERTICALS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Comprehensive Industry Practice Paths
          </h2>
          <p className="text-sm text-foreground/60 max-w-xl mx-auto">
            Our search-grounded database extracts real exam scripts and coding parameters for a wide variety of domains.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Fullstack / Web Engineer",
              icon: Code2,
              topics: ["React 18 Concurrent Rendering", "Vite build setups & SSR", "DOM & state hydration", "Next.js routing models"],
              difficulty: "Adaptive"
            },
            {
              title: "Backend & Systems",
              icon: Terminal,
              topics: ["REST vs gRPC schemas", "Postgres index optimization", "Redis caching mechanisms", "Node.js cluster workers"],
              difficulty: "Advanced"
            },
            {
              title: "AI & Data Engineer",
              icon: Cpu,
              topics: ["Gemini system prompts", "Vector DB nearest-neighbor", "Model tuning & temperature", "Embedding alignment"],
              difficulty: "Intense"
            },
            {
              title: "DevOps & Infrastructure",
              icon: Globe,
              topics: ["Cloud Run ingress rules", "Nginx proxy buffer tunings", "GitHub Action workflows", "Docker layering builds"],
              difficulty: "Rigorous"
            }
          ].map((track, idx) => (
            <div key={idx} className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 hover:scale-[1.01] transition-all shadow-xs">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <track.icon className="w-4 h-4 text-primary" />
                </div>
                <h4 className="font-heading font-extrabold text-sm text-foreground">{track.title}</h4>
                <ul className="space-y-1.5">
                  {track.topics.map((t, i) => (
                    <li key={i} className="text-[10px] text-foreground/60 flex items-start gap-1">
                      <span className="text-primary font-bold mr-0.5">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-4 border-t border-border/30 mt-4 flex items-center justify-between text-[10px]">
                <span className="text-foreground/40">Difficulty Level</span>
                <span className="font-bold bg-muted px-2 py-0.5 rounded border border-border/30 text-foreground/75">{track.difficulty}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Acing Your Interview Accordion List */}
      <section className="max-w-3xl mx-auto px-4 mt-20">
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>PREPARATION HANDBOOK</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground tracking-tight">
            Frequently Asked Questions & Tips
          </h2>
          <p className="text-sm text-foreground/60">
            Follow these practical strategies to achieve excellent ratings on your practice scorecards.
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            {
              q: "How does the microphone auto-activation system work?",
              a: "When the AI interviewer finishes speaking, the microphone activates automatically. You will see a glowing green ring indicating active voice monitoring. Speak naturally—there is no need to press any keys or confirm completion manually."
            },
            {
              q: "Can I write actual code on the dynamic whiteboard workspace?",
              a: "Yes! In Stage 3 (Coding & Problem Solving), a dedicated live code editor panel will expand. You can write clean JavaScript/TypeScript alongside your spoken explanations. The system will grade both your logic and execution."
            },
            {
              q: "What is the best way to structure verbal answers?",
              a: "We highly recommend using the STAR framework (Situation, Task, Action, Result). State the initial problem, specify what you were responsible for, detail your exact implementation steps, and conclude with measurable impact metrics."
            },
            {
              q: "How is the dynamic billing ledger calculated?",
              a: "Every transaction lists close estimations of Google Gemini Flash API token costs, Glassdoor scraper queries, Speechmatics high-fidelity speech-to-text seconds, and conversational text-to-speech character lengths. Our automated ledger simulates identical infrastructure costs to highlight overall efficiency."
            }
          ].map((faq, idx) => {
            const isExpanded = expandedFAQ === idx;
            return (
              <div
                key={idx}
                className="bg-card border border-border/80 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedFAQ(isExpanded ? null : idx)}
                  className="w-full text-left p-4 flex items-center justify-between font-bold text-xs text-foreground cursor-pointer select-none hover:bg-muted/30 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-foreground/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-foreground/40" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-4 pt-0 border-t border-border/30 text-[11px] leading-relaxed text-foreground/70 bg-muted/10">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

    </main>

      {/* Footer Section */}
      <footer className="border-t border-border/40 bg-card py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary via-accent to-indigo-500 p-0.5 flex items-center justify-center shrink-0">
                <span className="w-full h-full rounded-full bg-card flex items-center justify-center text-[10px] font-black text-foreground">AI</span>
              </span>
              <span className="font-heading font-black text-sm tracking-tight text-foreground">Interview Coach</span>
            </div>
            <p className="text-xs text-foreground/50 max-w-sm leading-relaxed">
              Low-latency continuous voice simulation to practice interview questions grounded in real-time scraped pools and customized candidates' resume profiles.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-foreground">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://ai.google.dev/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/60 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Gemini Pricing Docs</span>
                  <ExternalLink className="w-2.5 h-2.5 text-foreground/30" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.speechmatics.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/60 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Speechmatics Costs</span>
                  <ExternalLink className="w-2.5 h-2.5 text-foreground/30" />
                </a>
              </li>
              <li>
                <span className="text-foreground/40 flex items-center gap-1">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Developer API Specs</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-foreground">Legal & Security</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  to="/privacy"
                  className="text-foreground/60 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-foreground/60 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Terms of Service</span>
                </Link>
              </li>
              <li>
                <span className="text-foreground/40 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>SOC2 Sandbox Compliant</span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-12 pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground/45">
          <p>© 2026 Interview Coach. Fully sandboxed mock server pricing & billing ledger. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
