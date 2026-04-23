import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LyzrRequest {
  apiKey: string;
  agentId: string;
  userId: string;
  sessionId: string;
  message: string;
  imageBase64?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { apiKey, agentId, userId, sessionId, message, imageBase64 }: LyzrRequest =
      await req.json();

    if (!apiKey || !agentId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: apiKey, agentId, userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const effectiveSessionId =
      sessionId || `${agentId}-${crypto.randomUUID().slice(0, 12)}`;

    const body: Record<string, unknown> = {
      user_id: userId,
      agent_id: agentId,
      session_id: effectiveSessionId,
      message: message,
    };

    if (imageBase64) {
      body.file = imageBase64;
    }

    const lyzrResponse = await fetch(
      "https://agent-prod.studio.lyzr.ai/v3/inference/chat/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await lyzrResponse.json();

    return new Response(
      JSON.stringify({
        ...data,
        session_id: effectiveSessionId,
      }),
      {
        status: lyzrResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
