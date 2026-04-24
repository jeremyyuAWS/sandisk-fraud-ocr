import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LYZR_BASE = "https://agent-prod.studio.lyzr.ai/v3";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
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
    const imageBase64: string = body.imageBase64 || "";

    if (!apiKey || !agentId || !userId) {
      return jsonResponse(
        { error: "Missing required fields: apiKey, agentId, userId" },
        400
      );
    }

    if (!imageBase64) {
      return jsonResponse(
        { error: "Missing imageBase64 field" },
        400
      );
    }

    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const sessionId = `${agentId}-test-${uniqueSuffix}`;
    const ephemeralUserId = `ocr-test-${uniqueSuffix}@test.local`;

    // Step 1: Upload image to Lyzr assets endpoint
    const bytes = base64ToUint8Array(imageBase64);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("agent_id", agentId);
    formData.append("files", blob, `upload-${uniqueSuffix}.jpg`);

    const uploadRes = await fetch(`${LYZR_BASE}/assets/upload`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || !uploadData.results?.[0]?.asset_id) {
      return jsonResponse({
        step: "lyzr_asset_upload",
        error: uploadData.detail || uploadData.error || "Asset upload failed",
        upload_response: uploadData,
      }, 500);
    }

    const assetId = uploadData.results[0].asset_id as string;
    const assetUrl = uploadData.results[0].url as string;

    // Step 2: Send chat request with asset reference
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const lyzrResponse = await fetch(`${LYZR_BASE}/inference/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        user_id: ephemeralUserId,
        agent_id: agentId,
        session_id: sessionId,
        message: "Analyze this product image and return the result as JSON.",
        assets: [assetId],
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

    // Step 3: Return full diagnostic info
    return jsonResponse({
      test_info: {
        agent_id: agentId,
        session_id: sessionId,
        ephemeral_user_id: ephemeralUserId,
        lyzr_asset_id: assetId,
        lyzr_asset_url: assetUrl,
        image_size_bytes: bytes.length,
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
