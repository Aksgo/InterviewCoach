async function callEdgeFunction(functionName: string, body: unknown): Promise<Response> {
  const url = `/api/${functionName}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface ScrapeQuestionsResponse {
  questions: string[];
  error?: string;
}

export async function scrapeInterviewQuestions(role: string, company: string): Promise<ScrapeQuestionsResponse> {
  const res = await callEdgeFunction("scrape-questions", { role, company });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to scrape questions" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface GoogleAIRequest {
  action: "generate-questions" | "score-answer" | "score-resume" | "summarize-interview";
  resumeText?: string;
  role?: string;
  company?: string;
  experienceLevel?: string;
  question?: string;
  answer?: string;
  writtenCode?: string;
  isFollowUp?: boolean;
  followUpCount?: number;
  isFinalQuestion?: boolean;
  sessionQuestions?: unknown[];
  interviewTrack?: string;
}

export interface QuestionItem {
  text: string;
  stage?: "introduction" | "resume_deep_dive" | "core_technical_dsa" | "company_cultural_fit";
  stageName?: string;
  agentName?: string;
  sourceType?: "web_grounded_scraped" | "ai_generated_resume_tailored";
  sourceName?: string;
  sourceUrl?: string;
  originExplanation?: string;
}

export interface GeneratedQuestions {
  questions: (string | QuestionItem)[];
  source?: string;
  snippetsCount?: number;
}

export interface AnswerScore {
  score: number;
  feedback: string;
  interviewerReply?: string;
  needsElaboration?: boolean;
  followUpQuestion?: string;
  relevance: number;
  clarity: number;
  depth: number;
  confidence: number;
}

export interface ResumeScoreResult {
  overallScore: number;
  matchLevel: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface InterviewSummaryResult {
  summary: string;
  mistakes: string[];
  improvements: string[];
}

export interface GoogleAIResponseBase {
  error?: string;
}

export type GoogleAIResponse =
  | (GoogleAIResponseBase & GeneratedQuestions)
  | (GoogleAIResponseBase & AnswerScore)
  | (GoogleAIResponseBase & ResumeScoreResult)
  | (GoogleAIResponseBase & InterviewSummaryResult);

type AIStatusListener = (isProcessing: boolean, action?: string, source?: string) => void;
const listeners = new Set<AIStatusListener>();

export function subscribeAIStatus(listener: AIStatusListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAIStatus(isProcessing: boolean, action?: string, source?: string) {
  listeners.forEach((l) => l(isProcessing, action, source));
}

export async function callGoogleAI(req: GoogleAIRequest): Promise<GoogleAIResponse> {
  const actionName =
    req.action === "generate-questions"
      ? "Generating Web-Grounded Interview Questions..."
      : req.action === "score-answer"
      ? "Evaluating Answer with Gemini AI..."
      : "Analyzing Resume & Matching Skills...";

  notifyAIStatus(true, actionName);
  try {
    const res = await callEdgeFunction("google-ai-chat", req);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to contact AI" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    notifyAIStatus(false, actionName, data.source || "Gemini 2.5 Flash");
    return data;
  } catch (err) {
    notifyAIStatus(false, actionName, "Local Fallback Engine");
    throw err;
  }
}

export interface SpeechmaticsTokenResponse {
  token: string;
  expires_at: string;
}

export async function getSpeechmaticsToken(): Promise<SpeechmaticsTokenResponse> {
  const res = await callEdgeFunction("speechmatics-token", {});
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to get token" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface SpeechmaticsTTSResponse {
  audio?: string;
  mimeType?: string;
  voiceUsed?: string;
  error?: string;
}

export async function generateSpeechmaticsTTS(text: string, voice = "jack"): Promise<SpeechmaticsTTSResponse> {
  const res = await callEdgeFunction("tts", { text, voice });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to generate Speechmatics TTS audio" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}