"use client";

import { useMemo, useState } from "react";
import {
  Search, Phone, CalendarClock, ChevronDown, ChevronUp,
  ArrowUpRight, Check, XCircle, Clock3, MessageSquare,
  History, Filter
} from "lucide-react";

const STAGES = ["New", "Contacted", "Interested", "Paid", "Lost"];
const PATH = ["New", "Contacted", "Interested"];
const colors = {
  New: "bg-slate-100 text-slate-700 border-slate-200",
  Contacted: "bg-blue-50 text-blue-700 border-blue-200",
  Interested: "bg-amber-50 text-amber-700 border-amber-200",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Lost: "bg-rose-50 text-rose-700 border-rose-200"
};

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" });
}

function queryId(lead) {
  return lead.queryId || `BIAI-${String(lead.id || "").slice(0, 8).toUpperCase()}`;
}

function Journey({ status }) {
  const current = STAGES.includes(status) ? status : "New";
  const currentIndex = PATH.indexOf(current);
  const terminal = current === "Paid" || current === "Lost";
  const completedIndex = terminal ? PATH.length - 1 : currentIndex;
  const nodes = [...PATH, current === "Lost" ? "Lost" : "Paid"];

  return (
    <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
      <div className="flex items-start">
        {nodes.map((stage, index) => {
          const done = index < completedIndex || (terminal && index < 3);
          const active = stage === current;
          const finalLost = stage === "Lost";
          const dot = active
            ? finalLost ? "bg-rose-500 ring-4 ring-rose-100" : "bg-blue-600 ring-4 ring-blue-100"
            : done ? "bg-emerald-500" : "bg-slate-200";
          return (
            <div key={stage} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${dot}`}>
                  {done ? <Check size={13} className="text-white" strokeWidth={3} /> : active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
                <span className={`text-center text-[10px] font-semibold sm:text-xs ${active ? "text-slate-900" : "text-slate-500"}`}>{stage}</span>
              </div>
              {index < nodes.length - 1 && (
                <div className={`mt-[11px] h-[3px] w-full flex-1 rounded-full ${index < completedIndex ? "bg-emerald-500" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      {current === "Lost" && <p className="mt-3 text-center text-xs font-medium text-rose-700">Closed as Lost — payment not completed</p>}
    </div>
  );
}

export default function CustomerPipeline({ leads = [], loading = false, onUpdateLead, onEditLead }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => Object.fromEntries(STAGES.map(s => [s, leads.filter(l => (l.status || "New") === s).length])), [leads]);
  const visible = useMemo(() => leads.filter(lead => {
    const status = lead.status || "New";
    const matchesStatus = filter === "All" || filter === status;
    const q = search.trim().toLowerCase();
    const matchesText = !q || [queryId(lead), lead.name, lead.phone, lead.message, lead.interest, lead.source].join(" ").toLowerCase().includes(q);
    return matchesStatus && matchesText;
  }).sort((a,b) => String(b.receivedAt || b.createdAt || "").localeCompare(String(a.receivedAt || a.createdAt || ""))), [leads, filter, search]);

  async function changeStage(lead, status) {
    if (status === (lead.status || "New") || busyId) return;
    setError("");
    setBusyId(lead.id);
    try {
      await onUpdateLead(lead.id, { status });
    } catch (err) {
      setError(err?.message || "Could not update pipeline stage.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Customer Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Follow every customer from enquiry to payment or lost outcome.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">{leads.length} Customers</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STAGES.map(stage => (
          <button key={stage} type="button" onClick={() => setFilter(filter === stage ? "All" : stage)} className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${filter === stage ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200"} bg-white`}>
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stage === "Paid" ? "bg-emerald-500" : stage === "Lost" ? "bg-rose-500" : stage === "Interested" ? "bg-amber-500" : stage === "Contacted" ? "bg-blue-500" : "bg-slate-400"}`} /><span className="text-xs font-semibold text-slate-500">{stage}</span></div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{counts[stage]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={17} className="absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, message, query ID..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
        <label className="relative"><Filter size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><select value={filter} onChange={e => setFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-6 text-sm sm:w-44"><option value="All">All stages</option>{STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {visible.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No customers match this filter.</div> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map(lead => {
            const status = STAGES.includes(lead.status) ? lead.status : "New";
            const open = !!expanded[lead.id];
            const history = Array.isArray(lead.stageHistory) ? lead.stageHistory : [];
            return <article key={lead.id} className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-[11px] font-bold text-emerald-700">{queryId(lead)}</p><h2 className="mt-1 break-words text-base font-bold text-slate-900">{lead.name || "Name not provided"}</h2><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone size={12} />{lead.phone || "Phone not provided"}</p></div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${colors[status]}`}>{status}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{lead.source || "Other"}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{lead.interest || "Unknown"}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">AI: {lead.aiStatus || (lead.reply ? "Completed" : "Pending")}</span></div>
              <p className="line-clamp-2 min-h-9 break-words text-sm leading-5 text-slate-600"><MessageSquare size={14} className="mr-1 inline text-slate-400" />{lead.message || "No message"}</p>
              <Journey status={status} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Update stage<select value={status} disabled={loading || !!busyId} onChange={e => changeStage(lead, e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-800 disabled:opacity-60">{STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                <button type="button" onClick={() => onEditLead?.(lead)} className="mt-5 inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Open details <ArrowUpRight size={14}/></button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock3 size={13}/>Received: {formatDate(lead.receivedAt || lead.createdAt)}</span><span className="flex items-center gap-1"><CalendarClock size={13}/>Follow-up: {formatDate(lead.followUpAt)}</span></div>
              <button type="button" onClick={() => setExpanded(prev => ({...prev, [lead.id]: !prev[lead.id]}))} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"><span className="flex items-center gap-2"><History size={15}/>Stage history ({history.length})</span>{open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
              {open && <div className="space-y-3 border-l-2 border-emerald-200 pl-4">{history.length ? history.slice().reverse().map((event, index) => <div key={`${event.changedAt || "history"}-${index}`} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"/><p className="font-semibold text-slate-800">{event.from ? `${event.from} → ` : ""}{event.to || "New"}</p><p className="mt-1 text-slate-500">{event.changedBy || "Employee"} · {formatDate(event.changedAt)}</p></div>) : <p className="text-xs text-slate-500">No stage changes recorded yet.</p>}</div>}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
