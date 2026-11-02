
import { db } from "../../../../lib/firebase";
import { getSession, unauthorized } from "../../../../lib/auth";
import { cleanLead } from "../../../../lib/constants";

export const runtime = "nodejs";

export async function PATCH(req, { params }) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const { id } = await params;

    if (!id || id.includes("/")) {
      return Response.json(
        { error: "Invalid lead ID." },
        { status: 400 }
      );
    }

    const ref = db().collection("leads").doc(id);
    const snapshot = await ref.get();

    if (
      !snapshot.exists ||
      snapshot.data().sessionId !== session.id
    ) {
      return Response.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    const input = await req.json();

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return Response.json(
        { error: "Invalid update data." },
        { status: 400 }
      );
    }

    const original = snapshot.data();

    const updated = cleanLead({
      ...original,
      ...input
    });

    const document = {
      ...updated,
      sessionId: session.id,
      createdAt: original.createdAt,
      updatedAt: new Date().toISOString()
    };

    await ref.update(document);

    return Response.json({
      ...document,
      id
    });
  } catch (error) {
    console.error("Update lead error:", error);

    return Response.json(
      { error: "Unable to update enquiry." },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const session = await getSession(req);

  if (!session) {
    return unauthorized();
  }

  try {
    const { id } = await params;

    if (!id || id.includes("/")) {
      return Response.json(
        { error: "Invalid lead ID." },
        { status: 400 }
      );
    }

    const ref = db().collection("leads").doc(id);
    const snapshot = await ref.get();

    if (
      !snapshot.exists ||
      snapshot.data().sessionId !== session.id
    ) {
      return Response.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    await ref.delete();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Delete lead error:", error);

    return Response.json(
      { error: "Unable to delete enquiry." },
      { status: 500 }
    );
  }
}
