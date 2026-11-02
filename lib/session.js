
import "server-only";

import { randomBytes, createHash } from "node:crypto";

export const SESSION_COOKIE = "biai_crm_session";

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function isValidSessionToken(token) {
  return (
    typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token)
  );
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  };
}

export function getSessionExpiry() {
  return new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1000
  ).toISOString();
}
