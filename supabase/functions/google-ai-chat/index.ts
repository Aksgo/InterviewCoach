import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface RequestBody {
  action: "generate-questions" | "score-answer";
  resumeText?: string;
  role?: string;
  company?: string;
  question?: string;
  answer?: string;
}

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// System prompt for generating interview questions
function buildGeneratePrompt(resumeText: string, role: string, company: string): string {
  return `You are an expert interview coach. Based on the candidate's resume and target role, generate 5 relevant interview questions.

Target Role: ${role}
Target Company: ${company}
Resume:
${resumeText}

For each question, make it specific to the role and company. Include a mix of behavioral, technical, and situational questions.

Return ONLY a JSON array of 5 question strings. No other text.`;
}

// System prompt for scoring an answer
function buildScorePrompt(question: string, answer: string, role: string): string {
  return `You are an expert interview evaluator. Score the candidate's answer on 4 dimensions (each out of 10):

Question: ${question}
Role: ${role}
Answer: ${answer}

Dimensions:
- relevance: How well the answer addresses the question
- clarity: How clear, concise, and articulate the answer is
- depth: How much depth and substance the answer has
- confidence: How confident and convincing the candidate sounds

Return a JSON object with these exact keys:
{
  "score": <average of the 4 dimensions, rounded to 1 decimal>,
  "relevance": <number 1-10>,
  "clarity": <number 1-10>,
  "depth": <number 1-10>,
  "confidence": <number 1-10>,
  "feedback": "<2-3 sentence constructive feedback>"
}

Return ONLY the JSON object. No other text.`;
}

async function callGemini(prompt: string, systemInstruction: string): Promise<string> {
  const res = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_AI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini API");
  return content;
}

function parseJSON<T>(text: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try extracting JSON from markdown code blocks
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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    const body: RequestBody = await req.json();

    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Google AI API key not configured. Ask the admin to set GOOGLE_AI_API_KEY.",
        }),
        { status: 503, headers: corsHeaders() }
      );
    }

    let result: Record<string, unknown>;

    if (body.action === "generate-questions") {
      if (!body.resumeText || !body.role) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: resumeText, role" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const prompt = buildGeneratePrompt(body.resumeText, body.role, body.company || "");
      const raw = await callGemini(
        prompt,
        "You are an expert interview coach. Return only valid JSON."
      );
      const questions = parseJSON<string[]>(raw);

      if (!questions || !Array.isArray(questions)) {
        return new Response(
          JSON.stringify({ error: "Failed to parse generated questions", raw }),
          { status: 500, headers: corsHeaders() }
        );
      }

      result = { questions };
    } else if (body.action === "score-answer") {
      if (!body.question || !body.answer || !body.role) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: question, answer, role" }),
          { status: 400, headers: corsHeaders() }
        );
      }

      const prompt = buildScorePrompt(body.question, body.answer, body.role);
      const raw = await callGemini(
        prompt,
        "You are an expert interview evaluator. Return only valid JSON."
      );
      const scored = parseJSON<{
        score: number;
        relevance: number;
        clarity: number;
        depth: number;
        confidence: number;
        feedback: string;
      }>(raw);

      if (!scored || typeof scored.score !== "number") {
        return new Response(
          JSON.stringify({ error: "Failed to parse scoring response", raw }),
          { status: 500, headers: corsHeaders() }
        );
      }

      result = {
        score: Math.round(scored.score * 10) / 10,
        relevance: Math.round(scored.relevance),
        clarity: Math.round(scored.clarity),
        depth: Math.round(scored.depth),
        confidence: Math.round(scored.confidence),
        feedback: scored.feedback || "Great effort! Keep practicing.",
      };
    } else {
      return new Response(
        JSON.stringify({
          error: "Unknown action. Use 'generate-questions' or 'score-answer'.",
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});