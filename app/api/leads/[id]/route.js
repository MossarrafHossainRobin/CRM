
import { db } from "../../../../lib/firebase";
import {
  getSession,
  unauthorized
} from "../../../../lib/auth";

import {
  cleanLead,
  STAGES,
  REPLY_STATUSES,
  AI_STATUSES
} from "../../../../lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STAGE_HISTORY = 100;

function normalizeDate(value) {
  if (value === "" || value == null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error("Invalid reminder date.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid reminder date.");
  }

  return date.toISOString();
}

function getReplyStatus(data) {
  if (REPLY_STATUSES.includes(data.replyStatus)) {
    return data.replyStatus;
  }

  return data.reply?.trim()
    ? "Reply Ready"
    : "Pending";
}

function getQueryId(id, original) {
  return (
    original.queryId ||
    `BIAI-${id.slice(0, 8).toUpperCase()}`
  );
}

function validateLeadId(id) {
  return (
    typeof id === "string" &&
    id.trim().length > 0 &&
    !id.includes("/")
  );
}

function errorResponse(message, status = 400) {
  return Response.json(
    { error: message },
    { status }
  );
}

function notFoundError() {
  const error = new Error("Lead not found.");
  error.status = 404;
  return error;
}

function getStageHistory(original) {
  return Array.isArray(original.stageHistory)
    ? original.stageHistory
    : [];
}

function getAIStatus(original) {
  if (AI_STATUSES.includes(original.aiStatus)) {
    return original.aiStatus;
  }

  return original.reply?.trim()
    ? "Completed"
    : "Pending";
}

// ----------------------------------------
// PATCH /api/leads/[id]
// ----------------------------------------

