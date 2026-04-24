import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LYZR_CHAT_URL = "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Step 1: Upload image to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const bytes = base64ToUint8Array(imageBase64);
    const fileName = `test/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("chat-images")
      .upload(fileName, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return jsonResponse({
        step: "upload",
        error: uploadError.message,
      }, 500);
    }

    const { data: urlData } = supabase.storage
      .from("chat-images")
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // Step 2: Send to Lyzr with the image URL in the message
    // Use an ephemeral user_id so Lyzr cannot return cached results from a
    // previous conversation tied to the real user account.
    const message = `Analyze this product image and return the result as JSON. Image URL: ${imageUrl}`;

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

    // Step 3: Return full diagnostic info
    return jsonResponse({
      test_info: {
        agent_id: agentId,
        session_id: sessionId,
        ephemeral_user_id: ephemeralUserId,
        image_url: imageUrl,
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
