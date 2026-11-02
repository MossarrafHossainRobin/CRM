
"use client";

import { useEffect, useState } from "react";

export default function useCRMSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Session initialization failed."
          );
        }

        if (active) {
          setSession(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeSession();

    return () => {
      active = false;
    };
  }, []);

  return {
    session,
    loading,
    error
  };
}
