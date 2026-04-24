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

    let finalMessage = message;

    if (imageBase64) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const bytes = base64ToUint8Array(imageBase64);
      const fileName = `${crypto.randomUUID()}.jpg`;
      const filePath = `uploads/${fileName}`;

      console.log("Uploading image to storage:", filePath, bytes.length, "bytes");

      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, bytes, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError.message);
        return jsonResponse({ error: `Image upload failed: ${uploadError.message}` }, 500);
      }

      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;
      console.log("Image public URL:", imageUrl);

      finalMessage = `${message}\n\nProduct image URL: ${imageUrl}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const lyzrResponse = await fetch(LYZR_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        agent_id: agentId,
        session_id: effectiveSessionId,
        message: finalMessage,
      }),
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
