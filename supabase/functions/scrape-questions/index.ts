import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface RequestBody {
  role: string;
  company: string;
}

const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY") || "";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { role, company } = body;

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Missing required field: role" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!BRIGHT_DATA_API_KEY) {
      // Graceful degradation: return mock questions
      const fallbackQuestions = [
        `Tell me about yourself and your background for the ${role} role.`,
        `Why do you want to work at ${company || "our company"}?`,
        `Describe a challenging project you've worked on.`,
        "How do you handle tight deadlines and pressure?",
        `What relevant experience do you have for the ${role} position?`,
      ];
      return new Response(
        JSON.stringify({ questions: fallbackQuestions }),
        { status: 200, headers: corsHeaders() }
      );
    }

    // Use Bright Data's Web Unlocker to scrape Glassdoor/Indeed
    const scrapeUrl = `https://www.glassdoor.com/Interview/${company.replace(/\s+/g, "-")}-Interview-Questions-E000.htm`;
    const encodedScrapeUrl = encodeURIComponent(scrapeUrl);

    const res = await fetch(
      `https://api.brightdata.com/request?token=${BRIGHT_DATA_API_KEY}&url=${encodedScrapeUrl}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Bright Data error ${res.status}`);
    }

    const html = await res.text();

    // Basic parsing: extract interview questions from common patterns
    // This is a simplified parser — a production version would use cheerio or similar
    const questions: string[] = [];
    const questionRegex = /(?:<div[^>]*class="[^"]*question[^"]*"[^>]*>)(.*?)(?:<\/div>)/gi;
    let match;

    while ((match = questionRegex.exec(html)) !== null && questions.length < 10) {
      const text = match[1].replace(/<[^>]*>/g, "").trim();
      if (text.length > 10) {
        questions.push(text);
      }
    }

    // If scraping didn't yield results, use AI-generated fallback
    if (questions.length === 0) {
      questions.push(
        `Tell me about yourself.`,
        `Why are you interested in the ${role} role?`,
        "Describe a difficult problem you solved.",
        `What makes you a good fit for ${company || "this role"}?`,
        "Where do you see your career in 5 years?",
      );
    }

    return new Response(
      JSON.stringify({ questions: questions.slice(0, 10) }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to scrape questions";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});