
"use client";

import {
  useEffect,
  useState,
  useCallback
} from "react";

import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  Copy,
  CalendarClock,
  Upload,
  Trash2,
  Check,
  FileSpreadsheet
} from "lucide-react";

import useCRMSession from "../hooks/useCRMSession";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "../dashboard/Dashboard";
import AIProcessor from "../ai/AIProcessor";
import AIQueue from "../queue/AIQueue";
import CustomerPipeline from "../pipeline/CustomerPipeline";

const STAGES = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost"
];

const SOURCES = [
  "WhatsApp",
  "Facebook Messenger",
  "Facebook comment",
  "Website form",
  "Phone call note",
  "Other"
];

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
  replyStatus: "Pending",
  notes: "",
  followUpAt: "",
  reminderCompleted: false,
  lastContactedAt: ""
});

function getQueryId(lead) {
  return (
    lead.queryId ||
    `BIAI-${String(lead.id || "").slice(0, 8).toUpperCase()}`
  );
}

function getReplyStatus(lead) {
  if (lead.replyStatus === "Replied") {
    return "Replied";
  }

  if (lead.reply || lead.suggestedReply) {
    return "Reply Ready";
  }

  return "Pending";
}

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function dateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !quoted
    ) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(field);

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("Invalid CSV: unmatched quotation mark.");
  }

  row.push(field);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[\s_-]/g, "")
  );

  const get = (row, names) => {
    for (const name of names) {
      const index = headers.indexOf(name);

      if (index !== -1) {
        return String(row[index] || "").trim();
      }
    }

    return "";
  };

  const hasMessage = [
    "message",
    "text",
    "enquiry",
    "inquiry",
    "customermessage",
    "rawmessage",
    "data"
  ].some((name) => headers.includes(name));

  if (!hasMessage) {
    throw new Error(
      "CSV must contain a message, text, enquiry or Data column."
    );
  }

  return rows.slice(1).map((row, index) => ({
    sampleId:
      get(row, ["sampleid", "id"]) ||
      String(index + 1),

    name: get(row, ["name", "customername"]),
    phone: get(row, ["phone", "phonenumber", "mobile"]),

    message: get(row, [
      "message",
      "text",
      "enquiry",
      "inquiry",
      "customermessage",
      "rawmessage",
      "data"
    ]),

    source:
      get(row, ["source", "channel"]) || "Other"
  })).filter((row) => row.message);
}

function getReminderState(lead) {
  if (!lead.followUpAt) return "Not Set";
  if (lead.reminderCompleted) return "Completed";

  if (["Paid", "Lost"].includes(lead.status)) {
    return "Closed";
  }

  const date = new Date(lead.followUpAt);

  if (Number.isNaN(date.getTime())) {
    return "Invalid";
  }

  return date <= new Date() ? "Due" : "Upcoming";
}

