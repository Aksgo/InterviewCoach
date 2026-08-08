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
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  status: "setup" | "in_progress" | "completed";
  scores?: ScoreData;
  resumeScore?: ResumeScoreData;
  questionSource?: string;
  snippetsCount?: number;
  createdAt: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  answerTranscript?: string;
  score?: number;
  feedback?: string;
  sourceType?: "brightdata_web_scraped" | "ai_generated_resume_tailored";
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