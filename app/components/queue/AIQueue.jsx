"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Play, CheckCircle2, AlertCircle, Clock3, Loader2 } from "lucide-react";

const STATES = ["Pending", "Processing", "Completed", "Failed"];
const COLORS = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Failed: "bg-red-50 text-red-700 border-red-200"
};

function aiState(lead) {
  return lead.aiStatus || (lead.reply || lead.suggestedReply ? "Completed" : "Pending");
}

export default function AIQueue({ leads = [], onRefresh, onEditLead }) {
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState(null);

  async function refreshCounts() {
    try {
      const response = await fetch("/api/queue", { cache: "no-store" });
      if (!response.ok) throw new Error("Queue counts unavailable.");
      const data = await response.json();
      setCounts(data.counts || null);
    } catch (err) {
      console.error("Queue counts:", err);
    }
  }

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 15000);
    return () => clearInterval(interval);
  }, [leads]);

  const visible = useMemo(() => leads.filter((lead) => filter === "All" || aiState(lead) === filter), [leads, filter]);
  const localCounts = useMemo(() => Object.fromEntries(STATES.map((state) => [state, leads.filter((lead) => aiState(lead) === state).length])), [leads]);
  const displayCounts = counts || localCounts;

  function toggle(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 10 ? [...current, id] : current);
  }

  async function processSelected() {
    if (!selected.length || working) return;
    setWorking(true);
    setResult("");
    setError("");
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Queue processing failed.");
      setResult(`${data.completed || 0} completed, ${data.failed || 0} failed, ${data.skipped || 0} skipped.`);
      setSelected([]);
      await onRefresh?.();
      await refreshCounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Queue</h1>
          <p className="mt-1 text-sm text-slate-500">Review imported enquiries and process up to 10, sequentially.</p>
        </div>
        <button onClick={async () => { await onRefresh?.(); await refreshCounts(); }} disabled={working} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16}/> Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATES.map((state) => (
          <button key={state} onClick={() => setFilter(state)} className={`rounded-2xl border p-4 text-left ${COLORS[state]} ${filter === state ? "ring-2 ring-offset-2 ring-emerald-500" : ""}`}>
            <p className="text-sm font-semibold">{state}</p>
            <p className="mt-2 text-3xl font-bold">{displayCounts[state] || 0}</p>
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{result}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{filter} enquiries</span>
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setSelected([]); }} className="rounded-lg border p-2 text-sm">
              <option value="All">All</option>
              {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <button onClick={processSelected} disabled={working || selected.length === 0} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {working ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
            Process Selected ({selected.length}/10)
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Select</th><th className="p-4">Customer</th><th className="p-4">Phone</th><th className="p-4">Source</th><th className="p-4">Message</th><th className="p-4">Received</th><th className="p-4">AI Status</th><th className="p-4">Action</th></tr></thead>
            <tbody className="divide-y">
              {visible.map((lead) => {
                const state = aiState(lead);
                const eligible = state === "Pending" || state === "Failed";
                return <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="p-4"><input type="checkbox" aria-label={`Select ${lead.name || lead.id}`} checked={selected.includes(lead.id)} disabled={working || !eligible || (!selected.includes(lead.id) && selected.length >= 10)} onChange={() => toggle(lead.id)}/></td>
                  <td className="p-4 font-medium">{lead.name || "Not provided"}<p className="text-xs text-slate-400">{lead.queryId || lead.id}</p></td>
                  <td className="p-4">{lead.phone || "—"}</td>
                  <td className="p-4">{lead.source || "Other"}</td>
                  <td className="max-w-xs truncate p-4" title={lead.message}>{lead.message}</td>
                  <td className="p-4 text-xs">{lead.receivedAt ? new Date(lead.receivedAt).toLocaleString("en-BD") : "—"}</td>
                  <td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${COLORS[state] || ""}`}>{state}</span>{lead.aiError && <p className="mt-2 max-w-40 break-words text-xs text-red-600">{lead.aiError}</p>}</td>
                  <td className="p-4"><button onClick={() => onEditLead?.(lead)} className="text-xs font-semibold text-emerald-700">Open details</button></td>
                </tr>;
              })}
              {visible.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No enquiries in this queue.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">Manual processing sends one enquiry at a time to n8n. Automatic mode will be added separately. Counts reflect the current API limit of 500 records.</p>
    </section>
  );
}