export default function CRMApp() {
  const {
    session,
    loading: sessionLoading,
    error: sessionError
  } = useCRMSession();

  const [tab, setTab] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [leads, setLeads] = useState([]);
  const [draft, setDraft] = useState(blankLead);
  const [editId, setEditId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState("");

  const [csvRows, setCsvRows] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [csvProgress, setCsvProgress] = useState({
    done: 0,
    total: 0,
    failed: 0
  });

  const api = useCallback(
    async (path, method = "GET", body) => {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        cache: "no-store"
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed (${response.status})`
        );
      }

      return data;
    },
    []
  );

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
    if (session) {
      refresh();
    }
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

  async function copyText(text) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Unable to copy. Please copy manually.");
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
      ...lead,
      reply: lead.reply || lead.suggestedReply || ""
    });

    setEditId(lead.id);
    setTab("AI Processor");
    setMobileOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function updateLead(id, changes) {
    await run(async () => {
      const updated = await api(
        `/api/leads/${encodeURIComponent(id)}`,
        "PATCH",
        changes
      );

      setLeads((previous) =>
        previous.map((lead) =>
          lead.id === id ? updated : lead
        )
      );

      setQueueRefreshKey((value) => value + 1);
      setNotice("Enquiry updated successfully.");
    });
  }

  async function deleteLead(id) {
    if (!window.confirm("Delete this enquiry permanently?")) {
      return;
    }

    await run(async () => {
      await api(
        `/api/leads/${encodeURIComponent(id)}`,
        "DELETE"
      );

      setLeads((previous) =>
        previous.filter((lead) => lead.id !== id)
      );

      setQueueRefreshKey((value) => value + 1);
      setNotice("Enquiry deleted.");
    });
  }

  async function autoProcess() {
    await run(async () => {
      if (!draft.message.trim()) {
        throw new Error("Customer message is required.");
      }

      const analysis = await api(
        "/api/analyze",
        "POST",
        {
          message: draft.message,
          source: draft.source
        }
      );

      const reply =
        analysis.reply ||
        analysis.suggestedReply ||
        "";

      const merged = {
        ...draft,
        ...analysis,

        name:
          draft.name ||
          analysis.name ||
          "",

        phone:
          draft.phone ||
          analysis.phone ||
          "",

        message: draft.message,
        source: draft.source,

        type:
          analysis.type ||
          (analysis.category === "Job Seeker"
            ? "Job"
            : analysis.category) ||
          "Other",

        interest:
          analysis.interest === "None"
            ? "Unknown"
            : analysis.interest || "Unknown",

        reply,

        replyStatus:
          draft.replyStatus === "Replied"
            ? "Replied"
            : reply
              ? "Reply Ready"
              : "Pending",

        status: editId
          ? draft.status
          : "New",

        followUpAt: draft.followUpAt || "",
        reminderCompleted:
          draft.reminderCompleted === true
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

      setLeads(await api("/api/leads"));
      setQueueRefreshKey((value) => value + 1);
      setDraft(blankLead());
      setEditId("");
      setTab("Enquiries");

      setNotice("AI processed and saved the enquiry.");
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
      setQueueRefreshKey((value) => value + 1);
      setDraft(blankLead());
      setEditId("");
      setTab("Enquiries");

      setNotice("Enquiry saved.");
    });
  }

  async function loadCSV(file) {
    if (!file) return;
    setError("");
    setNotice("");
    setImportFile(null);
    setCsvRows([]);

    try {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
        throw new Error("Choose a CSV, XLSX or XLS file.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Maximum file size is 5 MB.");
      }
      setImportFile(file);
      if (/\.csv$/i.test(file.name)) {
        const rows = parseCSV(await file.text());
        if (!rows.length) {
          throw new Error("No valid enquiries found in CSV.");
        }
        setCsvRows(rows);
        setCsvProgress({ done: 0, total: rows.length, failed: 0 });
        setNotice(`${rows.length} enquiries ready to import.`);
      } else {
        setCsvProgress({ done: 0, total: 0, failed: 0 });
        setNotice(`${file.name} selected. Excel rows will be parsed on the server.`);
      }
    } catch (err) {
      setImportFile(null);
      setCsvRows([]);
      setError(err.message);
    }
  }

  async function importCSV() {
    if (!importFile && !sheetUrl.trim()) return;

    await run(async () => {
      let response;
      if (importFile) {
        const form = new FormData();
        form.append("file", importFile);
        form.append("importSource", importFile.name);
        response = await fetch("/api/import", {
          method: "POST",
          credentials: "same-origin",
          body: form,
          cache: "no-store"
        });
      } else {
        response = await fetch("/api/import", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
          cache: "no-store"
        });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Import failed (${response.status})`);
      }

      setCsvProgress({
        done: result.totalRows || 0,
        total: result.totalRows || 0,
        failed: result.skipped || 0
      });
      setCsvRows([]);
      setImportFile(null);
      setSheetUrl("");
      setLeads(await api("/api/leads"));
      setQueueRefreshKey((value) => value + 1);
      setNotice(
        `${result.imported || 0} imported, ${result.duplicates || 0} duplicates, ` +
        `${result.skipped || 0} skipped. AI requests sent: 0.`
      );
    });
  }

  const filteredLeads = leads.filter((lead) => {
    const matchesStatus =
      statusFilter === "All" ||
      lead.status === statusFilter;

    const term = search.toLowerCase().trim();

    const matchesSearch =
      !term ||
      [
        getQueryId(lead),
        lead.name,
        lead.phone,
        lead.message,
        lead.interest,
        lead.source
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

    return matchesStatus && matchesSearch;
  });

  const sortedLeads = [...filteredLeads].sort(
    (a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
  );

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2
          size={30}
          className="animate-spin text-emerald-600"
        />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-7 text-center">
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
        queueRefreshKey={queueRefreshKey}
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

          {tab === "AI Queue" && (
            <AIQueue
              leads={leads}
              onRefresh={async () => {
                await refresh();
                setQueueRefreshKey((value) => value + 1);
              }}
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
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold">
                  Enquiries
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review customer messages, replies and reminders.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Search name, phone, query ID..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="All">All Statuses</option>
                  {STAGES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {sortedLeads.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                  No enquiries found.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedLeads.map((lead) => {
                    const expanded = expandedId === lead.id;
                    const reply =
                      lead.reply ||
                      lead.suggestedReply ||
                      "";

                    const reminderState =
                      getReminderState(lead);

                    return (
                      <div
                        key={lead.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-emerald-700">
                              {getQueryId(lead)}
                            </p>

                            <h3 className="mt-1 font-semibold">
                              {lead.name || "Not Provided"}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {lead.phone || "Phone not provided"} ·{" "}
                              {lead.interest || "Unknown"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                              {lead.status || "New"}
                            </span>

                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                              {getReplyStatus(lead)}
                            </span>

                            <button
                              onClick={() =>
                                setExpandedId(
                                  expanded ? "" : lead.id
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium"
                            >
                              {expanded ? "Close" : "Details"}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="space-y-5 border-t border-slate-100 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-slate-500">
                                  Phone Number
                                </p>

                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-sm">
                                    {lead.phone || "Not Provided"}
                                  </span>

                                  {lead.phone && (
                                    <button
                                      onClick={() =>
                                        copyText(lead.phone)
                                      }
                                      className="text-emerald-700"
                                    >
                                      <Copy size={15} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500">
                                  Received
                                </p>

                                <p className="mt-1 text-sm">
                                  {formatDate(
                                    lead.receivedAt ||
                                    lead.createdAt
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-4">
                              <p className="mb-2 text-xs font-semibold text-slate-500">
                                Customer Message
                              </p>

                              <p className="whitespace-pre-wrap break-words text-sm">
                                {lead.message}
                              </p>
                            </div>

                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">
                                  AI Suggested Reply
                                </p>

                                <button
                                  onClick={() => copyText(reply)}
                                  disabled={!reply}
                                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 disabled:opacity-40"
                                >
                                  <Copy size={14} />
                                  Copy Reply
                                </button>
                              </div>

                              <p className="whitespace-pre-wrap break-words text-sm">
                                {reply || "No reply generated yet."}
                              </p>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  disabled={
                                    loading ||
                                    getReplyStatus(lead) === "Replied"
                                  }
                                  onClick={() =>
                                    updateLead(lead.id, {
                                      replyStatus: "Replied"
                                    })
                                  }
                                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  <Check size={14} />
                                  Mark as Replied
                                </button>

                                <button
                                  onClick={() => editLead(lead)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                                >
                                  Edit Reply / Details
                                </button>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block text-sm">
                                Pipeline Status

                                <select
                                  value={lead.status || "New"}
                                  disabled={loading}
                                  onChange={(e) =>
                                    updateLead(lead.id, {
                                      status: e.target.value
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                >
                                  {STAGES.map((status) => (
                                    <option
                                      key={status}
                                      value={status}
                                    >
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div>
                                <label className="flex items-center gap-2 text-sm">
                                  <CalendarClock size={16} />
                                  Reminder Date & Time
                                </label>

                                <input
                                  type="datetime-local"
                                  value={dateTimeLocal(
                                    lead.followUpAt
                                  )}
                                  disabled={loading}
                                  onChange={(e) =>
                                    updateLead(lead.id, {
                                      followUpAt: e.target.value
                                        ? new Date(
                                            e.target.value
                                          ).toISOString()
                                        : "",
                                      reminderCompleted: false
                                    })
                                  }
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                />

                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">
                                    {reminderState}
                                  </span>

                                  {lead.followUpAt &&
                                    !lead.reminderCompleted && (
                                      <button
                                        disabled={loading}
                                        onClick={() =>
                                          updateLead(lead.id, {
                                            reminderCompleted: true
                                          })
                                        }
                                        className="text-xs font-semibold text-emerald-700"
                                      >
                                        Mark Completed
                                      </button>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end border-t border-slate-100 pt-4">
                              <button
                                onClick={() =>
                                  deleteLead(lead.id)
                                }
                                disabled={loading}
                                className="flex items-center gap-2 text-xs font-medium text-red-600 disabled:opacity-50"
                              >
                                <Trash2 size={15} />
                                Delete Enquiry
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "Pipeline" && (
            <CustomerPipeline
              leads={leads}
              loading={loading}
              onUpdateLead={updateLead}
              onEditLead={editLead}
            />
          )}

          {tab === "Import CSV" && (
            <div className="mx-auto max-w-3xl space-y-5">
              <div>
                <h1 className="text-2xl font-bold">
                  Import Enquiries
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Import customer enquiries without calling Gemini. Process them later in AI Queue.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                    <FileSpreadsheet size={23} />
                  </div>

                  <div>
                    <h2 className="font-semibold">
                      CSV / Excel File
                    </h2>

                    <p className="text-xs text-slate-500">
                      Upload CSV/XLSX/XLS, or import a public Google Sheets link.
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  disabled={loading}
                  onChange={(e) =>
                    loadCSV(e.target.files?.[0])
                  }
                  className="block w-full rounded-xl border border-dashed border-slate-300 p-5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-700"
                />

                <p className="mt-3 text-xs text-slate-500">
                  Required column: message. Optional columns:
                  name, phone, source, sampleId.
                </p>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold">Public Google Sheets URL</label>
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>

                {(importFile || sheetUrl.trim()) && (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm font-semibold">
                        {importFile ? `${importFile.name} ready` : "Google Sheet ready"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Each row will be analyzed by AI and
                        saved to Firestore.
                      </p>
                    </div>

                    <button
                      onClick={importCSV}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Upload size={17} />
                      )}

                      Import to AI Queue
                    </button>
                  </div>
                )}

                {csvProgress.total > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs text-slate-500">
                      <span>Processing Progress</span>

                      <span>
                        {csvProgress.done} /{" "}
                        {csvProgress.total}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{
                          width: `${
                            (csvProgress.done /
                              csvProgress.total) *
                            100
                          }%`
                        }}
                      />
                    </div>

                    {csvProgress.failed > 0 && (
                      <p className="mt-2 text-xs text-red-600">
                        Failed: {csvProgress.failed}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} BIAI CRM ·
            Next.js, Firebase & n8n
          </footer>
        </main>
      </div>
    </div>
  );
}
