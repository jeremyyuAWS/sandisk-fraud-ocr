import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LYZR_BASE = "https://agent-prod.studio.lyzr.ai/v3";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
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
    const sessionId: string = body.sessionId || "";
    const message: string = body.message || "";
    const imageBase64: string = body.imageBase64 || "";

    if (!apiKey || !agentId || !userId) {
      return jsonResponse(
        { error: "Missing required fields: apiKey, agentId, userId" },
        400
      );
    }

    const effectiveSessionId =
      sessionId || `${agentId}-${crypto.randomUUID().slice(0, 12)}`;

    const assets: string[] = [];

    if (imageBase64) {
      const bytes = base64ToUint8Array(imageBase64);
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("agent_id", agentId);
      formData.append("files", blob, `upload-${crypto.randomUUID().slice(0, 8)}.jpg`);

      console.log("Uploading image to Lyzr assets:", bytes.length, "bytes");

      const uploadRes = await fetch(`${LYZR_BASE}/assets/upload`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.results?.[0]?.asset_id) {
        console.error("Lyzr asset upload failed:", JSON.stringify(uploadData));
        return jsonResponse({ error: `Image upload failed: ${uploadData.detail || "Unknown error"}` }, 500);
      }

      const assetId = uploadData.results[0].asset_id as string;
      console.log("Lyzr asset uploaded:", assetId);
      assets.push(assetId);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const chatPayload: Record<string, unknown> = {
      user_id: userId,
      agent_id: agentId,
      session_id: effectiveSessionId,
      message,
    };
    if (assets.length > 0) {
      chatPayload.assets = assets;
    }

    const lyzrResponse = await fetch(`${LYZR_BASE}/inference/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(chatPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await lyzrResponse.text();
    console.log("Lyzr status:", lyzrResponse.status, "body:", responseText.slice(0, 300));

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
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
