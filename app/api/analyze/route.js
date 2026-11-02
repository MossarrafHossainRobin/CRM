
import { getSession, unauthorized } from "../../../lib/auth";
import { TYPES, INTERESTS } from "../../../lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGES = ["Bangla", "Banglish", "English"];
const CATEGORIES = [
  "Sales",
  "Support",
  "Job Seeker",
  "Spam",
  "Other"
];
const STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost"
];
const PRIORITIES = ["High", "Medium", "Low"];
const SENTIMENTS = ["Positive", "Neutral", "Negative"];

const safeString = (value, maxLength = 1000) =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

function parseAIResponse(result) {
  let data = Array.isArray(result) ? result[0] : result;

  if (data && typeof data === "object" && "output" in data) {
    data = data.output;
  }

  if (typeof data === "string") {
    data = JSON.parse(
      data.replace(/```json|```/gi, "").trim()
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid n8n response format");
  }

  return data;
}

export async function POST(req) {
  // Verify the anonymous CRM session.
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { message, source = "Other" } = body;

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 6000
    ) {
      return Response.json(
        { error: "Message must be 1-6000 characters" },
        { status: 400 }
      );
    }

    if (typeof source !== "string" || source.length > 100) {
      return Response.json(
        { error: "Invalid source" },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      return Response.json(
        { error: "n8n webhook configuration missing" },
        { status: 503 }
      );
    }

    // Validate webhook destination.
    let parsedUrl;

    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return Response.json(
        { error: "Invalid n8n webhook URL" },
        { status: 503 }
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "biaicrm.app.n8n.cloud"
    ) {
      return Response.json(
        { error: "Unexpected n8n webhook destination" },
        { status: 503 }
      );
    }

    // Send customer message to n8n.
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // Must match n8n Header Auth credential Name.
        "X-CRM-SECRET": webhookSecret
      },
      body: JSON.stringify({
        message: message.trim(),
        source: source.trim() || "Other"
      }),
      signal: AbortSignal.timeout(60000),
      cache: "no-store"
    });

    if (!response.ok) {
      console.error("n8n request failed:", {
        status: response.status,
        statusText: response.statusText
      });

      return Response.json(
        {
          error: "n8n workflow request failed",
          upstreamStatus: response.status
        },
        { status: 502 }
      );
    }

    const result = await response.json();
    const data = parseAIResponse(result);

    if (
      data.processingStatus === "error" ||
      !CATEGORIES.includes(data.category)
    ) {
      throw new Error("Invalid AI classification");
    }

    const category = data.category;

    const legacyType =
      category === "Job Seeker" ? "Job" : category;

    const type = TYPES.includes(legacyType)
      ? legacyType
      : "Other";

    const interest = INTERESTS.includes(data.interest)
      ? data.interest
      : "Unknown";

    const language = LANGUAGES.includes(data.language)
      ? data.language
      : "English";

    const status =
      category === "Sales" && STATUSES.includes(data.status)
        ? data.status
        : "New";

    const suggestedReply = safeString(
      data.suggestedReply || data.reply,
      3000
    );

    const summary = safeString(
      data.summary || data.reason,
      1000
    );

    const followUpRequired =
      data.followUpRequired === true;

    const followUpAfterHours =
      followUpRequired &&
      typeof data.followUpAfterHours === "number" &&
      Number.isFinite(data.followUpAfterHours)
        ? Math.max(0, data.followUpAfterHours)
        : 0;

    const output = {
      name: safeString(data.name, 150),
      phone: safeString(data.phone, 50),

      source: source.trim() || "Other",
      category,
      type,
      interest,
      language,
      status,

      intent: safeString(data.intent, 200),
      priority: PRIORITIES.includes(data.priority)
        ? data.priority
        : "Medium",

      sentiment: SENTIMENTS.includes(data.sentiment)
        ? data.sentiment
        : "Neutral",

      reply: suggestedReply,
      suggestedReply,

      reason: summary,
      summary,

      followUpRequired,
      followUpAfterHours,

      needsHumanReview:
        data.needsHumanReview === true,

      processingStatus: "success"
    };

    return Response.json(output, {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    console.error("CRM analysis error:", error.message);

    return Response.json(
      {
        error: "AI processing failed",
        detail:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined
      },
      {
        status:
          error.name === "TimeoutError" ||
          error.name === "AbortError"
            ? 504
            : 502
      }
    );
  }
}
