import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SPEECHMATICS_API_KEY = Deno.env.get("SPEECHMATICS_API_KEY") || "";

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

  if (!SPEECHMATICS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Speechmatics API key not configured. Set SPEECHMATICS_API_KEY." }),
      { status: 503, headers: corsHeaders() }
    );
  }

  try {
    // Generate a temporary JWT via Speechmatics Management API
    // ttl must be between 60 and 3600 seconds
    const res = await fetch(
      "https://mp.speechmatics.com/v1/api_keys?type=rt",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SPEECHMATICS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 60 }),
      }
    );

    // Log the raw response for debugging
    const responseText = await res.text();
    console.log(`Speechmatics API response status: ${res.status}`);
    console.log(`Speechmatics API response body: ${responseText}`);

    if (!res.ok) {
      throw new Error(`Speechmatics token error ${res.status}: ${responseText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Speechmatics returned non-JSON response: ${responseText}`);
    }

    // Try all known response field names for the JWT key
    // Speechmatics v1 API returns { "key_value": "<jwt>", "apikey_id": "..." }
    const token = (data.key_value || data.key || data.token || data.jwt || data.api_key || data.apiKey) as string | undefined;

    if (!token) {
      throw new Error(
        `No token in Speechmatics response. Response keys: ${Object.keys(data).join(", ")}`
      );
    }

    return new Response(
      JSON.stringify({
        token,
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get Speechmatics token";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});