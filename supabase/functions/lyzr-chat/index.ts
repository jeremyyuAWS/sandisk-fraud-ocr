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

const LYZR_CHAT_URL = "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(",");
  return commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

function getMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)/);
  return match?.[1] ?? "image/png";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: LyzrRequest = await req.json();
    const { apiKey, agentId, userId, sessionId, message, imageBase64 } = body;

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let lyzrResponse: Response;

    if (imageBase64) {
      const rawBase64 = stripDataUrlPrefix(imageBase64);
      const mimeType = getMimeType(imageBase64);
      const ext = mimeType.split("/")[1] || "png";
      const filename = `upload.${ext === "jpeg" ? "jpg" : ext}`;

      const binaryStr = atob(rawBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });

      const form = new FormData();
      form.append("user_id", userId);
      form.append("agent_id", agentId);
      form.append("session_id", effectiveSessionId);
      form.append("message", message);
      form.append("file", blob, filename);

      lyzrResponse = await fetch(LYZR_CHAT_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
        signal: controller.signal,
      });

      if (!lyzrResponse.ok) {
        const formErrorText = await lyzrResponse.text().catch(() => "");
        console.error("FormData upload failed, status:", lyzrResponse.status, formErrorText);

        lyzrResponse = await fetch(LYZR_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            user_id: userId,
            agent_id: agentId,
            session_id: effectiveSessionId,
            message: message + "\n\n[Image attached as base64]",
            file: imageBase64,
          }),
          signal: controller.signal,
        });
      }
    } else {
      lyzrResponse = await fetch(LYZR_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          session_id: effectiveSessionId,
          message,
        }),
        signal: controller.signal,
      });
    }

    clearTimeout(timeout);

    const data = await lyzrResponse.json();

    return new Response(
      JSON.stringify({
        ...data,
        session_id: effectiveSessionId,
      }),
      {
        status: lyzrResponse.ok ? 200 : lyzrResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Edge function error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
