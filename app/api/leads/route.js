
import { db } from "../../../lib/firebase";
import { getSession, unauthorized } from "../../../lib/auth";
import { cleanLead } from "../../../lib/constants";

export const runtime = "nodejs";

export async function GET(req) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const snapshot = await db()
      .collection("leads")
      .where("sessionId", "==", session.id)
      .limit(500)
      .get();

    const leads = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id
    }));

    return Response.json(leads);
  } catch (error) {
    console.error("Fetch leads error:", error);

    return Response.json(
      { error: "Unable to load enquiries." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const input = await req.json();

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return Response.json(
        { error: "Invalid lead data." },
        { status: 400 }
      );
    }

    const lead = cleanLead(input);

    if (!lead.message?.trim()) {
      return Response.json(
        { error: "Customer message is required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const document = {
      ...lead,
      sessionId: session.id,
      createdAt: now,
      updatedAt: now
    };

    const ref = await db()
      .collection("leads")
      .add(document);

    return Response.json(
      {
        ...document,
        id: ref.id
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create lead error:", error);

    return Response.json(
      { error: "Unable to save enquiry." },
      { status: 500 }
    );
  }
}
