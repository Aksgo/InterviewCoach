import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Heuristically extracts candidate's name from the first few non-empty lines of a resume
function extractNameHeuristically(resumeText: string): string | null {
  if (!resumeText) return null;
  const lines = resumeText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return null;
  
  // Heuristic: check first 4 lines
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const line = lines[i];
    // Exclude common header placeholders or generic words
    if (/^(resume|curriculum vitae|cv|portfolio|contact|about me|profile|experience|education|skills|summary|name|phone|email)/i.test(line)) {
      continue;
    }
    // Check if line consists of 2-4 capitalized words
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const isName = words.every(w => {
        // e.g. "John", "O'Connor", "A.", "Doe-Smith"
        return /^[A-Za-z][a-zA-Z.'-]*$/.test(w) || /^[A-Z]\.$/.test(w);
      });
      if (isName) {
        return line;
      }
    }
  }
  return null;
}

// Global state for tracking model rate limits / quota status
let globalQuotaExceeded = false;
let globalLastQuotaTime: number | null = null;
const modelStatusMap: Record<string, { rateLimited: boolean; lastError: string | null; lastChecked: number }> = {
  "gemini-3.6-flash": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-3.5-flash-lite": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-3.1-flash-lite": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-2.5-flash": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-2.5-pro": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-2.0-flash": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-1.5-flash": { rateLimited: false, lastError: null, lastChecked: Date.now() },
  "gemini-1.5-pro": { rateLimited: false, lastError: null, lastChecked: Date.now() },
};

// Helper to identify rate limits, quota limits, and 503/500 high-demand errors
function isQuotaOrOverload(msg: string): boolean {
  const lower = (msg || "").toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("unavailable") ||
    lower.includes("rate limit")
  );
}

async function generateWithFallback(ai: GoogleGenAI, contents: string, config: any = {}) {
  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
  ];

  for (const model of models) {
    // 1) If tools are provided (e.g. googleSearch), call Gemini WITH tools but WITHOUT responseMimeType
    // because Gemini API returns 400 if responseMimeType="application/json" is passed with tools.
    if (config && config.tools && config.tools.length > 0) {
      try {
        const configWithTools = { ...config };
        delete configWithTools.responseMimeType;
        const response = await ai.models.generateContent({
          model,
          contents,
          config: configWithTools,
        });
        if (response && response.text) {
          modelStatusMap[model] = { rateLimited: false, lastError: null, lastChecked: Date.now() };
          globalQuotaExceeded = false;
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (isQuotaOrOverload(msg)) {
          console.log(`[Gemini API] ${model} high demand / quota reached (with tools). Failing over...`);
          modelStatusMap[model] = { rateLimited: true, lastError: "Model Busy or Quota Exceeded", lastChecked: Date.now() };
        } else {
          console.log(`[Gemini API] Notice for ${model} (with tools): ${msg.substring(0, 100)}`);
        }
      }
    }

    // 2) Fallback attempt without tools (using responseMimeType if provided in original config)
    try {
      const configNoTools = { ...config };
      delete configNoTools.tools;
      const response = await ai.models.generateContent({
        model,
        contents,
        config: configNoTools,
      });
      if (response && response.text) {
        modelStatusMap[model] = { rateLimited: false, lastError: null, lastChecked: Date.now() };
        globalQuotaExceeded = false;
        return { response, modelUsed: model };
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isQuotaOrOverload(msg)) {
        console.log(`[Gemini API] ${model} high demand / quota reached. Failing over to next model...`);
        modelStatusMap[model] = { rateLimited: true, lastError: "Model Busy or Quota Exceeded", lastChecked: Date.now() };
      } else {
        console.log(`[Gemini API] Notice for ${model}: ${msg.substring(0, 100)}`);
      }
    }
  }

  // If all models failed or hit high demand / quota
  globalQuotaExceeded = true;
  globalLastQuotaTime = Date.now();
  return null;
}

