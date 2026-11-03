
import { db } from "../../../lib/firebase";
import {
  getSession,
  unauthorized
} from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 10;
const TIMEOUT_MS = 60000;
const LOCK_MS = 90000;

function errorResponse(message, status = 400) {
  return Response.json(
    { error: message },
    { status }
  );
}

function safe(value, max = 3000) {
  return typeof value === "string"
    ? value.slice(0, max)
    : "";
}

function parseJSON(value) {
  if (typeof value !== "string") {
    return value;
  }

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
        return JSON.parse(
          text.slice(start, end + 1)
        );
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

    if (
      !result ||
      typeof result !== "object"
    ) {
      return null;
    }

    if (
      result.reply ||
      result.suggestedReply ||
      result.interest
    ) {
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

  return result &&
    typeof result === "object"
    ? result
    : null;
}

function normalizeInterest(value) {
  const text = safe(value, 100).toLowerCase();

  if (text.includes("bootcamp")) {
    return "Bootcamp";
  }

  if (text.includes("fellowship")) {
    return "Fellowship";
  }

  if (
    text.includes("corporate") ||
    text.includes("training")
  ) {
    return "Corporate Training";
  }

  return "Unknown";
}

function normalizeLanguage(value) {
  const text = safe(value, 50).toLowerCase();

  if (
    text === "bangla" ||
    text === "bengali"
  ) {
    return "Bangla";
  }

  if (text === "banglish") {
    return "Banglish";
  }

  return "English";
}

function normalizeAIResult(result) {
  const reply = safe(
    result.reply ||
    result.suggestedReply ||
    result.suggested_reply,
    3000
  );

  if (!reply.trim()) {
    throw new Error(
      "AI reply missing from n8n response."
    );
  }

  return {
    name: safe(
      result.name || result.customerName,
      150
    ),

    phone: safe(
      result.phone || result.phoneNumber,
      50
    ),

    type: "Sales",

    interest: normalizeInterest(
      result.interest || result.program
    ),

    language: normalizeLanguage(
      result.language
    ),

    reply,
    suggestedReply: reply,

    summary: safe(result.summary, 1000),
    notes: safe(result.notes, 3000),

    priority:
      ["High", "Medium", "Low"].includes(
        result.priority
      )
        ? result.priority
        : "Medium"
  };
}

async function callN8N(message, source, sessionId) {
  const webhook = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhook || !secret) {
    throw new Error(
      "n8n configuration is missing."
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(webhook, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-CRM-SECRET": secret
      },

      body: JSON.stringify({
        message,
        source,
        sessionId
      }),

      signal: controller.signal,
      cache: "no-store"
    });

    const raw = await response.text();

    if (!response.ok) {
      const error = new Error(
        `n8n returned HTTP ${response.status}`
      );

      error.upstreamStatus = response.status;

      throw error;
    }

    const parsed = parseJSON(raw);
    const result = unwrap(parsed);

    if (!result) {
      throw new Error(
        "n8n returned invalid AI data."
      );
    }

    return normalizeAIResult(result);

  } finally {
    clearTimeout(timeout);
  }
}

async function claimLead(ref, sessionId) {
  return db().runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(ref);

      if (
        !snapshot.exists ||
        snapshot.data().sessionId !==
          sessionId
      ) {
        return {
          claimed: false,
          reason: "Lead not found."
        };
      }

      const lead = snapshot.data();

      const status =
        lead.aiStatus ||
        (lead.reply
          ? "Completed"
          : "Pending");

      if (
        status !== "Pending" &&
        status !== "Failed"
      ) {
        return {
          claimed: false,
          reason:
            `Lead is already ${status}.`
        };
      }

      if (!safe(lead.message).trim()) {
        return {
          claimed: false,
          reason: "Customer message is empty."
        };
      }

      const now = new Date().toISOString();

      transaction.update(ref, {
        aiStatus: "Processing",
        aiError: "",

        aiAttempts:
          (Number(lead.aiAttempts) || 0) + 1,

        aiStartedAt: now,

        aiLockUntil:
          new Date(
            Date.now() + LOCK_MS
          ).toISOString(),

        updatedAt: now
      });

      return {
        claimed: true,
        lead
      };
    }
  );
}

