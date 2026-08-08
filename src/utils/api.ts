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
  action: "generate-questions" | "score-answer" | "score-resume";
  resumeText?: string;
  role?: string;
  company?: string;
  question?: string;
  answer?: string;
}

export interface QuestionItem {
  text: string;
  sourceType?: "brightdata_web_scraped" | "ai_generated_resume_tailored";
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

export interface GoogleAIResponseBase {
  error?: string;
}

export type GoogleAIResponse =
  | (GoogleAIResponseBase & GeneratedQuestions)
  | (GoogleAIResponseBase & AnswerScore)
  | (GoogleAIResponseBase & ResumeScoreResult);

export async function callGoogleAI(req: GoogleAIRequest): Promise<GoogleAIResponse> {
  const res = await callEdgeFunction("google-ai-chat", req);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to contact AI" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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