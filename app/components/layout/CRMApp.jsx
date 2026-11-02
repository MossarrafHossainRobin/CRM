
"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";

import useCRMSession from "../hooks/useCRMSession";

import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "../dashboard/Dashboard";
import AIProcessor from "../ai/AIProcessor";

const blankLead = () => ({
  name: "",
  phone: "",
  source: "WhatsApp",
  message: "",
  status: "New",
  type: "Sales",
  interest: "Unknown",
  language: "Banglish",
  reply: "",
  notes: "",
  followUpAt: "",
  lastContactedAt: ""
});

export default function CRMApp() {
  const { session, loading: sessionLoading, error: sessionError } =
    useCRMSession();

  const [tab, setTab] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [leads, setLeads] = useState([]);
  const [draft, setDraft] = useState(blankLead);
  const [editId, setEditId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const api = useCallback(async (path, method = "GET", body) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed (${response.status})`
      );
    }

    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;

    setLoading(true);

    try {
      const result = await api("/api/leads");
      setLeads(Array.isArray(result) ? result : []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, api]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  async function run(action) {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function newLead() {
    setDraft(blankLead());
    setEditId("");
    setTab("AI Processor");
    setMobileOpen(false);
  }

  function editLead(lead) {
    setDraft({
      ...blankLead(),
      ...lead
    });

    setEditId(lead.id);
    setTab("AI Processor");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function autoProcess() {
    await run(async () => {
      if (!draft.message.trim()) {
        throw new Error("Customer message is required.");
      }

      const analysis = await api("/api/analyze", "POST", {
        message: draft.message,
        source: draft.source
      });

      const merged = {
        ...draft,
        ...analysis,
        name: draft.name || analysis.name || "",
        phone: draft.phone || analysis.phone || "",
        message: draft.message,
        source: draft.source,
        type: analysis.type ||
          (analysis.category === "Job Seeker" ? "Job" : analysis.category) ||
          "Other",
        interest:
          analysis.interest === "None"
            ? "Unknown"
            : analysis.interest || "Unknown",
        reply: analysis.reply || analysis.suggestedReply || "",
        status: analysis.status &&
          analysis.status !== "None"
            ? analysis.status
            : "New"
      };

      if (editId) {
        await api(
          `/api/leads/${encodeURIComponent(editId)}`,
          "PATCH",
          merged
        );
      } else {
        await api("/api/leads", "POST", merged);
      }

      const updated = await api("/api/leads");
      setLeads(updated);

      setDraft(blankLead());
      setEditId("");

      setNotice("AI processed and saved your enquiry.");
    });
  }

  async function manualSave() {
    await run(async () => {
      if (!draft.message.trim()) {
        throw new Error("Customer message is required.");
      }

      if (editId) {
        await api(
          `/api/leads/${encodeURIComponent(editId)}`,
          "PATCH",
          draft
        );
      } else {
        await api("/api/leads", "POST", draft);
      }

      setLeads(await api("/api/leads"));
      setDraft(blankLead());
      setEditId("");
      setNotice("Enquiry saved.");
    });
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto animate-spin text-emerald-600"
          />
          <p className="mt-4 text-sm text-slate-500">
            Preparing your CRM workspace...
          </p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <AlertCircle
            size={30}
            className="mx-auto text-red-500"
          />
          <h2 className="mt-4 font-bold">
            Unable to start CRM
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {sessionError || "Session unavailable."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        tab={tab}
        setTab={setTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <Header
          tab={tab}
          loading={loading}
          refresh={refresh}
          setMobileOpen={setMobileOpen}
          onNewLead={newLead}
          sessionId={session.sessionId}
        />

        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          {error && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {tab === "Dashboard" && (
            <Dashboard
              leads={leads}
              onNewLead={newLead}
              setTab={setTab}
              onEditLead={editLead}
            />
          )}

          {tab === "AI Processor" && (
            <AIProcessor
              draft={draft}
              setDraft={setDraft}
              loading={loading}
              onAutoProcess={autoProcess}
              onManualSave={manualSave}
              editId={editId}
            />
          )}

          {tab === "Enquiries" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold">
                Enquiries
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {leads.length} enquiries loaded.
                Full enquiry management component is next.
              </p>
            </div>
          )}

          {tab === "Pipeline" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold">
                Sales Pipeline
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Pipeline component is next.
              </p>
            </div>
          )}

          {tab === "Import CSV" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h2 className="text-xl font-bold">
                CSV Import
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                CSV import component is next.
              </p>
            </div>
          )}

          <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} BIAI CRM · Powered by Next.js, Firebase & n8n
          </footer>
        </main>
      </div>
    </div>
  );
}
