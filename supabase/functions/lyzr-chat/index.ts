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

function base64ToBlob(dataUrl: string): { blob: Blob; filename: string } {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    throw new Error("Invalid data URL: no comma separator");
  }

  const meta = dataUrl.slice(0, commaIdx);
  const b64 = dataUrl.slice(commaIdx + 1);

  const mimeMatch = meta.match(/data:(image\/([a-zA-Z0-9.+-]+))/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const ext = mimeMatch?.[2] ?? "png";

  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return {
    blob: new Blob([bytes], { type: mimeType }),
    filename: `upload.${ext === "jpeg" ? "jpg" : ext}`,
  };
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let lyzrResponse: Response;

    if (imageBase64) {
      const { blob, filename } = base64ToBlob(imageBase64);
      const form = new FormData();
      form.append("user_id", userId);
      form.append("agent_id", agentId);
      form.append("session_id", effectiveSessionId);
      form.append("message", message);
      form.append("file", blob, filename);

      lyzrResponse = await fetch(
        "https://agent-prod.studio.lyzr.ai/v3/inference/chat/",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
          },
          body: form,
          signal: controller.signal,
        }
      );
    } else {
      lyzrResponse = await fetch(
        "https://agent-prod.studio.lyzr.ai/v3/inference/chat/",
        {
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
        }
      );
    }

    clearTimeout(timeout);

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