export function createExpressApp() {
  const app = express();

  app.use(express.json());

  // CORS headers for local/cross-origin requests
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // /api/ai-status endpoint
  app.get("/api/ai-status", (_req, res) => {
    const ai = getGeminiClient();
    const isRateLimited = globalQuotaExceeded || Object.values(modelStatusMap).every((m) => m.rateLimited);

    res.json({
      status: isRateLimited ? "rate_limited" : "active",
      isQuotaExceeded: isRateLimited,
      hasApiKey: !!ai,
      provider: isRateLimited ? "Local Intelligence Engine (Gemini Quota Reached)" : "Google Gemini AI",
      activeEngine: isRateLimited ? "Local Intelligence Engine" : "Google Gemini 3.6 Flash",
      models: [
        {
          id: "gemini-3.6-flash",
          name: "Gemini 3.6 Flash",
          status: modelStatusMap["gemini-3.6-flash"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-3.6-flash"]?.rateLimited,
        },
        {
          id: "gemini-3.5-flash-lite",
          name: "Gemini 3.5 Flash Lite",
          status: modelStatusMap["gemini-3.5-flash-lite"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-3.5-flash-lite"]?.rateLimited,
        },
        {
          id: "gemini-3.1-flash-lite",
          name: "Gemini 3.1 Flash Lite",
          status: modelStatusMap["gemini-3.1-flash-lite"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-3.1-flash-lite"]?.rateLimited,
        },
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          status: modelStatusMap["gemini-2.5-flash"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-2.5-flash"]?.rateLimited,
        },
        {
          id: "gemini-2.5-pro",
          name: "Gemini 2.5 Pro",
          status: modelStatusMap["gemini-2.5-pro"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-2.5-pro"]?.rateLimited,
        },
        {
          id: "gemini-2.0-flash",
          name: "Gemini 2.0 Flash",
          status: modelStatusMap["gemini-2.0-flash"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-2.0-flash"]?.rateLimited,
        },
        {
          id: "gemini-1.5-flash",
          name: "Gemini 1.5 Flash",
          status: modelStatusMap["gemini-1.5-flash"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-1.5-flash"]?.rateLimited,
        },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          status: modelStatusMap["gemini-1.5-pro"]?.rateLimited ? "429 Rate Limited / Quota Reached" : "Active",
          isRateLimited: !!modelStatusMap["gemini-1.5-pro"]?.rateLimited,
        },
        {
          id: "local-fallback",
          name: "Local Intelligence Engine",
          status: "100% Operational (Instant)",
          isRateLimited: false,
        },
      ],
      groundingEnabled: !isRateLimited,
      groundingTool: "Google Search (Glassdoor, LeetCode, GeeksforGeeks)",
      rateLimitHandling: "Multi-model failover & smart local backup",
      lastQuotaExceededAt: globalLastQuotaTime ? new Date(globalLastQuotaTime).toLocaleTimeString() : null,
      timestamp: new Date().toISOString(),
    });
  });

  // /api/google-ai-chat
  app.post("/api/google-ai-chat", async (req, res) => {
    try {
      const { action, resumeText, role, company, interviewTrack } = req.body || {};

      console.log(`\n==================================================`);
      console.log(`[API REQUEST LOG] /api/google-ai-chat | Action: "${action}" | Role: "${role}" | Company: "${company || 'N/A'}" | Track: "${interviewTrack || 'default/full'}"`);
      console.log(`==================================================`);

      const ai = getGeminiClient();

      if (action === "generate-questions") {
        const { experienceLevel = "Fresher / Entry Level (0 Years)" } = req.body;
        if (!resumeText || !role) {
          res.status(400).json({ error: "Missing required fields: resumeText, role" });
          return;
        }

        const track = (interviewTrack || "full").toLowerCase();

        // Configure the dynamic AI prompts and fallback agents based on selection
        let prompt = "";
        let fallbackAgentName = "Senior AI Technical Interviewer";
        let fallbackQuestions: any[] = [];

        if (track === "resume") {
          fallbackAgentName = "Senior AI Resume Specialist";
          prompt = `You are a team of elite technical interview agents called the "Senior AI Resume Specialist" at ${company || "a top tech firm"}.
Your task is to:
1. Extract the candidate's name from the candidate's resume (if present).
2. Generate 10 RIGOROUS, highly realistic interview questions divided into 4 SEQUENTIAL INTERVIEW STAGES focusing purely on a RESUME DEEP DIVE ("Resume Grind") for a candidate applying for "${role}" at "${company || "the target company"}" with experience level: "${experienceLevel}".
The entire interview should probe specific projects, tools, metrics, architectural choices, previous challenges, achievements, technical trade-offs, and career trajectory as described in the candidate's resume:

Candidate Resume:
${resumeText}

Search the web using Google Search tool for actual candidate-reported resume deep dive questions or technical project questions on Glassdoor, Indeed, or forums for ${company || "top tech firms"} ${role} interviews.

Generate exactly 10 questions structured into 4 stages:
1. STAGE 1 (Questions 1-2): "introduction" - Stage Name: "Stage 1: Resume Introduction & Project Overview", Agent Name: "Senior AI Resume Specialist". CRITICAL MANDATE FOR QUESTION 1: Question 1 MUST open with a warm, articulate verbal greeting and introduction. Introduce this as the "Resume Grind" track and ask for an overview of their career trajectory, main projects, and technologies on their resume.
2. STAGE 2 (Questions 3-5): "resume_deep_dive" - Stage Name: "Stage 2: Technical Project Deep Dive", Agent Name: "Senior AI Resume Specialist". Probing specific architecture, design choices, and execution details of the candidate's listed projects.
3. STAGE 3 (Questions 6-8): "core_technical_dsa" - Stage Name: "Stage 3: Resume Decisions & Trade-offs", Agent Name: "Senior AI Resume Specialist". Ask technical scenario and trade-off questions directly linked to the specific technologies and libraries listed on their resume, including written sandboxing.
4. STAGE 4 (Questions 9-10): "company_cultural_fit" - Stage Name: "Stage 4: Resume-Tailored Teamwork & Growth", Agent Name: "Senior AI Resume Specialist". Behavioral or leadership scenarios grounded in their past employment and matching ${company || "the company"}'s culture.

Return a JSON object with two fields:
- "candidateName": "Extracted candidate name (e.g. 'John Doe') or empty string if not found"
- "questions": A JSON array of 10 question objects matching the specified schema.

For each question, the schema is:
- "text": Question text (clearly stated).
- "stage": "introduction", "resume_deep_dive", "core_technical_dsa", or "company_cultural_fit".
- "stageName": Stage name as specified above.
- "agentName": "Senior AI Resume Specialist".
- "sourceType": "web_grounded_scraped" or "ai_generated_resume_tailored".
- "sourceName": Source platform (e.g., "Glassdoor", "Indeed", "AI Resume Audit").
- "sourceUrl": Relevant URL if scraped, or empty string.
- "originExplanation": 1-sentence explanation of why this question was selected for this stage and experience level.

Return ONLY a JSON object matching this schema.`;

          fallbackQuestions = [
            {
              text: `Hello and welcome! I am your Senior AI Resume Specialist today. I will be guiding you through a rigorous, 10-question "Resume Grind" interview for the ${role} position at ${company || "our company"}. Let's begin with Stage 1: Resume Introduction & Project Overview. To start, please introduce yourself and walk me through the key progression of experiences and technologies highlighted on your resume at the ${experienceLevel} level.`,
              stage: "introduction",
              stageName: "Stage 1: Resume Introduction & Project Overview",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Warm greeting introducing the Resume Grind track and asking for a summary of resume history."
            },
            {
              text: `Looking at the chronological timeline of your resume, which of these experiences do you feel represents your absolute best professional or educational effort, and what motivated those technology decisions?`,
              stage: "introduction",
              stageName: "Stage 1: Resume Introduction & Project Overview",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Asks for a motivation overview of technology choices across the timeline."
            },
            {
              text: `Let's deep dive into the primary project on your resume. What was the exact architecture, how did data flow through the components, and what was your specific technical contribution?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Technical Project Deep Dive",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Drills deep into the candidate's core architecture and ownership from their resume."
            },
            {
              text: `For the projects mentioned on your resume, what was a major technical roadblock or scaling bottleneck you encountered, and how did you diagnose and overcome it?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Technical Project Deep Dive",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Probes real troubleshooting, debugging, and execution skills in the candidate's past projects."
            },
            {
              text: `Identify a specific quantitative metric, load increase, performance improvement, or efficiency score you achieved in your past experience. How did you measure it?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Technical Project Deep Dive",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Verifies impact metrics and quantifiably-driven outcomes on the candidate's resume."
            },
            {
              text: `You mention several frameworks or libraries on your resume. Let's do a sandbox exercise: write a clean code script, data schema, or query that demonstrates your advanced mastery of one of these preferred tools in a complex scenario.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Resume Decisions & Trade-offs",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Written sandboxed coding/schema test specifically targeting their listed stack."
            },
            {
              text: `Why did you select the specific database or state management solution mentioned in your resume projects? What other alternatives (like SQL vs NoSQL, or local vs cloud) did you evaluate, and why did they lose out?`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Resume Decisions & Trade-offs",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Verifies the candidate's conceptual trade-off decisions for resume architectures."
            },
            {
              text: `How would you refactor or scale the backend or system structure of the project on your resume if its traffic, concurrent users, or data size suddenly scaled 100x? Explain verbally and write key structural mockups in the sandbox.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Resume Decisions & Trade-offs",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Assesses scaling methodology of the candidate's existing work."
            },
            {
              text: `In your past roles or projects, how did you handle a situation where a cross-functional partner (e.g. product or design) proposed a feature that conflicted with the technical architecture you defined?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Resume-Tailored Teamwork & Growth",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Examines stakeholder management and technical influence in past roles."
            },
            {
              text: `Looking at your experience, how do you plan to transfer the specific lessons, domain knowledge, and practices you've accumulated so far to accelerate project deliveries at ${company || "our company"}?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Resume-Tailored Teamwork & Growth",
              agentName: "Senior AI Resume Specialist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Grind Track",
              sourceUrl: "",
              originExplanation: "Directly maps past experience to culture fit and immediate impact potential at the target company."
            }
          ];
        } else if (track === "technical") {
          fallbackAgentName = "Lead Systems Architect";
          prompt = `You are a team of elite technical interview agents called the "Lead Systems Architect" at ${company || "a top tech firm"}.
Your task is to:
1. Extract the candidate's name from the candidate's resume (if present).
2. Generate 10 RIGOROUS, highly realistic interview questions divided into 4 SEQUENTIAL INTERVIEW STAGES focusing on a CORE TECHNICAL INTERVIEW for a candidate applying for "${role}" at "${company || "the target company"}" with experience level: "${experienceLevel}".
The entire interview should assess standard fundamental computer science, domain-specific concepts, systems design, DSA algorithms, programming, optimization, and scale engineering for "${role}" at "${experienceLevel}" level. Do not tie these to their resume achievements (ignore specific resume details when asking, focusing on general excellence for the target role).

Candidate Resume (for context only):
${resumeText}

Search the web using Google Search tool for actual candidate-reported technical, programming, system design, and DSA questions on LeetCode, GeeksforGeeks, or Glassdoor for ${company || "top tech firms"} ${role} interviews.

Generate exactly 10 questions structured into 4 stages:
1. STAGE 1 (Questions 1-2): "introduction" - Stage Name: "Stage 1: Technical Foundations & Concepts", Agent Name: "Lead Systems Architect". CRITICAL MANDATE FOR QUESTION 1: Question 1 MUST open with a warm, articulate verbal greeting and introduction. Introduce this as the "Core Technical" track and ask about their core technical stack, key paradigms, and fundamental architectural concepts.
2. STAGE 2 (Questions 3-5): "resume_deep_dive" - Stage Name: "Stage 2: Core Domain & System Architecture", Agent Name: "Lead Systems Architect". Probing domain-specific system architecture, service communication, and data modeling challenges relevant to ${role}.
3. STAGE 3 (Questions 6-8): "core_technical_dsa" - Stage Name: "Stage 3: Algorithms & Written Sandboxing", Agent Name: "Lead Systems Architect". Focus on DSA algorithms, programming tasks, and problem solving requiring written code or design in the sandbox.
4. STAGE 4 (Questions 9-10): "company_cultural_fit" - Stage Name: "Stage 4: Production Bottlenecks & Failure Modes", Agent Name: "Lead Systems Architect". Technical troubleshooting, debugging, and high-concurrency production incident scenarios.

Return a JSON object with two fields:
- "candidateName": "Extracted candidate name (e.g. 'John Doe') or empty string if not found"
- "questions": A JSON array of 10 question objects matching the specified schema.

For each question, the schema is:
- "text": Question text (clearly stated).
- "stage": "introduction", "resume_deep_dive", "core_technical_dsa", or "company_cultural_fit".
- "stageName": Stage name as specified above.
- "agentName": "Lead Systems Architect".
- "sourceType": "web_grounded_scraped" or "ai_generated_resume_tailored".
- "sourceName": Source platform (e.g., "LeetCode Discuss", "GeeksforGeeks", "Systems Design Interview").
- "sourceUrl": Relevant URL if scraped, or empty string.
- "originExplanation": 1-sentence explanation of why this question was selected for this stage and experience level.

Return ONLY a JSON object matching this schema.`;

          fallbackQuestions = [
            {
              text: `Hello and welcome! I am your Lead Systems Architect today, and I'll be guiding you through a rigorous, 10-question "Core Job Questions" technical interview for the ${role} position at ${company || "our company"}. Let's start with Stage 1: Technical Foundations & Concepts. Please introduce your core technical stack, preferred architectural patterns, and how you ensure clean, modular code at the ${experienceLevel} level.`,
              stage: "introduction",
              stageName: "Stage 1: Technical Foundations & Concepts",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Technical Foundations",
              sourceUrl: "",
              originExplanation: "Onboards the candidate onto the Core Technical track, focusing on programming standards."
            },
            {
              text: `In modern development for ${role}, how do you evaluate and choose between stateful and stateless architectures, and what are the main operational implications?`,
              stage: "introduction",
              stageName: "Stage 1: Technical Foundations & Concepts",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "System Architecture",
              sourceUrl: "",
              originExplanation: "Verifies foundational system design concepts for the target role."
            },
            {
              text: `Let's talk about backend communication. Can you explain the trade-offs between REST, GraphQL, and gRPC/WebSockets? When would you prefer one over the other for a system under high-concurrency load?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Core Domain & System Architecture",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "API Design & Protocols",
              sourceUrl: "",
              originExplanation: "Evaluates core communication protocols and scaling fundamentals."
            },
            {
              text: `How do you design an efficient caching strategy (e.g. Redis, CDN, client-side) to mitigate database bottlenecks? Describe how you manage cache invalidation and cache stampedes.`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Core Domain & System Architecture",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Caching Paradigms",
              sourceUrl: "",
              originExplanation: "Assesses caching layers, data replication, and high-load system design."
            },
            {
              text: `How do you guarantee database consistency and transaction integrity across distributed services or microservices? Explain concepts like the Saga pattern or Two-Phase Commit.`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Core Domain & System Architecture",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Distributed Databases",
              sourceUrl: "",
              originExplanation: "Evaluates advanced distributed systems design and data safety expertise."
            },
            {
              text: `Let's tackle a key Data Structure or Algorithmic challenge tailored for ${role}. How would you design an efficient algorithm to process, sort, or filter large data streams in real time? Please explain your approach verbally and write your code or pseudo-code in the written sandbox below.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Algorithms & Written Sandboxing",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "LeetCode Discuss Pattern",
              sourceUrl: "https://leetcode.com",
              originExplanation: "Standard programmatic algorithmic puzzle testing execution speed and optimization."
            },
            {
              text: `Write a complete code function, class structure, or relational schema in the sandbox to manage a highly concurrent system entity (e.g., rate-limiter, job-scheduler, or a nested comment feed).`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Algorithms & Written Sandboxing",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Coding Sandbox",
              sourceUrl: "",
              originExplanation: "Hands-on coding task targeting architectural components and structure."
            },
            {
              text: `Explain how you mathematically evaluate time and space complexity (Big-O) when designing system components, and how you optimize loops or recursive calls to prevent memory leaks under high concurrency.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Algorithms & Written Sandboxing",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Complexity Analysis",
              sourceUrl: "",
              originExplanation: "Assesses foundational computer science principles and space-time optimization."
            },
            {
              text: `Suppose you encounter a critical system bug or data edge-case during production deployment. Walk me through your step-by-step debugging methodology, telemetry analysis, and rollout rollback protocols.`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Production Bottlenecks & Failure Modes",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Production Debugging",
              sourceUrl: "",
              originExplanation: "Tests real-world operational execution, logging, and error resolution."
            },
            {
              text: `How do you perform load testing, capacity planning, and stress testing on your services prior to high-profile product launches? What metrics do you monitor?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Production Bottlenecks & Failure Modes",
              agentName: "Lead Systems Architect",
              sourceType: "web_grounded_scraped",
              sourceName: "Stress Testing",
              sourceUrl: "",
              originExplanation: "Evaluates proactive engineering, metrics monitoring, and operational excellence."
            }
          ];
        } else if (track === "ai") {
          fallbackAgentName = "Senior AI Research Scientist";
          prompt = `You are a team of elite AI/ML research and engineering specialists called the "Senior AI Research Scientist" at ${company || "a top tech firm"}.
Your task is to:
1. Extract the candidate's name from the candidate's resume (if present).
2. Generate 10 RIGOROUS, highly realistic interview questions divided into 4 SEQUENTIAL INTERVIEW STAGES focusing on a cutting-edge AI, LLM, and AGENTIC SYSTEM ENGINEERING INTERVIEW for a candidate applying for "${role}" at "${company || "the target company"}" with experience level: "${experienceLevel}".
The entire interview should assess trending AI concepts (such as Agentic AI systems, LLM pre-training, fine-tuning/LoRA, retrieval-augmented generation (RAG), vector embeddings/databases, transformer architectures, GQA/attention, KV caching) and backend/runtime working of LLMs (such as continuous batching, speculative decoding, quantization FP8/INT4, and vLLM/Inference engines), combined with the candidate's listed projects/resume achievements to ask specific questions.

Candidate Resume:
${resumeText}

Search the web using Google Search tool for actual candidate-reported AI, machine learning, and LLM engineering questions on LeetCode Discuss, HuggingFace, Glassdoor, or tech blogs for ${company || "top tech firms"} ${role} interviews.

Generate exactly 10 questions structured into 4 stages:
1. STAGE 1 (Questions 1-2): "introduction" - Stage Name: "Stage 1: AI Trends & Fundamental Architectures", Agent Name: "Senior AI Research Scientist". CRITICAL MANDATE FOR QUESTION 1: Question 1 MUST open with a warm, articulate verbal greeting and introduction. Introduce this as the "AI Specialist" track and ask about their core AI interests (such as Agentic AI, transformers, or large models) and how they keep up with trending models.
2. STAGE 2 (Questions 3-5): "resume_deep_dive" - Stage Name: "Stage 2: Custom AI Project Deep Dive", Agent Name: "Senior AI Research Scientist". Probing specific AI/ML, NLP, system, or backend projects on their resume, or asking how they would redesign one of their listed projects to integrate a production-ready LLM/Agentic workflow.
3. STAGE 3 (Questions 6-8): "core_technical_dsa" - Stage Name: "Stage 3: LLM Mechanics & Sandbox Execution", Agent Name: "Senior AI Research Scientist". Written coding or sandboxing task testing transformer math, custom attention, prompt structuring, agent tool-calling loops, or model-serving routing logic in the sandbox.
4. STAGE 4 (Questions 9-10): "company_cultural_fit" - Stage Name: "Stage 4: AI Safety, Guardrails & Production Scaling", Agent Name: "Senior AI Research Scientist". Safety protocols (hallucination reduction, toxic output filtering, prompt injection defense, red-teaming) and latency/throughput trade-offs of serving large-scale agentic networks.

Return a JSON object with two fields:
- "candidateName": "Extracted candidate name (e.g. 'John Doe') or empty string if not found"
- "questions": A JSON array of 10 question objects matching the specified schema.

For each question, the schema is:
- "text": Question text (clearly stated).
- "stage": "introduction", "resume_deep_dive", "core_technical_dsa", or "company_cultural_fit".
- "stageName": Stage name as specified above.
- "agentName": "Senior AI Research Scientist".
- "sourceType": "web_grounded_scraped" or "ai_generated_resume_tailored".
- "sourceName": Source platform (e.g., "Glassdoor", "LeetCode Discuss", "HuggingFace", "AI Engineering Review").
- "sourceUrl": Relevant URL if scraped, or empty string.
- "originExplanation": 1-sentence explanation of why this question was selected for this stage and experience level.

Return ONLY a JSON object matching this schema.`;

          fallbackQuestions = [
            {
              text: `Hello and welcome! I am your Senior AI Research Scientist today. I am thrilled to guide you through this specialized "AI Specialist" interview track for the ${role} position at ${company || "our company"}. Today, we will explore cutting-edge AI trends, LLM architectures, and agentic workflows, starting with Stage 1: AI Trends & Fundamental Architectures. To begin, could you introduce yourself and share your perspective on the shift towards Agentic AI and how you leverage these trends at the ${experienceLevel} level?`,
              stage: "introduction",
              stageName: "Stage 1: AI Trends & Fundamental Architectures",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "AI Research Track",
              sourceUrl: "",
              originExplanation: "Warm greeting introducing the AI Specialist track and exploring fundamental perspectives on modern AI trends."
            },
            {
              text: `Let's discuss LLM architectures. What are the key bottlenecks of the traditional Transformer's attention mechanism (e.g. KV cache memory growth, quadratic complexity), and how do techniques like Grouped-Query Attention (GQA) or FlashAttention mitigate them?`,
              stage: "introduction",
              stageName: "Stage 1: AI Trends & Fundamental Architectures",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "LLM Transformer Architecture",
              sourceUrl: "",
              originExplanation: "Tests foundational knowledge of LLM attention and structural optimizations under load."
            },
            {
              text: `Looking at the projects on your resume, how would you refactor or extend one of your existing systems to integrate a production-ready, multi-agent framework? What tools, routers, or memory strategies would you employ?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Custom AI Project Deep Dive",
              agentName: "Senior AI Research Scientist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "AI Project Refactoring",
              sourceUrl: "",
              originExplanation: "Combines the candidate's resume projects with trending multi-agent system design principles."
            },
            {
              text: `For a project from your resume, let's say you want to add Retrieval-Augmented Generation (RAG). How would you design the embedding ingestion pipeline, choose a vector database, and ensure low-latency hybrid search (dense + sparse retrieval)?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Custom AI Project Deep Dive",
              agentName: "Senior AI Research Scientist",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "RAG System Architecture",
              sourceUrl: "",
              originExplanation: "Probes hands-on RAG integration, vector similarity search, and data processing pipelines."
            },
            {
              text: `When deploying an AI agentic workflow, state management and tool-calling loop control are paramount. How do you prevent agents from entering infinite execution loops, and how do you monitor cost/token consumption in production?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Custom AI Project Deep Dive",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "Agentic Loop Monitoring",
              sourceUrl: "",
              originExplanation: "Assesses production considerations of stateful AI agent environments."
            },
            {
              text: `Let's work on a hands-on coding task. Implement a custom prompt-routing function or tool-parsing parser in the sandbox below. Your code should cleanly parse an LLM output (e.g. JSON with a 'tool' and 'args' key) and route it to a mock executable function. Please explain your code and type it in the written sandbox.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: LLM Mechanics & Sandbox Execution",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "AI Tool Routing Sandbox",
              sourceUrl: "",
              originExplanation: "Hands-on coding test evaluating parser mechanics and model execution pipelines in a sandbox."
            },
            {
              text: `Write a clean Python or TypeScript class representing a sliding-window context manager or a basic cosine-similarity calculation for embedding vectors in the sandbox below.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: LLM Mechanics & Sandbox Execution",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "Embedding Math Sandbox",
              sourceUrl: "",
              originExplanation: "Tests mathematical/algorithmic coding for AI pipelines including embeddings."
            },
            {
              text: `Explain how you would optimize an LLM serving backend for low Time-to-First-Token (TTFT) and high token-per-second throughput. Compare the trade-offs of continuous batching, speculative decoding, and model quantization (e.g., FP8, INT4).`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: LLM Mechanics & Sandbox Execution",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "Serving Optimizations",
              sourceUrl: "",
              originExplanation: "Probes core systems knowledge of LLM runtime compilers and hardware acceleration."
            },
            {
              text: `How do you handle AI safety, content moderation, and prompt-injection defense in an application that allows arbitrary user input to guide your LLM agents? What specific guardrails (e.g., Llama Guard, NeMo Guardrails) or architectures would you put in place?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: AI Safety, Guardrails & Production Scaling",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "AI Safety & Guardrails",
              sourceUrl: "",
              originExplanation: "Evaluates modern guardrailing, vulnerability patching, and responsible AI system architecture."
            },
            {
              text: `Imagine a major LLM API service we rely on has a downtime incident or experiences a severe latency spike. How do you design your agentic backend to gracefully degrade, fall back to open-weights local models, or queue client requests?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: AI Safety, Guardrails & Production Scaling",
              agentName: "Senior AI Research Scientist",
              sourceType: "web_grounded_scraped",
              sourceName: "AI Fallback Orchestration",
              sourceUrl: "",
              originExplanation: "Tests operational engineering, fault-tolerance, and high-availability AI service architectures."
            }
          ];
        } else if (track === "behavioral") {
          fallbackAgentName = "Lead Talent Partner";
          prompt = `You are a team of elite behavioral and HR interview specialists called the "Lead Talent Partner" at ${company || "a top tech firm"}.
Your task is to:
1. Extract the candidate's name from the candidate's resume (if present).
2. Generate 10 RIGOROUS, highly realistic interview questions divided into 4 SEQUENTIAL INTERVIEW STAGES focusing on an HR / BEHAVIORAL INTERVIEW for a candidate applying for "${role}" at "${company || "the target company"}" with experience level: "${experienceLevel}".
The entire interview should evaluate behavioral scenarios (using STAR methodology: Situation, Task, Action, Result), team leadership, cross-functional collaboration, conflict resolution, project prioritization, coping under stress, motivation, and culture fit for "${role}" matching the target company "${company || "our company"}".

Candidate Resume (for context only):
${resumeText}

Search the web using Google Search tool for actual candidate-reported behavioral, HR, and culture-fit questions from Glassdoor or Indeed for ${company || "top tech firms"} interviews.

Generate exactly 10 questions structured into 4 stages:
1. STAGE 1 (Questions 1-2): "introduction" - Stage Name: "Stage 1: Personal Motivation & Mission Alignment", Agent Name: "Lead Talent Partner". CRITICAL MANDATE FOR QUESTION 1: Question 1 MUST open with a warm, articulate verbal greeting and introduction. Introduce this as the "HR & Behavioral" track and ask why they want to work at "${company || "our company"}", how their values align, and what they hope to accomplish in this role.
2. STAGE 2 (Questions 3-5): "resume_deep_dive" - Stage Name: "Stage 2: STAR Behavioral Scenarios", Agent Name: "Lead Talent Partner". Probing situational scenarios such as managing heavy workloads, meeting aggressive deadlines, or dealing with ambiguous requirements.
3. STAGE 3 (Questions 6-8): "core_technical_dsa" - Stage Name: "Stage 3: Team Collaboration & Conflict", Agent Name: "Lead Talent Partner". Focus on dealing with peer conflict, managing difficult stakeholders, or resolving technical disagreements. Even in the code sandbox, ask them to outline a timeline, leadership document, or priority matrix.
4. STAGE 4 (Questions 9-10): "company_cultural_fit" - Stage Name: "Stage 4: Leadership, Failure & Ownership", Agent Name: "Lead Talent Partner". Evaluate how they handle personal mistakes, take extreme ownership, receive feedback, or mentor others.

Return a JSON object with two fields:
- "candidateName": "Extracted candidate name (e.g. 'John Doe') or empty string if not found"
- "questions": A JSON array of 10 question objects matching the specified schema.

For each question, the schema is:
- "text": Question text (clearly stated).
- "stage": "introduction", "resume_deep_dive", "core_technical_dsa", or "company_cultural_fit".
- "stageName": Stage name as specified above.
- "agentName": "Lead Talent Partner".
- "sourceType": "web_grounded_scraped" or "ai_generated_resume_tailored".
- "sourceName": Source platform (e.g., "Glassdoor", "Indeed", "STAR Behavioral").
- "sourceUrl": Relevant URL if scraped, or empty string.
- "originExplanation": 1-sentence explanation of why this question was selected for this stage and experience level.

Return ONLY a JSON object matching this schema.`;

          fallbackQuestions = [
            {
              text: `Hello and welcome! I am your Lead Talent Partner today, and I'll be guiding you through a 10-question "HR & Behavioral" interview for the ${role} position at ${company || "our company"}. Let's begin with Stage 1: Personal Motivation & Mission Alignment. To start, why specifically do you want to join ${company || "our team"} at this point in your career, and how does your experience level of ${experienceLevel} qualify you for this path?`,
              stage: "introduction",
              stageName: "Stage 1: Personal Motivation & Mission Alignment",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Glassdoor Behavioral Reviews",
              sourceUrl: "",
              originExplanation: "Gathers motivation and fit for the company while introducing the behavioral track."
            },
            {
              text: `What are your top professional values, and can you share an example of how you applied them to a challenging project or decision in your career?`,
              stage: "introduction",
              stageName: "Stage 1: Personal Motivation & Mission Alignment",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Company Values Alignment",
              sourceUrl: "",
              originExplanation: "Examines core personal ethics and professional values alignment."
            },
            {
              text: `Describe a situation where a project deadline was at risk or resource constraints threatened delivery. What specific actions did you take using the STAR framework to get the project back on track?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: STAR Behavioral Scenarios",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "STAR Scenario Delivery",
              sourceUrl: "",
              originExplanation: "Classic behavioral question examining project management and delivery under stress."
            },
            {
              text: `Tell me about a time when you had to work with highly ambiguous or changing requirements. How did you define the scope of work and align stakeholders?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: STAR Behavioral Scenarios",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Ambiguity Resolution",
              sourceUrl: "",
              originExplanation: "Evaluates adaptability and logical planning in uncertain situations."
            },
            {
              text: `Can you share an experience where you had to prioritize multiple competing urgent tasks? How did you determine what to drop, delegate, or defer?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: STAR Behavioral Scenarios",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Time Management",
              sourceUrl: "",
              originExplanation: "Probes self-discipline, time allocation, and organizational skills."
            },
            {
              text: `Explain a situation where you had a significant professional or technical disagreement with a peer or teammate. How did you handle the conflict, communicate your perspective, and reach a consensus? Please write a brief outline of your conflict resolution steps in the sandbox.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Team Collaboration & Conflict",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Conflict Resolution",
              sourceUrl: "",
              originExplanation: "Assesses communication protocols, active listening, and teamwork during stress."
            },
            {
              text: `Describe a time when you had to influence or gain buy-in from a difficult client or non-technical stakeholder. What strategies did you use to communicate technical complexities simply?`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Team Collaboration & Conflict",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Stakeholder Influence",
              sourceUrl: "",
              originExplanation: "Tests empathy, active communication, and non-technical reporting skill."
            },
            {
              text: `Outline a hypothetical 30-60-90 day onboarding plan for yourself at ${company || "our company"}. What milestones would you define to ensure you are contributing effectively? Write down these milestones in the sandbox.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Team Collaboration & Conflict",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Onboarding Matrix",
              sourceUrl: "",
              originExplanation: "Tests proactivity, self-starting capabilities, and planned growth in a new role."
            },
            {
              text: `Describe your biggest professional or project failure. What did you learn, how did you handle the fallout, and what specific improvements did you implement in future work?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Leadership, Failure & Ownership",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Failure & Growth",
              sourceUrl: "",
              originExplanation: "Probes vulnerability, feedback reception, accountability, and continuous learning."
            },
            {
              text: `How do you handle giving constructive feedback to others, or how did you react when you received critical feedback you disagreed with?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Leadership, Failure & Ownership",
              agentName: "Lead Talent Partner",
              sourceType: "web_grounded_scraped",
              sourceName: "Feedback Delivery",
              sourceUrl: "",
              originExplanation: "Evaluates ego management, growth mindset, and interpersonal leadership skills."
            }
          ];
        } else {
          fallbackAgentName = "Senior AI Technical Interviewer";
          prompt = `You are a team of 4 elite technical interview agents at ${company || "a top tech firm"}.
Your task is to:
1. Extract the candidate's name from the candidate's resume (if present).
2. Generate 10 RIGOROUS, highly realistic interview questions divided into 4 SEQUENTIAL INTERVIEW STAGES for a candidate applying for "${role}" at "${company || "the target company"}" with experience level: "${experienceLevel}".

Candidate Resume:
${resumeText}

Search the web using Google Search tool for actual candidate-reported interview questions on Glassdoor, LeetCode, GeeksforGeeks, Indeed, or candidate forums for ${company || "top tech firms"} ${role} interviews.

Generate exactly 10 questions structured into 4 stages:
1. STAGE 1 (Questions 1-2): "introduction" - Stage Name: "Stage 1: Introduction & Background", Agent Name: "Senior AI Technical Interviewer". CRITICAL MANDATE FOR QUESTION 1: Question 1 MUST open with a warm, articulate verbal greeting and introduction from the interviewer. Address the candidate by their name if present in the resume (e.g. "Hello [Candidate Name] and welcome! I am your Senior AI Technical Interviewer today. I'll be guiding you through our 4-stage interview process for the ${role} position at ${company || "our company"}. Let's begin with Stage 1: Introduction & Background. To start, please tell me about yourself, your background, and what drives your interest in this position at the ${experienceLevel} level.").
2. STAGE 2 (Questions 3-5): "resume_deep_dive" - Stage Name: "Stage 2: Resume Deep Dive", Agent Name: "Senior AI Technical Interviewer". Probing specific projects, tools, metrics, and achievements from the candidate's resume.
3. STAGE 3 (Questions 6-8): "core_technical_dsa" - Stage Name: "Stage 3: Core Role, DSA & System Execution", Agent Name: "Senior AI Technical Interviewer". Focus on DSA algorithms, core domain architecture, and approach-based problem solving, asking the candidate to write code or a system design solution in the written sandbox block. MUST MIX RESUME-BASED AND PURE ROLE-BASED CONCEPTS: Generate at least one technical question that directly links to the candidate's specific technical skills/projects listed in their resume, AND at least one technical or DSA/programming question that is PURELY role-based and does not refer to their resume at all (assessing standard fundamental computer science or domain-specific concepts for "${role}" at the ${experienceLevel} level). Do not make all stage 3 questions refer to the resume.
4. STAGE 4 (Questions 9-10): "company_cultural_fit" - Stage Name: "Stage 4: Company Context & Cultural Fit", Agent Name: "Senior AI Technical Interviewer". Grounded web questions from Glassdoor/LeetCode specific to ${company || "the company"}, culture fit, and cross-functional leadership scenarios.

Return a JSON object with two fields:
- "candidateName": "Extracted candidate name (e.g. 'John Doe') or empty string if not found"
- "questions": A JSON array of 10 question objects matching the specified schema.

For each question, the schema is:
- "text": Question text (clearly stated).
- "stage": "introduction", "resume_deep_dive", "core_technical_dsa", or "company_cultural_fit".
- "stageName": Stage name as specified above.
- "agentName": "Senior AI Technical Interviewer".
- "sourceType": "web_grounded_scraped" or "ai_generated_resume_tailored".
- "sourceName": Source platform (e.g., "Glassdoor", "LeetCode Discuss", "GeeksforGeeks", "AI Resume Audit").
- "sourceUrl": Relevant URL if scraped, or empty string.
- "originExplanation": 1-sentence explanation of why this question was selected for this stage and experience level.

Return ONLY a JSON object matching this schema.`;

          fallbackQuestions = [
            // Stage 1
            {
              text: `Hello and welcome! I am your Senior AI Technical Interviewer today, and I'll be guiding you through our 4-stage evaluation for the ${role} position at ${company || "our company"}. Let's begin with Stage 1: Introduction & Background. To start off, please introduce yourself, walk me through your key experience, and share what drives your interest in this role at the ${experienceLevel} level.`,
              stage: "introduction",
              stageName: "Stage 1: Introduction & Background",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "Glassdoor Interview Reports",
              sourceUrl: "https://www.glassdoor.com",
              originExplanation: `Standard opening intro question reported across Glassdoor interviews for ${role}.`,
            },
            {
              text: `Where do you see your technical trajectory evolving over the next few years, and how does ${company || "this company"}'s mission fit your goals?`,
              stage: "introduction",
              stageName: "Stage 1: Introduction & Background",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Local Intelligence Engine",
              sourceUrl: "",
              originExplanation: `Assesses career vision and communication clarity for ${experienceLevel} candidate tier.`,
            },
            // Stage 2
            {
              text: `Walk me through the most technically complex project listed on your resume. What was your exact contribution, architecture choices, and key deliverables?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Resume Deep Dive",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Deep Dive Audit",
              sourceUrl: "",
              originExplanation: `Deep dive into verified project execution and technical ownership from your resume.`,
            },
            {
              text: `On your resume, you mention utilizing key frameworks and tools. What technical trade-offs or bottlenecks did you encounter while implementing them?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Resume Deep Dive",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Deep Dive Audit",
              sourceUrl: "",
              originExplanation: `Evaluates hands-on tool experience and decision-making on resume projects.`,
            },
            {
              text: `Can you share a specific quantitative metric or performance improvement result from your past work or academic projects?`,
              stage: "resume_deep_dive",
              stageName: "Stage 2: Resume Deep Dive",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "Indeed Interview Reports",
              sourceUrl: "https://www.indeed.com",
              originExplanation: `Verifies concrete impact metrics and data-driven achievements from candidate experience.`,
            },
            // Stage 3
            {
              text: `Let's work on a core DSA / Problem Solving scenario for ${role}. How would you design an efficient algorithm to process, sort, or filter large data streams in real time? Please explain your approach verbally and write your code or pseudo-code in the written sandbox below.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Core Role, DSA & System Execution",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "LeetCode Discuss Pattern",
              sourceUrl: "https://leetcode.com",
              originExplanation: `Core algorithm & DSA problem solving challenge tailored for ${role} (${experienceLevel}).`,
            },
            {
              text: `Looking at your resume background, let's explore a core engineering or system optimization scenario using your experience. How would you design a robust solution or optimize a bottleneck in a system that implements your preferred technologies? Please explain your architectural approach verbally and write out code or a schema structure in the sandbox below.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Core Role, DSA & System Execution",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "ai_generated_resume_tailored",
              sourceName: "Resume Tech Extension",
              sourceUrl: "",
              originExplanation: `Links the candidate's resume tools directly to a system bottlenecks and architecture scenario for ${role}.`,
            },
            {
              text: `Explain how you evaluate time and space complexity (Big-O) when designing system components, and how you prevent performance bottlenecks under high concurrency.`,
              stage: "core_technical_dsa",
              stageName: "Stage 3: Core Role, DSA & System Execution",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "LeetCode Architecture",
              sourceUrl: "https://leetcode.com",
              originExplanation: `Assesses foundational computer science principles and optimization logic for ${role}.`,
            },
            // Stage 4
            {
              text: `Why specifically do you want to work at ${company || "our company"} over other tech firms, and how do you handle technical disagreements within cross-functional teams?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Company Context & Cultural Fit",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "Glassdoor Behavioral Reviews",
              sourceUrl: "https://www.glassdoor.com",
              originExplanation: `Company alignment & conflict resolution question sourced from ${company || "tech firm"} candidate reviews.`,
            },
            {
              text: `Describe a situation where a project deadline was at risk or requirements changed unexpectedly. How did you prioritize tasks and ensure project delivery?`,
              stage: "company_cultural_fit",
              stageName: "Stage 4: Company Context & Cultural Fit",
              agentName: "Senior AI Technical Interviewer",
              sourceType: "web_grounded_scraped",
              sourceName: "AmbitionBox Culture Round",
              sourceUrl: "https://www.ambitionbox.com",
              originExplanation: `Behavioral adaptability question for ${role} candidates.`,
            },
          ];
        }

        if (ai) {
          try {
            console.log(`[Gemini Search Scraping] 4-Stage Question Generation for "${role}" @ "${company || 'Target Company'}" | Track: "${track}" | Experience Level: "${experienceLevel}"...`);

            const result = await generateWithFallback(ai, prompt, {
              temperature: 0.4,
              responseMimeType: "application/json",
              tools: [{ googleSearch: {} }],
            });

            if (result && result.response && result.response.text) {
              const text = result.response.text;
              console.log(`[Gemini Raw Response Received from ${result.modelUsed}] Length: ${text.length} chars`);

              let candidateName = "";
              let questionsArray: any[] = [];

              const rawParsed = parseJSON<any>(text);
              if (rawParsed) {
                if (Array.isArray(rawParsed)) {
                  questionsArray = rawParsed;
                } else if (typeof rawParsed === "object" && Array.isArray(rawParsed.questions)) {
                  questionsArray = rawParsed.questions;
                  candidateName = rawParsed.candidateName || "";
                }
              }

              if (questionsArray.length > 0) {
                if (!candidateName) {
                  candidateName = extractNameHeuristically(resumeText) || "";
                }
                const normalizedQuestions = questionsArray.map((q: any, idx: number) => {
                  let defaultStage = "introduction";
                  let defaultStageName = "Stage 1: Introduction & Background";
                  let defaultAgent = fallbackAgentName;

                  if (track === "resume") {
                    defaultStageName = "Stage 1: Resume Intro & Overview";
                    if (idx >= 2 && idx < 5) defaultStageName = "Stage 2: Tech Project Deep Dive";
                    else if (idx >= 5 && idx < 8) defaultStageName = "Stage 3: Resume Decisions & Trade-offs";
                    else if (idx >= 8) defaultStageName = "Stage 4: Resume-Tailored Teamwork";
                  } else if (track === "ai") {
                    defaultStageName = "Stage 1: AI Trends & Architectures";
                    if (idx >= 2 && idx < 5) defaultStageName = "Stage 2: Custom AI Project Deep Dive";
                    else if (idx >= 5 && idx < 8) defaultStageName = "Stage 3: LLM Mechanics & Sandbox";
                    else if (idx >= 8) defaultStageName = "Stage 4: AI Safety & Guardrails";
                  } else if (track === "technical") {
                    defaultStageName = "Stage 1: Technical Foundations";
                    if (idx >= 2 && idx < 5) defaultStageName = "Stage 2: Core Domain & Architecture";
                    else if (idx >= 5 && idx < 8) defaultStageName = "Stage 3: Algorithms & written code";
                    else if (idx >= 8) defaultStageName = "Stage 4: Production Bottlenecks";
                  } else if (track === "behavioral") {
                    defaultStageName = "Stage 1: Motivation & Alignment";
                    if (idx >= 2 && idx < 5) defaultStageName = "Stage 2: STAR Behavioral Scenarios";
                    else if (idx >= 5 && idx < 8) defaultStageName = "Stage 3: Team Collaboration";
                    else if (idx >= 8) defaultStageName = "Stage 4: Leadership & Failure";
                  }

                  if (idx >= 2 && idx < 5) {
                    defaultStage = "resume_deep_dive";
                  } else if (idx >= 5 && idx < 8) {
                    defaultStage = "core_technical_dsa";
                  } else if (idx >= 8) {
                    defaultStage = "company_cultural_fit";
                  }

                  if (typeof q === "string") {
                    return {
                      text: q,
                      stage: defaultStage,
                      stageName: defaultStageName,
                      agentName: defaultAgent,
                      sourceType: "web_grounded_scraped",
                      sourceName: `Glassdoor / LeetCode (${result.modelUsed})`,
                      sourceUrl: "https://www.glassdoor.com",
                      originExplanation: `Scraped and adapted for ${role} (${experienceLevel}) at ${company || "the target company"}.`,
                    };
                  }
                  return {
                    text: q.text || q.question || String(q),
                    stage: q.stage || defaultStage,
                    stageName: q.stageName || defaultStageName,
                    agentName: q.agentName || defaultAgent,
                    sourceType: q.sourceType || "web_grounded_scraped",
                    sourceName: q.sourceName || "Glassdoor / LeetCode",
                    sourceUrl: q.sourceUrl || "",
                    originExplanation: q.originExplanation || `Extracted for ${company || "the role"} stage ${idx + 1}.`,
                  };
                });

                console.log(`[Generated Questions Count]: ${normalizedQuestions.length} | Extracted Candidate Name: "${candidateName}"`);
                res.json({
                  candidateName,
                  questions: normalizedQuestions,
                  source: result.modelUsed,
                  isQuotaExceeded: false,
                });
                return;
              }
            }
          } catch (err) {
            console.warn("[Gemini Question Generation Error]:", err);
          }
        }

        console.log(`[Using 4-Stage Fallback Questions for Track "${track}" | Role: "${role}" (${experienceLevel}) @ ${company || "Target Company"}]`);
        const fallbackName = extractNameHeuristically(resumeText) || "";

        res.json({
          candidateName: fallbackName,
          questions: fallbackQuestions,
          source: "local_intelligence_fallback",
          isQuotaExceeded: true,
        });
        return;
      }

      if (action === "score-answer") {
        const { question, answer, writtenCode, role, company, experienceLevel = "Fresher / Entry Level (0 Years)", isFinalQuestion, isFollowUp, followUpCount = 0 } = req.body;

        if (!question || (!answer && !writtenCode) || !role) {
          res.status(400).json({ error: "Missing required fields: question, answer (or written code), role" });
          return;
        }

        const combinedAnswer = [
          answer ? `Spoken Transcript: "${answer}"` : null,
          writtenCode ? `Written Code / Solution Block:\n\`\`\`\n${writtenCode}\n\`\`\`` : null,
        ].filter(Boolean).join("\n\n");

        if (ai) {
          try {
            const currentTurnNum = typeof followUpCount === "number" ? followUpCount + (isFollowUp ? 1 : 0) : (isFollowUp ? 1 : 0);
            const track = (interviewTrack || "full").toLowerCase();

            let evaluatorPersona = "Senior Technical Hiring Manager";
            if (track === "resume") {
              evaluatorPersona = "Senior AI Resume Specialist";
            } else if (track === "ai") {
              evaluatorPersona = "Senior AI Research Scientist";
            } else if (track === "technical") {
              evaluatorPersona = "Lead Systems Architect & Core Evaluation Agent";
            } else if (track === "behavioral") {
              evaluatorPersona = "Lead Talent Partner & Behavioral Specialist";
            }

            const prompt = `You are a strict, top-tier Executive Interview Coach and ${evaluatorPersona} conducting a realistic, live oral interview for a ${role} position at ${company || "a leading company"} for a candidate at experience level: "${experienceLevel}".

Main Question Asked: "${question}"
Candidate's Latest Submitted Response:
${combinedAnswer}

Turn Context: ${currentTurnNum > 0 ? `This is candidate's response to follow-up probe #${currentTurnNum}.` : "This is candidate's initial response to the main question."}

CRITICAL LIVE INTERVIEW DYNAMICS:
1. NEVER reveal numerical scores, grades, or preach the ideal answer in "interviewerReply". Speak naturally as a human interviewer in a live call.
2. Carefully inspect if the candidate's latest response indicates they want to SKIP, PASS, MOVE ON, or give a NEGATIVE/DECLINING reply (e.g. "skip", "pass", "I don't know", "no idea", "can we move on?", "I can't elaborate", "next question", "don't know", "skip it", "no", "idk", "let's move on", "no comment", "I don't want to elaborate", etc.).
3. Determine if follow-up probing ("needsElaboration") is required:
   - IF the candidate gave a negative, declining, or skip response (or explicitly expressed desire to pass or move on):
     Set "needsElaboration": false.
     Set "interviewerReply": A realistic, polite acknowledgement accepting their decision (e.g. "Alright, no problem at all." or "Understood, let's move on.") + ${isFinalQuestion ? "conclude by saying: 'That concludes our interview session! Thank you for your time.'" : "transition: 'Let\\'s move on to the next question.'"}
   - IF the candidate's answer is brief, incomplete, vague, or missing expected technical depth/metrics/code for ${experienceLevel}, AND the candidate DID NOT ask to skip or give a negative/declining reply:
     Set "needsElaboration": true.
     Set "followUpQuestion": A realistic, direct, 1-sentence follow-up probing question building directly on what the candidate just said and asking for specific missing technical details, edge cases, or trade-offs (e.g. "Got it. Could you elaborate a bit more on how you handled edge cases or performance bottlenecks in that approach?").
     Set "interviewerReply": Exactly equal to "followUpQuestion".
   - IF the candidate's answer is complete, satisfactory, detailed, or strong:
     Set "needsElaboration": false.
     Set "interviewerReply": A concise, natural acknowledgement (e.g. "Okay, sounds good.", "Got it, thanks.", or "Understood.") + ${isFinalQuestion ? "conclude by saying: 'That concludes our interview session! Thank you for your time.'" : "transition: 'Let\\'s move on to the next question.'"}

4. POST-INTERVIEW REPORT EVALUATION (For full report page):
   - Evaluate each of the 4 dimensions INDEPENDENTLY on a 1-10 scale appropriate for ${experienceLevel}:
     RELEVANCE (1-10), CLARITY (1-10), DEPTH (1-10), CONFIDENCE (1-10).
   - Set "score" to exact average rounded to 1 decimal.
   - Set "feedback": 2-3 sentences of direct, honest feedback explaining strengths, weaknesses, and what the ideal answer should include.

Return ONLY a JSON object with this exact schema:
{
  "score": 0.0,
  "relevance": 0,
  "clarity": 0,
  "depth": 0,
  "confidence": 0,
  "feedback": "Thorough constructive feedback for the post-interview report...",
  "needsElaboration": false,
  "followUpQuestion": "Short probing question if needsElaboration is true, or empty string",
  "interviewerReply": "Spoken line by interviewer during the call"
}`;

            const result = await generateWithFallback(ai, prompt, {
              temperature: 0.1,
              responseMimeType: "application/json",
            });

            if (result && result.response && result.response.text) {
              const text = result.response.text;
              const scored = parseJSON<{
                score: number;
                relevance: number;
                clarity: number;
                depth: number;
                confidence: number;
                feedback: string;
                needsElaboration?: boolean;
                followUpQuestion?: string;
                interviewerReply?: string;
              }>(text);

              if (scored && typeof scored.score === "number") {
                res.json({
                  score: Math.round(scored.score * 10) / 10,
                  relevance: Math.round(scored.relevance),
                  clarity: Math.round(scored.clarity),
                  depth: Math.round(scored.depth),
                  confidence: Math.round(scored.confidence),
                  feedback: scored.feedback || "Good response! Continue expanding on concrete examples.",
                  needsElaboration: !!scored.needsElaboration,
                  followUpQuestion: scored.followUpQuestion || "",
                  interviewerReply: scored.interviewerReply || (isFinalQuestion ? "Thank you for walking through that. That concludes our interview session!" : "Okay, sounds good. Let's move on to the next question."),
                  source: result.modelUsed,
                  isQuotaExceeded: false,
                });
                return;
              }
            }
          } catch (err) {
            console.warn("Gemini scoring failed, using fallback scoring:", err);
          }
        }

        // Granular Local Intelligence Scoring Engine
        const trimmedSpoken = (answer || "").trim();
        const trimmedCode = (writtenCode || "").trim();
        const fullContent = `${trimmedSpoken}\n${trimmedCode}`.trim();
        const lowerAnswer = fullContent.toLowerCase();
        const wordCount = fullContent ? fullContent.split(/\s+/).length : 0;
        const isNegative = /(i don'?t know|no idea|pass|skip|i can'?t|can we move on|don'?t know|no clue|idk|next question|move on|stop asking|no thanks|skip it|skip follow-up|let'?s move on|no comment)/i.test(lowerAnswer);

        let relevance = 1;
        let clarity = 1;
        let depth = 1;
        let confidence = 1;
        let feedback = "";

        if (wordCount === 0 || fullContent.length < 3) {
          relevance = 0; clarity = 0; depth = 0; confidence = 0;
          feedback = "Your response is empty or too short. Please provide a substantive spoken response or written solution.";
        } else if (wordCount < 6 && !trimmedCode) {
          relevance = 2; clarity = 3; depth = 1; confidence = 2;
          feedback = "Your answer is extremely brief. Try expanding using the STAR method or providing code details.";
        } else {
          // 1. RELEVANCE
          const qWords = (question || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
          const matchedQWords = qWords.filter((w: string) => lowerAnswer.includes(w)).length;
          const qRatio = qWords.length > 0 ? matchedQWords / qWords.length : 0.5;
          relevance = Math.min(10, Math.max(3, Math.round(5 + qRatio * 4 + (wordCount > 30 ? 1 : 0))));

          // 2. CLARITY
          const sentences = fullContent.split(/[.!?\n]+/).filter(s => s.trim().length > 0);
          const transitionWords = ["first", "then", "because", "result", "finally", "therefore", "led to", "however", "so", "as a result", "function", "return", "const", "class"];
          const hasTransitions = transitionWords.some(t => lowerAnswer.includes(t));
          clarity = Math.min(10, Math.max(3, Math.round(4 + (sentences.length >= 2 ? 3 : 1) + (hasTransitions ? 2 : 0) + (trimmedCode ? 1 : 0))));

          // 3. DEPTH
          const numberMatches = (fullContent.match(/\b\d+(?:\.\d+)?%?\b/g) || []).length;
          const techKeywords = ["api", "system", "data", "team", "scale", "code", "architecture", "design", "model", "sql", "react", "python", "aws", "cloud", "metrics", "pipeline", "performance", "client", "project", "framework", "process", "budget", "revenue", "loop", "array", "def", "class", "async"];
          const techMatchCount = techKeywords.filter(k => lowerAnswer.includes(k)).length;
          depth = Math.min(10, Math.max(2, Math.round(3 + (numberMatches > 0 ? 2 : 0) + (trimmedCode ? 3 : 0) + Math.min(3, techMatchCount))));

          // 4. CONFIDENCE
          const actionVerbs = ["led", "engineered", "built", "spearheaded", "solved", "designed", "achieved", "delivered", "optimized", "managed", "implemented", "created", "reduced", "increased", "drove", "architected"];
          const hesitationWords = ["maybe", "kind of", "i guess", "probably", "not sure", "think so", "sort of", "um", "uh"];
          const actionCount = actionVerbs.filter(v => lowerAnswer.includes(v)).length;
          const hesitationCount = hesitationWords.filter(h => lowerAnswer.includes(h)).length;
          confidence = Math.min(10, Math.max(2, Math.round(5 + Math.min(4, actionCount * 1.5) - (hesitationCount * 2) + (trimmedCode ? 1 : 0))));

          if (depth < 5) {
            feedback = "Good start! To increase your Depth score, add specific metrics, technical framework names, or code snippets.";
          } else if (confidence < 6) {
            feedback = "Solid answer! Boost your Confidence score by using strong action verbs and eliminating filler phrases.";
          } else if (clarity < 6) {
            feedback = "Your answer has good context. Improve Clarity by explicitly structuring your story or code comments.";
          } else {
            feedback = "Excellent response! Well-structured with strong technical context, clear achievements, and confident delivery.";
          }
        }

        const avgScore = Math.round(((relevance + clarity + depth + confidence) / 4) * 10) / 10;

        let needsElaboration = false;
        let followUpQuestion = "";
        let interviewerReply = "";

        if (isNegative) {
          needsElaboration = false;
          interviewerReply = isFinalQuestion
            ? "Alright, no problem at all! That concludes our interview session today. Thank you for your time!"
            : "Alright, no problem. Let's move on to the next question.";
        } else if (wordCount < 16 && !trimmedCode) {
          needsElaboration = true;
          const turn = typeof followUpCount === "number" ? followUpCount + 1 : 1;
          if (turn >= 2) {
            followUpQuestion = "Got it. Could you speak to the specific technical trade-offs, metrics, or edge cases involved in that approach?";
          } else {
            followUpQuestion = "Got it. Could you elaborate a bit more on your technical approach or specific tools and metrics you used?";
          }
          interviewerReply = followUpQuestion;
        } else {
          needsElaboration = false;
          interviewerReply = isFinalQuestion
            ? "Okay, sounds good! That concludes our interview session today. Thank you for your time!"
            : "Okay, sounds good. Let's move on to the next question.";
        }

        res.json({
          score: avgScore,
          relevance,
          clarity,
          depth,
          confidence,
          feedback,
          needsElaboration,
          followUpQuestion,
          interviewerReply,
          source: "local_intelligence_engine",
          isQuotaExceeded: true,
        });
        return;
      }

      if (action === "summarize-interview") {
        const { sessionQuestions, role: targetRole, company: targetCompany } = req.body || {};
        const qList = Array.isArray(sessionQuestions) ? sessionQuestions : [];

        if (ai) {
          try {
            const formattedQA = qList
              .map(
                (q: any, idx: number) =>
                  `Question ${idx + 1}: ${q.text}\nCandidate Answer: ${q.answerTranscript || "No response provided"}\nScore: ${
                    q.score ?? "N/A"
                  }/10\nFeedback: ${q.feedback || "N/A"}`
              )
              .join("\n\n");

            const prompt = `You are an executive interview coach synthesizing a comprehensive, holistic evaluation for a candidate interviewing for the role of ${
              targetRole || "Candidate"
            } at ${targetCompany || "Target Company"}.

Review all questions asked, candidate answers, scores, and per-question feedback from the session below:

${formattedQA}

CRITICAL REQUIREMENT:
Do NOT simply list or concatenate the individual question feedback sentences. Instead, analyze the OVERALL performance holistically across all questions to synthesize:
1. "summary": A 2-3 sentence overarching executive summary evaluating overall readiness, strengths, and delivery.
2. "mistakes": A list of 2 to 4 distinct, specific mistakes or recurring weaknesses observed during the interview (e.g. lack of quantifiable metrics, missing STAR results, vague technical details, hesitation words, or brief answers).
3. "improvements": A list of 2 to 4 actionable, encouraging recommendations to improve performance for future interviews.

Return ONLY a JSON object matching this exact schema:
{
  "summary": "2-3 sentence executive evaluation...",
  "mistakes": [
    "Mistake/Weakness 1",
    "Mistake/Weakness 2"
  ],
  "improvements": [
    "Suggested Improvement 1",
    "Suggested Improvement 2"
  ]
}`;

            const result = await generateWithFallback(ai, prompt, {
              temperature: 0.2,
              responseMimeType: "application/json",
            });

            if (result && result.response && result.response.text) {
              const text = result.response.text;
              const parsed = parseJSON<{
                summary: string;
                mistakes: string[];
                improvements: string[];
              }>(text);

              if (
                parsed &&
                parsed.summary &&
                Array.isArray(parsed.mistakes) &&
                Array.isArray(parsed.improvements)
              ) {
                res.json({
                  summary: parsed.summary,
                  mistakes: parsed.mistakes,
                  improvements: parsed.improvements,
                  source: result.modelUsed,
                  isQuotaExceeded: false,
                });
                return;
              }
            }
          } catch (err) {
            console.warn("Gemini summarize-interview failed, using local fallback analysis:", err);
          }
        }

        // Local Fallback Synthesis
        const mistakes: string[] = [];
        const improvements: string[] = [];

        let shortCount = 0;
        let metricCount = 0;
        let starCount = 0;
        let hesitationCount = 0;

        qList.forEach((q: any) => {
          const ans = (q.answerTranscript || "").toLowerCase();
          const words = ans.split(/\s+/).filter(Boolean);
          if (words.length < 20) shortCount++;
          if (/\b\d+(?:\.\d+)?%?\b/.test(ans)) metricCount++;
          if (
            ["situation", "task", "action", "result", "led", "built", "engineered"].some((w) =>
              ans.includes(w)
            )
          )
            starCount++;
          if (
            ["maybe", "kind of", "i guess", "probably", "not sure", "um", "uh"].some((w) =>
              ans.includes(w)
            )
          )
            hesitationCount++;
        });

        if (shortCount > 0) {
          mistakes.push(`Brief Responses: ${shortCount} answer(s) lacked elaboration and depth.`);
          improvements.push(
            "Expand your answers using the STAR method (Situation, Task, Action, Result) to provide full context."
          );
        }
        if (metricCount < Math.ceil(qList.length / 2)) {
          mistakes.push(
            "Missing Metrics: Responses relied heavily on qualitative claims without concrete numbers, percentages, or scale."
          );
          improvements.push(
            "Quantify your impact by including specific metrics (e.g., 'reduced latency by 35%', 'managed 5 engineers')."
          );
        }
        if (hesitationCount > 0) {
          mistakes.push(
            "Filler Words & Hesitation: Used tentative phrases ('i guess', 'maybe', 'not sure') which weakened delivery confidence."
          );
          improvements.push(
            "Use strong action verbs ('spearheaded', 'engineered', 'delivered') to project executive conviction."
          );
        }
        if (starCount < qList.length) {
          improvements.push(
            "Structure every technical and behavioral story clearly around the core Action you took and the measurable Result achieved."
          );
        }

        if (mistakes.length === 0) {
          mistakes.push(
            "Minor Gaps: Some technical explanations could dive deeper into system trade-offs and alternative approaches considered."
          );
        }
        if (improvements.length === 0) {
          improvements.push(
            "Keep practicing with company-specific interview questions to maintain quick articulation and confidence."
          );
        }

        res.json({
          summary: `Holistic performance review completed for ${
            targetRole || "the candidate"
          } at ${
            targetCompany || "the company"
          }. The evaluation identifies key operational mistakes and actionable recommendations to optimize future interview performance.`,
          mistakes,
          improvements,
          source: "local_intelligence_engine",
          isQuotaExceeded: true,
        });
        return;
      }

      if (action === "score-resume") {
        if (!resumeText || !role) {
          res.status(400).json({ error: "Missing required fields: resumeText, role" });
          return;
        }

        if (ai) {
          try {
            const prompt = `You are a senior executive recruiter and ATS resume optimization strategist evaluating a candidate's resume for a specific target company and role.

Target Role: ${role}
Target Company: ${company || "Target Company"}
Candidate Resume:
${resumeText}

Analyze how well this candidate's background, skills, and experience align with the target role at this company.
Calculate an overall match score from 0 to 100 based on skill relevance, experience depth, company culture/industry fit, and keyword coverage.

Return ONLY a JSON object matching this exact schema:
{
  "overallScore": 85,
  "matchLevel": "Strong Match",
  "summary": "2-3 sentences summarizing key strengths and fit for ${role} at ${company || "the company"}.",
  "strengths": [
    "3 specific matching skills/experiences found in the resume relevant to ${role}"
  ],
  "gaps": [
    "2-3 missing or undersimplified skills/tools typically expected for ${role} at ${company || "this company"}"
  ],
  "recommendations": [
    "2-3 actionable tips to improve ATS keyword match and tailor the resume for ${company || "this role"}"
  ]
}`;

            const result = await generateWithFallback(ai, prompt, {
              temperature: 0.2,
              responseMimeType: "application/json",
            });

            if (result && result.response && result.response.text) {
              const text = result.response.text;
              const scored = parseJSON<{
                overallScore: number;
                matchLevel: string;
                summary: string;
                strengths: string[];
                gaps: string[];
                recommendations: string[];
              }>(text);

              if (scored && typeof scored.overallScore === "number") {
                res.json({
                  overallScore: Math.min(100, Math.max(0, Math.round(scored.overallScore))),
                  matchLevel: scored.matchLevel || "Good Match",
                  summary: scored.summary || `Resume evaluated for ${role} at ${company || "the company"}.`,
                  strengths: Array.isArray(scored.strengths) ? scored.strengths : [],
                  gaps: Array.isArray(scored.gaps) ? scored.gaps : [],
                  recommendations: Array.isArray(scored.recommendations) ? scored.recommendations : [],
                  source: result.modelUsed,
                  isQuotaExceeded: false,
                });
                return;
              }
            }
          } catch (err) {
            console.warn("Gemini resume scoring failed, using fallback logic:", err);
          }
        }

        // Smart fallback logic
        const lowerResume = (resumeText || "").toLowerCase();
        const lowerRole = (role || "").toLowerCase();
        const roleWords = lowerRole.split(/\s+/).filter((w: string) => w.length > 2);

        let matches = 0;
        roleWords.forEach((word: string) => {
          if (lowerResume.includes(word)) matches++;
        });

        const wordCount = lowerResume.split(/\s+/).length;
        let baseScore = 65;
        if (wordCount > 150) baseScore += 10;
        if (roleWords.length > 0) {
          baseScore += Math.round((matches / roleWords.length) * 15);
        }

        const overallScore = Math.min(95, Math.max(45, baseScore));
        let matchLevel = "Moderate Match";
        if (overallScore >= 85) matchLevel = "Strong Match";
        else if (overallScore >= 75) matchLevel = "Good Match";
        else if (overallScore < 60) matchLevel = "Needs Optimization";

        res.json({
          overallScore,
          matchLevel,
          summary: `Your resume demonstrates relevant experience for the ${role} position at ${company || "the company"}. With targeted keyword tuning, your profile can achieve an even higher ATS score.`,
          strengths: [
            `Demonstrates background aligned with core ${role} responsibilities`,
            `Solid formatting and experience history provided`,
            `Clear work experience timeline presented`
          ],
          gaps: [
            `Incorporate more specific quantifiable metrics (e.g. %, $, project scope)`,
            `Highlight specific toolsets and methodologies favored by ${company || "top employers"}`
          ],
          recommendations: [
            `Tailor your top skills section to echo keywords directly from the ${role} job description`,
            `Use action verbs (e.g. Led, Designed, Accelerated) at the start of every bullet point`
          ],
          source: "local_intelligence_fallback",
          isQuotaExceeded: true,
        });
        return;
      }

      res.status(400).json({ error: "Unknown action. Use 'generate-questions', 'score-answer', or 'score-resume'." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });

  // /api/scrape-questions
  app.post("/api/scrape-questions", async (req, res) => {
    try {
      const { role, company } = req.body || {};
      console.log(`[API REQUEST LOG] /api/scrape-questions | Role: "${role}", Company: "${company || 'N/A'}"`);
      
      const fallbackQuestions = [
        `Tell me about yourself and your background for the ${role} role.`,
        `Why do you want to work at ${company || "our company"}?`,
        `Describe a challenging project you've worked on recently.`,
        "How do you handle tight deadlines and high-pressure situations?",
        `What relevant technical and soft skills do you bring to the ${role} position?`,
      ];

      res.json({ questions: fallbackQuestions });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to scrape questions";
      console.error(`[API ERROR LOG] /api/scrape-questions:`, message);
      res.status(500).json({ error: message });
    }
  });

  // /api/speechmatics-token
  app.post("/api/speechmatics-token", async (_req, res) => {
    try {
      console.log(`\n==================================================`);
      console.log(`[API REQUEST LOG] /api/speechmatics-token - Speechmatics Temporary RT Token requested`);
      console.log(`==================================================`);

      const apiKey = process.env.SPEECHMATICS_API_KEY;
      if (!apiKey) {
        console.warn(`[Speechmatics API Log] WARNING: SPEECHMATICS_API_KEY environment variable is NOT set in .env!`);
        res.status(530).json({
          error: "SPEECHMATICS_API_KEY environment variable is missing. Please add SPEECHMATICS_API_KEY to your .env file.",
        });
        return;
      }

      console.log(`[Speechmatics API Log] Requesting temporary RT token from Speechmatics API (ttl: 60s)...`);
      const smRes = await fetch("https://mp.speechmatics.com/v1/api_keys?type=rt", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 60 }),
      });

      if (!smRes.ok) {
        const text = await smRes.text();
        console.error(`[Speechmatics API Log] ERROR ${smRes.status} from Speechmatics:`, text);
        res.status(500).json({ error: `Speechmatics API error ${smRes.status}: ${text}` });
        return;
      }

      const data = await smRes.json();
      const token = data.key_value || data.key || data.token || data.jwt || data.api_key || data.apiKey;

      if (!token) {
        console.error(`[Speechmatics API Log] ERROR: No token field returned in response:`, data);
        res.status(500).json({ error: "No token returned from Speechmatics" });
        return;
      }

      console.log(`[Speechmatics API Log] SUCCESS: Temporary JWT Token generated for Speechmatics WebSocket connection.`);
      res.json({
        token,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get Speechmatics token";
      console.error(`[Speechmatics API Log] EXCEPTION:`, message);
      res.status(500).json({ error: message });
    }
  });

  // /api/tts endpoint for Speechmatics low-latency natural Text-To-Speech
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice = "jack" } = req.body || {};
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required" });
        return;
      }

      const apiKey = process.env.SPEECHMATICS_API_KEY;
      if (!apiKey) {
        console.warn("[Speechmatics TTS] SPEECHMATICS_API_KEY is not configured.");
        res.status(503).json({ error: "Speechmatics API key not configured" });
        return;
      }

      // Fixed natural single male voice: "jack" (or "theo")
      const voiceId = voice === "theo" ? "theo" : "jack";
      console.log(`[Speechmatics TTS Request] Speechmatics voice '${voiceId}' | Text length: ${text.length} chars`);

      const ttsResponse = await fetch(`https://preview.tts.speechmatics.com/generate/${voiceId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.substring(0, 1000) }),
      });

      if (!ttsResponse.ok) {
        const errText = await ttsResponse.text().catch(() => "");
        console.warn(`[Speechmatics TTS Warning] HTTP ${ttsResponse.status}: ${errText}`);
        res.status(ttsResponse.status).json({ error: `Speechmatics TTS service returned ${ttsResponse.status}` });
        return;
      }

      const arrayBuffer = await ttsResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = buffer.toString("base64");
      const mimeType = ttsResponse.headers.get("content-type") || "audio/wav";

      console.log(`[Speechmatics TTS Success] Low-latency male audio generated (${buffer.length} bytes)`);
      res.json({
        audio: base64Audio,
        mimeType,
        voiceUsed: voiceId,
      });
    } catch (err: any) {
      console.error("[Speechmatics TTS Exception]:", err);
      res.status(500).json({ error: "Failed to process Speechmatics TTS request" });
    }
  });

  return app;
}

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
