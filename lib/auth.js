
import "server-only";

import { db } from "./firebase";
import {
  SESSION_COOKIE,
  hashSessionToken,
  isValidSessionToken
} from "./session";

export async function getSession(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!isValidSessionToken(token)) {
    return null;
  }

  const sessionId = hashSessionToken(token);

  try {
    const doc = await db()
      .collection("crm_sessions")
      .doc(sessionId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const session = doc.data();

    if (session.status !== "active") {
      return null;
    }

    if (
      !session.expiresAt ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      return null;
    }

    return {
      id: sessionId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    };
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}

export async function authorized(req) {
  return Boolean(await getSession(req));
}

export function unauthorized() {
  return Response.json(
    {
      error: "Session expired or invalid. Please reload the page."
    },
    { status: 401 }
  );
}
