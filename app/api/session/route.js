
import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  generateSessionToken,
  hashSessionToken,
  isValidSessionToken,
  getSessionCookieOptions,
  getSessionExpiry
} from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;

    if (isValidSessionToken(cookieToken)) {
      const sessionId = hashSessionToken(cookieToken);

      const sessionRef = db()
        .collection("crm_sessions")
        .doc(sessionId);

      const sessionDoc = await sessionRef.get();

      if (sessionDoc.exists) {
        const session = sessionDoc.data();

        if (
          session.expiresAt &&
          new Date(session.expiresAt).getTime() > Date.now()
        ) {
          return NextResponse.json({
            success: true,
            sessionId: sessionId.slice(0, 16),
            isNew: false,
            expiresAt: session.expiresAt
          });
        }
      }
    }

    const token = generateSessionToken();
    const sessionId = hashSessionToken(token);
    const now = new Date().toISOString();
    const expiresAt = getSessionExpiry();

    await db()
      .collection("crm_sessions")
      .doc(sessionId)
      .set({
        sessionId,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        status: "active",
        leadCount: 0
      });

    const response = NextResponse.json(
      {
        success: true,
        sessionId: sessionId.slice(0, 16),
        isNew: true,
        expiresAt
      },
      { status: 201 }
    );

    response.cookies.set(
      SESSION_COOKIE,
      token,
      getSessionCookieOptions()
    );

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Session creation error:", error);

    return NextResponse.json(
      { error: "Unable to initialize CRM session." },
      { status: 500 }
    );
  }
}