export async function PATCH(req, { params }) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const { id } = await params;

    if (!validateLeadId(id)) {
      return errorResponse("Invalid lead ID.");
    }

    const input = await req
      .json()
      .catch(() => null);

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return errorResponse("Invalid update data.");
    }

    // ------------------------------------
    // Validate pipeline stage
    // ------------------------------------

    if (
      input.status !== undefined &&
      !STAGES.includes(input.status)
    ) {
      return errorResponse(
        "Invalid pipeline status."
      );
    }

    // ------------------------------------
    // Validate reply status
    // ------------------------------------

    if (
      input.replyStatus !== undefined &&
      !REPLY_STATUSES.includes(
        input.replyStatus
      )
    ) {
      return errorResponse(
        "Invalid reply status."
      );
    }

    // ------------------------------------
    // Validate AI status
    // ------------------------------------

    if (
      input.aiStatus !== undefined &&
      !AI_STATUSES.includes(input.aiStatus)
    ) {
      return errorResponse(
        "Invalid AI status."
      );
    }

    // ------------------------------------
    // Validate dates
    // ------------------------------------

    for (const field of [
      "followUpAt",
      "lastContactedAt",
      "aiProcessedAt"
    ]) {
      if (input[field] !== undefined) {
        try {
          normalizeDate(input[field]);
        } catch {
          return errorResponse(
            `Invalid ${field} date.`
          );
        }
      }
    }

    // ------------------------------------
    // Prevent immutable field updates
    // ------------------------------------

    const immutableFields = [
      "id",
      "queryId",
      "sessionId",
      "createdAt",
      "updatedAt",
      "stageHistory",
      "importIdentity",
      "sampleId",
      "sourceRecordId",
      "importSource",
      "importedAt"
    ];

    const safeInput = { ...input };

    for (const field of immutableFields) {
      delete safeInput[field];
    }

    // Queue state is managed by server-side
    // processing routes, not regular PATCH.
    const queueFields = [
      "aiStatus",
      "aiAttempts",
      "aiError",
      "aiProcessedAt"
    ];

    for (const field of queueFields) {
      delete safeInput[field];
    }

    const ref = db()
      .collection("leads")
      .doc(id);

    let updatedDocument;

    await db().runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(ref);

        if (
          !snapshot.exists ||
          snapshot.data().sessionId !==
            session.id
        ) {
          throw notFoundError();
        }

        const original = snapshot.data();

        const updated = cleanLead({
          ...original,
          ...safeInput
        });

        const now =
          new Date().toISOString();

        // --------------------------------
        // Reply tracking
        // --------------------------------

        const replyStatus =
          safeInput.replyStatus !== undefined
            ? safeInput.replyStatus
            : getReplyStatus({
                ...updated,
                replyStatus:
                  original.replyStatus
              });

        // --------------------------------
        // Reminder tracking
        // --------------------------------

        const followUpAt =
          safeInput.followUpAt !== undefined
            ? normalizeDate(
                safeInput.followUpAt
              )
            : original.followUpAt || "";

        const lastContactedAt =
          safeInput.lastContactedAt !==
          undefined
            ? normalizeDate(
                safeInput.lastContactedAt
              )
            : original.lastContactedAt || "";

        // --------------------------------
        // Preserve AI processing fields
        // --------------------------------

        const aiStatus =
          getAIStatus(original);

        const aiAttempts =
          Number.isInteger(
            original.aiAttempts
          )
            ? original.aiAttempts
            : 0;

        updatedDocument = {
          ...original,
          ...updated,

          queryId: getQueryId(
            id,
            original
          ),

          sessionId: session.id,

          createdAt:
            original.createdAt,

          updatedAt: now,

          replyStatus,

          followUpAt,
          lastContactedAt,

          reminderCompleted:
            safeInput.reminderCompleted !==
            undefined
              ? safeInput.reminderCompleted ===
                true
              : original.reminderCompleted ===
                true,

          aiStatus,
          aiAttempts,

          aiError:
            original.aiError || "",

          aiProcessedAt:
            original.aiProcessedAt || "",

          stageHistory:
            getStageHistory(original)
        };

        // --------------------------------
        // Auto Contacted on reply
        // --------------------------------

        if (
          replyStatus === "Replied" &&
          original.replyStatus !== "Replied"
        ) {
          updatedDocument.lastContactedAt =
            now;

          if (
            updatedDocument.status === "New"
          ) {
            updatedDocument.status =
              "Contacted";
          }
        }

        // --------------------------------
        // Pipeline history
        // --------------------------------

        const previousStatus =
          original.status || "New";

        const nextStatus =
          updatedDocument.status || "New";

        if (
          previousStatus !== nextStatus
        ) {
          const history = [
            ...getStageHistory(original),
            {
              from: previousStatus,
              to: nextStatus,
              changedBy: "Employee",
              changedAt: now
            }
          ];

          updatedDocument.stageHistory =
            history.slice(
              -MAX_STAGE_HISTORY
            );
        }

        // --------------------------------
        // Save changes
        // --------------------------------

        transaction.update(
          ref,
          updatedDocument
        );
      }
    );

    return Response.json(
      {
        ...updatedDocument,
        id
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error(
      "Update lead error:",
      error
    );

    return errorResponse(
      error.status === 404
        ? "Lead not found."
        : "Unable to update enquiry.",
      error.status === 404
        ? 404
        : 500
    );
  }
}

// ----------------------------------------
// DELETE /api/leads/[id]
// ----------------------------------------

export async function DELETE(req, { params }) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const { id } = await params;

    if (!validateLeadId(id)) {
      return errorResponse(
        "Invalid lead ID."
      );
    }

    const ref = db()
      .collection("leads")
      .doc(id);

    await db().runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(ref);

        if (
          !snapshot.exists ||
          snapshot.data().sessionId !==
            session.id
        ) {
          throw notFoundError();
        }

        transaction.delete(ref);
      }
    );

    return Response.json({
      ok: true,
      id
    });

  } catch (error) {
    console.error(
      "Delete lead error:",
      error
    );

    return errorResponse(
      error.status === 404
        ? "Lead not found."
        : "Unable to delete enquiry.",
      error.status === 404
        ? 404
        : 500
    );
  }
}
