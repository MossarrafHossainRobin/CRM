
import { getSession, unauthorized } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 60000;

const INTERESTS = [
  "Bootcamp",
  "Fellowship",
  "Corporate Training",
  "Unknown"
];

const LANGUAGES = [
  "Bangla",
  "Banglish",
  "English"
];

function parseJSON(value) {
  if (typeof value !== "string") return value;

  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

function unwrap(value) {
  let result = value;

  for (let i = 0; i < 6; i++) {
    if (typeof result === "string") {
      result = parseJSON(result);
      continue;
    }

    if (Array.isArray(result)) {
      result = result[0];
      continue;
    }

    if (!result || typeof result !== "object") {
      return null;
    }

    if (result.name || result.reply ||
        result.suggestedReply || result.interest) {
      return result;
    }

    const nested =
      result.output ??
      result.data ??
      result.result ??
      result.response ??
      result.json;

    if (nested === undefined) {
      return result;
    }

    result = nested;
  }

  return result && typeof result === "object"
    ? result
    : null;
}

function safe(value, limit = 3000) {
  return typeof value === "string"
    ? value.slice(0, limit)
    : "";
}

function normalizeInterest(value) {
  const text = safe(value, 100).toLowerCase();

  if (text.includes("bootcamp")) return "Bootcamp";
  if (text.includes("fellowship")) return "Fellowship";

  if (text.includes("corporate") ||
      text.includes("training")) {
    return "Corporate Training";
  }

  return "Unknown";
}

function normalizeLanguage(value) {
  const text = safe(value, 50).toLowerCase();

  if (text === "bangla" || text === "bengali") {
    return "Bangla";
  }

  if (text === "banglish") return "Banglish";

  return "English";
}

export async function POST(req) {
  const session = await getSession(req);

  if (!session) return unauthorized();

  try {
    const input = await req.json().catch(() => null);

    const message = input?.message;
    const source = input?.source || "Other";

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return Response.json(
        { error: "Customer message is required." },
        { status: 400 }
      );
    }

    const webhook = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;

    if (!webhook || !secret) {
      return Response.json(
        { error: "n8n configuration is missing." },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TIMEOUT_MS
    );

    let response;

    try {
      response = await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CRM-SECRET": secret
        },
        body: JSON.stringify({
          message: message.trim().slice(0, 6000),
          source,
          sessionId: session.id
        }),
        signal: controller.signal,
        cache: "no-store"
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text();

    if (!response.ok) {
      console.error("n8n HTTP error:", {
        status: response.status,
        body: raw.slice(0, 1000)
      });

      return Response.json(
        {
          error: "n8n workflow request failed.",
          upstreamStatus: response.status
        },
        { status: 502 }
      );
    }

    const parsed = parseJSON(raw);
    const result = unwrap(parsed);

    if (!result) {
      console.error(
        "Invalid n8n response:",
        raw.slice(0, 1000)
      );

      return Response.json(
        { error: "n8n returned invalid AI data." },
        { status: 502 }
      );
    }

    const reply = safe(
      result.reply ||
      result.suggestedReply ||
      result.suggested_reply ||
      "",
      3000
    );

    if (!reply.trim()) {
      console.error(
        "AI reply missing:",
        JSON.stringify(result).slice(0, 1000)
      );

      return Response.json(
        {
          error:
            "AI analysis completed but suggested reply is missing."
        },
        { status: 502 }
      );
    }

    const interest = normalizeInterest(
      result.interest || result.program
    );

    const language = normalizeLanguage(
      result.language
    );

    return Response.json({
      name: safe(
        result.name || result.customerName,
        150
      ),

      phone: safe(
        result.phone || result.phoneNumber,
        50
      ),

      source,
      message,

      type: "Sales",
      interest,
      language,

      status: "New",

      reply,
      suggestedReply: reply,
      replyStatus: "Reply Ready",

      summary: safe(result.summary, 1000),
      notes: safe(result.notes, 3000),

      priority: ["High", "Medium", "Low"].includes(
        result.priority
      )
        ? result.priority
        : "Medium"
    });

  } catch (error) {
    console.error("Analyze API error:", error);

    const timedOut = error.name === "AbortError";

    return Response.json(
      {
        error: timedOut
          ? "n8n request timed out."
          : "Unable to connect to n8n workflow."
      },
      { status: timedOut ? 504 : 502 }
    );
  }
}
