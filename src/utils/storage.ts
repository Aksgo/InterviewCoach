export interface ResumeScoreData {
  overallScore: number;
  matchLevel: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface InterviewSession {
  id: string;
  resumeText: string;
  company: string;
  role: string;
  experienceLevel?: string;
  candidateName?: string;
  interviewTrack?: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  status: "setup" | "in_progress" | "completed";
  scores?: ScoreData;
  resumeScore?: ResumeScoreData;
  questionSource?: string;
  snippetsCount?: number;
  createdAt: string;
}

export type InterviewStage = "introduction" | "resume_deep_dive" | "core_technical_dsa" | "company_cultural_fit";

export interface InterviewQuestion {
  id: string;
  stage?: InterviewStage;
  stageName?: string;
  agentName?: string;
  text: string;
  answerTranscript?: string;
  followUpQuestion?: string;
  followUpAnswerTranscript?: string;
  isProbed?: boolean;
  score?: number;
  relevance?: number;
  clarity?: number;
  depth?: number;
  confidence?: number;
  feedback?: string;
  writtenCode?: string;
  timeToAnswerSeconds?: number;
  sourceType?: "web_grounded_scraped" | "ai_generated_resume_tailored";
  sourceName?: string;
  sourceUrl?: string;
  originExplanation?: string;
}

export interface ScoreData {
  relevance: number;
  clarity: number;
  depth: number;
  confidence: number;
  overall: number;
  summary: string;
  mistakes?: string[];
  improvements?: string[];
}

const STORAGE_KEY = "ai-interview-coach-session";

export function saveSession(session: InterviewSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    console.warn("Failed to save session to localStorage");
  }
}

export function loadSession(): InterviewSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InterviewSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}