async function completeLead(
  ref,
  sessionId,
  result
) {
  return db().runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(ref);

      if (
        !snapshot.exists ||
        snapshot.data().sessionId !==
          sessionId
      ) {
        return false;
      }

      const original = snapshot.data();
      const now = new Date().toISOString();

      transaction.update(ref, {
        name:
          original.name?.trim()
            ? original.name
            : result.name,

        phone:
          original.phone?.trim()
            ? original.phone
            : result.phone,

        type: result.type,
        interest: result.interest,
        language: result.language,

        reply: result.reply,
        suggestedReply:
          result.suggestedReply,

        summary: result.summary,
        priority: result.priority,

        // Preserve employee notes.
        notes:
          original.notes || result.notes,

        replyStatus: "Reply Ready",

        aiStatus: "Completed",
        aiError: "",
        aiProcessedAt: now,
        aiLockUntil: "",

        updatedAt: now
      });

      return true;
    }
  );
}

async function failLead(
  ref,
  sessionId,
  error
) {
  await db().runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(ref);

      if (
        !snapshot.exists ||
        snapshot.data().sessionId !==
          sessionId
      ) {
        return;
      }

      transaction.update(ref, {
        aiStatus: "Failed",

        aiError: safe(
          error.message ||
          "AI processing failed.",
          500
        ),

        aiLockUntil: "",

        updatedAt:
          new Date().toISOString()
      });
    }
  );
}

// --------------------------------------
// GET /api/queue
// --------------------------------------

export async function GET(req) {
  const session = await getSession(req);

  if (!session) return unauthorized();

  try {
    const snapshot = await db()
      .collection("leads")
      .where("sessionId", "==", session.id)
      .limit(500)
      .get();

    const counts = {
      Pending: 0,
      Processing: 0,
      Completed: 0,
      Failed: 0
    };

    for (const doc of snapshot.docs) {
      const lead = doc.data();

      const status =
        lead.aiStatus ||
        (lead.reply
          ? "Completed"
          : "Pending");

      if (status in counts) {
        counts[status]++;
      }
    }

    return Response.json({
      success: true,
      counts,
      total: snapshot.size
    });

  } catch (error) {
    console.error("Queue GET error:", error);

    return errorResponse(
      "Unable to load AI queue.",
      500
    );
  }
}

// --------------------------------------
// POST /api/queue
// --------------------------------------

export async function POST(req) {
  const session = await getSession(req);

  if (!session) return unauthorized();

  const body = await req
    .json()
    .catch(() => null);

  const ids = body?.ids;

  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > MAX_BATCH ||
    ids.some(
      (id) =>
        typeof id !== "string" ||
        !id.trim() ||
        id.includes("/")
    )
  ) {
    return errorResponse(
      "Select 1 to 10 valid enquiry IDs."
    );
  }

  if (new Set(ids).size !== ids.length) {
    return errorResponse(
      "Duplicate enquiry IDs are not allowed."
    );
  }

  const results = [];

  // Sequential execution:
  // one enquiry at a time.
  for (const id of ids) {
    const ref = db()
      .collection("leads")
      .doc(id);

    let claimed = false;

    try {
      const claim = await claimLead(
        ref,
        session.id
      );

      if (!claim.claimed) {
        results.push({
          id,
          status: "Skipped",
          reason: claim.reason
        });

        continue;
      }

      claimed = true;

      const lead = claim.lead;

      const result = await callN8N(
        safe(lead.message, 6000),
        lead.source || "Other",
        session.id
      );

      const saved = await completeLead(
        ref,
        session.id,
        result
      );

      results.push({
        id,
        status: saved
          ? "Completed"
          : "Skipped",

        reason: saved
          ? ""
          : "Lead no longer exists."
      });

    } catch (error) {
      console.error(
        `AI Queue error for ${id}:`,
        error
      );

      if (claimed) {
        await failLead(
          ref,
          session.id,
          error
        ).catch(console.error);
      }

      results.push({
        id,
        status: "Failed",
        reason: error.message
      });

      // Stop batch after quota/rate-limit error.
      if (
        error.upstreamStatus === 429 ||
        error.upstreamStatus === 500 ||
        error.upstreamStatus === 503
      ) {
        break;
      }
    }
  }

  return Response.json({
    success: true,

    requested: ids.length,
    processed: results.length,

    completed: results.filter(
      (item) =>
        item.status === "Completed"
    ).length,

    failed: results.filter(
      (item) =>
        item.status === "Failed"
    ).length,

    skipped: results.filter(
      (item) =>
        item.status === "Skipped"
    ).length,

    results
  });
}
