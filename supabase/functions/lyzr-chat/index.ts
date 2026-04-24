import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LYZR_CHAT_URL = "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let apiKey = "";
    let agentId = "";
    let userId = "";
    let sessionId = "";
    let message = "";
    let imageBytes: Uint8Array | null = null;
    let imageName = "upload.jpg";
    let imageMime = "image/jpeg";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      apiKey = (form.get("apiKey") as string) || "";
      agentId = (form.get("agentId") as string) || "";
      userId = (form.get("userId") as string) || "";
      sessionId = (form.get("sessionId") as string) || "";
      message = (form.get("message") as string) || "";

      const file = form.get("imageFile");
      if (file instanceof File) {
        imageBytes = new Uint8Array(await file.arrayBuffer());
        imageName = file.name || "upload.jpg";
        imageMime = file.type || "image/jpeg";
      }
    } else {
      const body = await req.json();
      apiKey = body.apiKey || "";
      agentId = body.agentId || "";
      userId = body.userId || "";
      sessionId = body.sessionId || "";
      message = body.message || "";
    }

    if (!apiKey || !agentId || !userId) {
      return jsonResponse({ error: "Missing required fields: apiKey, agentId, userId" }, 400);
    }

    const effectiveSessionId =
      sessionId || `${agentId}-${crypto.randomUUID().slice(0, 12)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    let lyzrResponse: Response;

    if (imageBytes) {
      const blob = new Blob([imageBytes], { type: imageMime });
      const lyzrForm = new FormData();
      lyzrForm.append("user_id", userId);
      lyzrForm.append("agent_id", agentId);
      lyzrForm.append("session_id", effectiveSessionId);
      lyzrForm.append("message", message);
      lyzrForm.append("file", blob, imageName);

      console.log("Sending image to Lyzr:", imageName, imageBytes.length, "bytes");

      lyzrResponse = await fetch(LYZR_CHAT_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: lyzrForm,
        signal: controller.signal,
      });
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

    const responseText = await lyzrResponse.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Lyzr returned non-JSON:", responseText.slice(0, 500));
      data = { response: responseText };
    }

    return jsonResponse(
      { ...data, session_id: effectiveSessionId },
      lyzrResponse.ok ? 200 : lyzrResponse.status
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("lyzr-chat error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
