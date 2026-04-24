import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LYZR_CHAT_URL =
  "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const apiKey: string = body.apiKey || "";
    const agentId: string = body.agentId || "";
    const userId: string = body.userId || "";
    const jsonPayload: string = body.jsonPayload || "";

    if (!apiKey || !agentId) {
      return jsonResponse(
        { error: "Missing required fields: apiKey, agentId" },
        400
      );
    }

    if (!jsonPayload) {
      return jsonResponse({ error: "Missing jsonPayload field" }, 400);
    }

    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const sessionId = `${agentId}-validate-${uniqueSuffix}`;
    const ephemeralUserId =
      userId || `validator-${uniqueSuffix}@test.local`;

    const message = `Validate the following OCR JSON output and return your assessment:\n\n${jsonPayload}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const lyzrResponse = await fetch(LYZR_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        user_id: ephemeralUserId,
        agent_id: agentId,
        session_id: sessionId,
        message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await lyzrResponse.text();

    let lyzrData: unknown;
    try {
      lyzrData = JSON.parse(responseText);
    } catch {
      lyzrData = responseText;
    }

    return jsonResponse({
      test_info: {
        agent_id: agentId,
        session_id: sessionId,
        ephemeral_user_id: ephemeralUserId,
        payload_size: jsonPayload.length,
        lyzr_status: lyzrResponse.status,
        lyzr_ok: lyzrResponse.ok,
      },
      lyzr_raw_response: lyzrData,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
