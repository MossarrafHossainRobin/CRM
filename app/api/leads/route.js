
import { createHash } from "node:crypto";

import { db } from "../../../lib/firebase";
import {
  getSession,
  unauthorized
} from "../../../lib/auth";
import { cleanLead } from "../../../lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LEADS = 500;

function queryId(id) {
  return `BIAI-${id.slice(0, 8).toUpperCase()}`;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeIdentity(value) {
  return normalize(value).toLowerCase();
}

function getImportIdentity(lead) {
  const recordId = normalizeIdentity(
    lead.sourceRecordId || lead.sampleId
  );

  if (!recordId) return "";

  const source = normalizeIdentity(
    lead.importSource || "default-import"
  );

  return `${source}:${recordId}`;
}

function importedDocumentId(sessionId, identity) {
  const hash = createHash("sha256")
    .update(JSON.stringify([sessionId, identity]))
    .digest("hex");

  return `imp_${hash.slice(0, 40)}`;
}

function serializeLead(doc) {
  const data = doc.data();

  return {
    ...data,
    id: doc.id,
    queryId: data.queryId || queryId(doc.id),

    aiStatus:
      data.aiStatus ||
      (data.reply ? "Completed" : "Pending"),

    replyStatus:
      data.replyStatus ||
      (data.reply ? "Reply Ready" : "Pending"),

    reminderCompleted:
      data.reminderCompleted === true
  };
}

// --------------------------------------
// GET ALL ENQUIRIES
// --------------------------------------

export async function GET(req) {
  const session = await getSession(req);

  if (!session) return unauthorized();

  try {
    const url = new URL(req.url);

    const aiStatusFilter =
      url.searchParams.get("aiStatus");

    const statusFilter =
      url.searchParams.get("status");

    const search = normalize(
      url.searchParams.get("search")
    ).toLowerCase();

    const snapshot = await db()
      .collection("leads")
      .where("sessionId", "==", session.id)
      .limit(MAX_LEADS)
      .get();

    let leads = snapshot.docs.map(serializeLead);

    // Optional AI queue filter
    if (aiStatusFilter) {
      leads = leads.filter(
        (lead) =>
          lead.aiStatus === aiStatusFilter
      );
    }

    // Optional pipeline filter
    if (statusFilter) {
      leads = leads.filter(
        (lead) =>
          lead.status === statusFilter
      );
    }

    // Optional search
    if (search) {
      leads = leads.filter((lead) => {
        const fields = [
          lead.queryId,
          lead.name,
          lead.phone,
          lead.message,
          lead.source,
          lead.interest,
          lead.status
        ];

        return fields
          .map((value) => String(value || ""))
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
    }

    leads.sort((a, b) =>
      String(
        b.receivedAt ||
        b.createdAt ||
        ""
      ).localeCompare(
        String(
          a.receivedAt ||
          a.createdAt ||
          ""
        )
      )
    );

    // Preserve existing response format
    return Response.json(leads);

  } catch (error) {
    console.error("GET leads:", error);

    return Response.json(
      {
        error: "Unable to load enquiries."
      },
      { status: 500 }
    );
  }
}

// --------------------------------------
// CREATE ENQUIRY
// --------------------------------------

export async function POST(req) {
  const session = await getSession(req);

  if (!session) return unauthorized();

  try {
    const input = await req
      .json()
      .catch(() => null);

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return Response.json(
        {
          error: "Invalid enquiry data."
        },
        { status: 400 }
      );
    }

    const lead = cleanLead(input);

    if (!lead.message.trim()) {
      return Response.json(
        {
          error: "Customer message is required."
        },
        { status: 400 }
      );
    }

    const collection = db().collection("leads");
    const now = new Date().toISOString();

    const identity = getImportIdentity(lead);

    const hasReply = Boolean(
      lead.reply?.trim()
    );

    // ----------------------------------
    // Preserve legacy sampleId duplicates
    // ----------------------------------

    if (lead.sampleId?.trim()) {
      const existing = await collection
        .where("sessionId", "==", session.id)
        .where("sampleId", "==", lead.sampleId)
        .limit(1)
        .get();

      if (!existing.empty) {
        const existingDoc = existing.docs[0];

        const existingLead =
          serializeLead(existingDoc);

        return Response.json({
          ...existingLead,
          duplicate: true
        });
      }
    }

    const baseDocument = {
      ...lead,

      sessionId: session.id,

      aiStatus: hasReply
        ? "Completed"
        : "Pending",

      aiError: "",

      aiAttempts: 0,

      aiProcessedAt: hasReply
        ? now
        : "",

      replyStatus:
        lead.replyStatus === "Replied"
          ? "Replied"
          : hasReply
            ? "Reply Ready"
            : "Pending",

      reminderCompleted:
        lead.reminderCompleted === true,

      receivedAt:
        lead.receivedAt || now,

      importedAt:
        identity
          ? now
          : lead.importedAt || "",

      createdAt: now,
      updatedAt: now,

      stageHistory: [
        {
          from: "",
          to: lead.status || "New",
          changedBy: "System",
          changedAt: now
        }
      ]
    };

    // ----------------------------------
    // Imported record: atomic dedup
    // ----------------------------------

    if (identity) {
      const docId = importedDocumentId(
        session.id,
        identity
      );

      const ref = collection.doc(docId);

      const result = await db().runTransaction(
        async (transaction) => {
          const existing =
            await transaction.get(ref);

          if (existing.exists) {
            const data = existing.data();

            if (
              data.sessionId !== session.id
            ) {
              throw new Error(
                "Enquiry ownership conflict"
              );
            }

            return {
              ...serializeLead(existing),
              duplicate: true
            };
          }

          const document = {
            ...baseDocument,
            queryId: queryId(ref.id),
            importIdentity: identity
          };

          transaction.create(ref, document);

          return {
            ...document,
            id: ref.id,
            duplicate: false
          };
        }
      );

      return Response.json(
        result,
        {
          status: result.duplicate
            ? 200
            : 201
        }
      );
    }

    // ----------------------------------
    // Manual record: normal creation
    // ----------------------------------

    const ref = collection.doc();

    const document = {
      ...baseDocument,
      queryId: queryId(ref.id),
      importIdentity: ""
    };

    await ref.set(document);

    return Response.json(
      {
        ...document,
        id: ref.id,
        duplicate: false
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("POST leads:", error);

    return Response.json(
      {
        error: "Unable to save enquiry."
      },
      { status: 500 }
    );
  }
}
