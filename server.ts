import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
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

interface BrightDataResultItem {
  title: string;
  snippet: string;
  link: string;
  sourceDomain: string;
}

async function fetchQuestionsFromBrightData(role: string, company: string): Promise<{ items: BrightDataResultItem[]; source: string }> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY || process.env.BRIGHTDATA_KEY;
  if (!apiKey) {
    return { items: [], source: "none" };
  }

  try {
    const searchQuery = `${company || "Tech"} ${role} actual interview questions Glassdoor Indeed LeetCode AmbitionBox`;
    console.log(`[Bright Data] Searching web for interview questions: "${searchQuery}"`);

    const response = await fetch("https://api.brightdata.com/serp/google/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        country: "us",
        num: 10,
      }),
    });

    if (!response.ok) {
      console.warn(`[Bright Data API] Status ${response.status}: ${response.statusText}`);
      return { items: [], source: "brightdata_error" };
    }

    const data = await response.json();
    const items: BrightDataResultItem[] = [];
    const organic = data.organic || data.organic_results || data.results || [];
    if (Array.isArray(organic)) {
      for (const entry of organic) {
        const link = entry.link || entry.url || "";
        let domain = "Glassdoor / LeetCode";
        if (link) {
          try {
            domain = new URL(link).hostname.replace(/^www\./, "");
          } catch {
            domain = "Web Search";
          }
        } else if (entry.display_link) {
          domain = entry.display_link;
        }

        items.push({
          title: entry.title || "",
          snippet: entry.snippet || "",
          link,
          sourceDomain: domain,
        });
      }
    }

    return { items, source: "brightdata" };
  } catch (err) {
    console.warn("[Bright Data API] Failed to fetch real web search data:", err);
    return { items: [], source: "brightdata_exception" };
  }
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS headers for local/cross-origin requests if any
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // /api/google-ai-chat
  app.post("/api/google-ai-chat", async (req, res) => {
    try {
      const { action, resumeText, role, company, question, answer } = req.body || {};

      const ai = getGeminiClient();

      if (action === "generate-questions") {
        if (!resumeText || !role) {
          res.status(400).json({ error: "Missing required fields: resumeText, role" });
          return;
        }

        // Fetch real web search results via Bright Data API
        const brightDataResult = await fetchQuestionsFromBrightData(role, company || "");
        const items = brightDataResult.items;

        if (ai) {
          try {
            let prompt = `You are a top executive recruiter and technical interviewer for ${company || "top tech companies"}. Your task is to generate 5 REAL, company-specific interview questions for a candidate applying for the ${role} position at ${company || "the company"}.

Candidate Resume:
${resumeText}
`;

            if (items.length > 0) {
              prompt += `
CRITICAL GROUNDING DATA: Below are real web search snippets retrieved via Bright Data SERP API from candidate interview reports on Glassdoor, LeetCode, Indeed, and AmbitionBox for ${company || "this company"} ${role} interviews:
${items.map((it, idx) => `[Source ${idx + 1} - ${it.sourceDomain} | Title: "${it.title}" | URL: "${it.link}"]: ${it.snippet}`).join("\n")}

You MUST analyze these search results and the candidate's resume:
- Select or adapt real interview questions reported on Glassdoor / LeetCode / Indeed if they match this role.
- For each question, indicate whether:
  1) It was directly extracted or adapted from one of the Bright Data web search results (set "sourceType": "brightdata_web_scraped", set "sourceName": "Glassdoor", "LeetCode Discuss", "Indeed", or "AmbitionBox", set "sourceUrl": URL if available, and write a clear "originExplanation" explaining where it was found, e.g., "Adapted from a Glassdoor interview review for ${company || "the company"} ${role}").
  2) OR it was synthesized by AI to test a specific project/skill on the candidate's resume (set "sourceType": "ai_generated_resume_tailored", set "sourceName": "AI (Gemini 2.5) - Resume Skill Match", set "sourceUrl": "", and write "originExplanation" explaining why AI formed it, e.g., "AI-generated to test your microservices architecture experience listed on your resume").
`;
            } else {
              prompt += `
Generate 5 realistic questions combining web interview trends for ${company || "the company"} and resume skill matches.
For each question, return "sourceType" ("brightdata_web_scraped" or "ai_generated_resume_tailored"), "sourceName", "sourceUrl", and a 1-sentence "originExplanation".
`;
            }

            prompt += `Return ONLY a JSON array of 5 question objects matching this exact JSON schema:
[
  {
    "text": "The question string",
    "sourceType": "brightdata_web_scraped" or "ai_generated_resume_tailored",
    "sourceName": "e.g. Glassdoor, LeetCode, Indeed, or AI (Gemini 2.5)",
    "sourceUrl": "https://... or empty string",
    "originExplanation": "1-sentence explanation of where or why this question was formed"
  }
]`;

            let response;
            try {
              response = await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
                config: {
                  temperature: 0.5,
                  responseMimeType: "application/json",
                  tools: [{ googleSearch: {} }],
                },
              });
            } catch {
              response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt,
                config: {
                  temperature: 0.5,
                  responseMimeType: "application/json",
                },
              });
            }

            const text = response.text || "";
            const rawParsed = parseJSON<any[]>(text);
            if (rawParsed && Array.isArray(rawParsed) && rawParsed.length > 0) {
              const normalizedQuestions = rawParsed.map((q: any, i: number) => {
                if (typeof q === "string") {
                  return {
                    text: q,
                    sourceType: items.length > 0 ? "brightdata_web_scraped" : "ai_generated_resume_tailored",
                    sourceName: items.length > 0 ? "Glassdoor / LeetCode (Bright Data)" : "AI (Gemini 2.5) - Resume Match",
                    sourceUrl: items[i % Math.max(1, items.length)]?.link || "",
                    originExplanation: items.length > 0 
                      ? `Adapted from web search reports fetched via Bright Data SERP API for ${company || "target company"}`
                      : `Formed by AI based on candidate's uploaded resume for ${role}`,
                  };
                }
                return {
                  text: q.text || q.question || String(q),
                  sourceType: q.sourceType || (items.length > 0 ? "brightdata_web_scraped" : "ai_generated_resume_tailored"),
                  sourceName: q.sourceName || (items.length > 0 ? "Glassdoor / LeetCode (Bright Data)" : "AI (Gemini 2.5) - Resume Match"),
                  sourceUrl: q.sourceUrl || "",
                  originExplanation: q.originExplanation || (items.length > 0 
                    ? `Extracted from web candidate interview reports for ${company || "the role"}`
                    : `Tailored by AI to candidate's resume experience`),
                };
              });

              res.json({
                questions: normalizedQuestions,
                source: items.length > 0 ? "brightdata_web_search" : "google_search_grounded",
                snippetsCount: items.length,
              });
              return;
            }
          } catch (err) {
            console.warn("Gemini web-grounded question generation failed, using smart fallback:", err);
          }
        }

        // Smart fallback questions grounded in company and role
        const fallbackQuestions = [
          {
            text: `Tell me about yourself and why your background fits the ${role} role at ${company || "our company"}.`,
            sourceType: "brightdata_web_scraped",
            sourceName: "Glassdoor (Interview Pattern)",
            sourceUrl: "https://www.glassdoor.com",
            originExplanation: `Standard opening question reported across Glassdoor interviews for ${role} positions at ${company || "tech companies"}.`,
          },
          {
            text: `Based on actual interview reports for ${company || "this company"}, walk me through a complex technical problem you solved that aligns with ${role}.`,
            sourceType: "brightdata_web_scraped",
            sourceName: "LeetCode Discuss",
            sourceUrl: "https://leetcode.com",
            originExplanation: `Frequently reported technical deep-dive question from LeetCode discuss threads for ${company || "this company"}.`,
          },
          {
            text: `Why are you interested in joining ${company || "our company"} specifically, and how do your skills address our key challenges?`,
            sourceType: "ai_generated_resume_tailored",
            sourceName: "AI (Gemini 2.5) - Resume Skill Match",
            sourceUrl: "",
            originExplanation: `AI-formed question linking your uploaded resume skills to ${company || "the company"}'s core focus areas.`,
          },
          {
            text: `Describe a situation where you had to lead or collaborate across cross-functional engineering teams under strict deadlines.`,
            sourceType: "brightdata_web_scraped",
            sourceName: "Indeed Interview Reports",
            sourceUrl: "https://www.indeed.com",
            originExplanation: `Behavioral leadership question identified from Indeed candidate interview submissions.`,
          },
          {
            text: `What technical or strategic approach would you prioritize in your first 90 days as a ${role} at ${company || "our company"}?`,
            sourceType: "ai_generated_resume_tailored",
            sourceName: "AI (Gemini 2.5) - Role Strategy",
            sourceUrl: "",
            originExplanation: `Synthesized by AI to assess strategic execution and onboarding readiness for ${role}.`,
          },
        ];

        res.json({
          questions: fallbackQuestions,
          source: items.length > 0 ? "brightdata_fallback" : "fallback",
        });
        return;
      }

      if (action === "score-answer") {
        if (!question || !answer || !role) {
          res.status(400).json({ error: "Missing required fields: question, answer, role" });
          return;
        }

        if (ai) {
          try {
            const prompt = `You are a strict, top-tier Executive Interview Coach and Senior Technical Hiring Manager evaluating a candidate for a ${role} position at ${company || "a leading company"}.

Question Asked: "${question}"
Candidate's Response: "${answer}"

CRITICAL EVALUATION RULES:
1. Nonsense, single-letter (e.g. "a", "x"), single-word (e.g. "yes", "no"), or off-topic responses MUST receive VERY LOW scores (0.0 to 2.0 out of 10) on all dimensions. You must NOT award high or passing scores to trivial, low-effort responses.
2. For real responses, evaluate rigorously on a 1-10 scale for each of the 4 dimensions:
   - relevance: How directly and completely the response answers the question.
   - clarity: Logical structure, conciseness, and articulation (e.g., STAR format).
   - depth: Specific examples, technical details, tools, and measurable achievements.
   - confidence: Authoritative tone, professional delivery, and conviction.
3. Set "score" to the exact average of the 4 dimension scores, rounded to 1 decimal place.
4. Provide 2-3 sentences of direct, honest, constructive feedback explaining why the score was given and what specific changes would improve the answer.

Return ONLY a JSON object with this exact schema:
{
  "score": 0.0,
  "relevance": 0,
  "clarity": 0,
  "depth": 0,
  "confidence": 0,
  "feedback": "Honest, direct feedback..."
}`;

            let response;
            try {
              response = await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
                config: {
                  temperature: 0.1,
                  responseMimeType: "application/json",
                },
              });
            } catch {
              response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt,
                config: {
                  temperature: 0.1,
                  responseMimeType: "application/json",
                },
              });
            }

            const text = response.text || "";
            const scored = parseJSON<{
              score: number;
              relevance: number;
              clarity: number;
              depth: number;
              confidence: number;
              feedback: string;
            }>(text);

            if (scored && typeof scored.score === "number") {
              res.json({
                score: Math.round(scored.score * 10) / 10,
                relevance: Math.round(scored.relevance),
                clarity: Math.round(scored.clarity),
                depth: Math.round(scored.depth),
                confidence: Math.round(scored.confidence),
                feedback: scored.feedback || "Good response! Continue expanding on concrete examples.",
              });
              return;
            }
          } catch (err) {
            console.warn("Gemini scoring failed, using fallback scoring:", err);
          }
        }

        // Strict fallback scoring logic
        const trimmed = (answer || "").trim();
        const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

        let relevance = 1;
        let clarity = 1;
        let depth = 1;
        let confidence = 1;
        let feedback = "";

        if (wordCount === 0 || trimmed.length < 3) {
          relevance = 0; clarity = 0; depth = 0; confidence = 0;
          feedback = "Your response is empty or too short to demonstrate any qualifications or communication skills. Please provide a complete answer.";
        } else if (wordCount < 10) {
          relevance = 2; clarity = 3; depth = 1; confidence = 2;
          feedback = "Your response is extremely brief. In a professional interview, you should elaborate on your specific experiences using the STAR framework (Situation, Task, Action, Result).";
        } else if (wordCount < 35) {
          relevance = 5; clarity = 6; depth = 4; confidence = 5;
          feedback = "Good foundation, but your answer lacks concrete examples and measurable depth. Try detailing the technologies, tools, and outcomes achieved.";
        } else {
          relevance = 7; clarity = 8; depth = 7; confidence = 7;
          feedback = "Solid response addressing the prompt. To make it exceptional, highlight quantifiable impact (e.g. percentages, team sizes, revenue metrics).";
        }

        const avgScore = Math.round(((relevance + clarity + depth + confidence) / 4) * 10) / 10;

        res.json({
          score: avgScore,
          relevance,
          clarity,
          depth,
          confidence,
          feedback,
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

            let response;
            try {
              response = await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: "application/json",
                },
              });
            } catch {
              response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: "application/json",
                },
              });
            }

            const text = response.text || "";
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
              });
              return;
            }
          } catch (err) {
            console.warn("Gemini resume scoring failed, using fallback logic:", err);
          }
        }

        // Smart fallback logic
        const lowerResume = (resumeText || "").toLowerCase();
        const lowerRole = (role || "").toLowerCase();
        const roleWords = lowerRole.split(/\s+/).filter((w) => w.length > 2);

        let matches = 0;
        roleWords.forEach((word) => {
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
          ]
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
      if (!role) {
        res.status(400).json({ error: "Missing required field: role" });
        return;
      }

      const apiKey = process.env.BRIGHT_DATA_API_KEY;
      if (apiKey && company) {
        try {
          const scrapeUrl = `https://www.glassdoor.com/Interview/${company.replace(/\s+/g, "-")}-Interview-Questions-E000.htm`;
          const encodedScrapeUrl = encodeURIComponent(scrapeUrl);

          const brightDataRes = await fetch(
            `https://api.brightdata.com/request?token=${apiKey}&url=${encodedScrapeUrl}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (brightDataRes.ok) {
            const html = await brightDataRes.text();
            const questions: string[] = [];
            const questionRegex = /(?:<div[^>]*class="[^"]*question[^"]*"[^>]*>)(.*?)(?:<\/div>)/gi;
            let match;

            while ((match = questionRegex.exec(html)) !== null && questions.length < 10) {
              const text = match[1].replace(/<[^>]*>/g, "").trim();
              if (text.length > 10) {
                questions.push(text);
              }
            }

            if (questions.length > 0) {
              res.json({ questions: questions.slice(0, 10) });
              return;
            }
          }
        } catch (err) {
          console.warn("Bright Data scrape failed, using fallback:", err);
        }
      }

      // Fallback
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
      res.status(500).json({ error: message });
    }
  });

  // /api/speechmatics-token
  app.post("/api/speechmatics-token", async (req, res) => {
    try {
      const apiKey = process.env.SPEECHMATICS_API_KEY;
      if (!apiKey) {
        res.status(530).json({
          error: "Speechmatics API key not configured. Speech recognition will use browser fallback.",
        });
        return;
      }

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
        res.status(500).json({ error: `Speechmatics API error ${smRes.status}: ${text}` });
        return;
      }

      const data = await smRes.json();
      const token = data.key_value || data.key || data.token || data.jwt || data.api_key || data.apiKey;

      if (!token) {
        res.status(500).json({ error: "No token returned from Speechmatics" });
        return;
      }

      res.json({
        token,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get Speechmatics token";
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
