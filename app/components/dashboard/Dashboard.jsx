
"use client";

import {
  Users,
  TrendingUp,
  CheckCircle2,
  Clock3,
  BrainCircuit,
  Upload,
  ArrowUpRight,
  Plus
} from "lucide-react";

import StatCard from "./StatCard";
import ActivityChart from "./ActivityChart";

export default function Dashboard({
  leads,
  onNewLead,
  setTab,
  onEditLead
}) {
  const sales = leads.filter((lead) =>
    lead.type === "Sales" || lead.category === "Sales"
  );

  const interested = sales.filter(
    (lead) => lead.status === "Interested"
  );

  const paid = sales.filter(
    (lead) => lead.status === "Paid"
  );

  const followUps = leads.filter(
    (lead) =>
      lead.followUpRequired ||
      (
        lead.followUpAt &&
        new Date(lead.followUpAt) <= new Date() &&
        !["Paid", "Lost"].includes(lead.status)
      )
  );

  const recent = [...leads]
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            CRM Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor enquiries, AI processing and sales activity.
          </p>
        </div>

        <button
          onClick={onNewLead}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={18} />
          New Enquiry
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Total Enquiries"
          value={leads.length}
          icon={Users}
          description="All saved customer enquiries"
          color="blue"
        />

        <StatCard
          title="Sales Leads"
          value={sales.length}
          icon={TrendingUp}
          description="Potential training customers"
          color="purple"
        />

        <StatCard
          title="Interested"
          value={interested.length}
          icon={Clock3}
          description="Leads interested in your programs"
          color="amber"
        />

        <StatCard
          title="Paid"
          value={paid.length}
          icon={CheckCircle2}
          description="Completed sales"
          color="emerald"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityChart leads={leads} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">
            Quick Actions
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Complete your tasks faster
          </p>

          <div className="mt-5 space-y-3">
            <button
              onClick={onNewLead}
              className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <BrainCircuit size={21} />
              AI Auto Process
              <ArrowUpRight size={16} className="ml-auto" />
            </button>

            <button
              onClick={() => setTab("Import CSV")}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold hover:bg-slate-50"
            >
              <Upload size={21} />
              Import CSV
              <ArrowUpRight size={16} className="ml-auto" />
            </button>

            <button
              onClick={() => setTab("Enquiries")}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold hover:bg-slate-50"
            >
              <Users size={21} />
              View All Leads
              <ArrowUpRight size={16} className="ml-auto" />
            </button>
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              Follow-ups flagged
            </p>
            <p className="mt-1 text-2xl font-bold">
              {followUps.length}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">
            Recent Enquiries
          </h3>

          <button
            onClick={() => setTab("Enquiries")}
            className="text-sm font-semibold text-emerald-700 hover:underline"
          >
            View all
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No enquiries yet. Add your first customer message.
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {lead.name || "Unknown Customer"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {lead.interest || "General"} · {lead.source}
                  </p>
                </div>

                <button
                  onClick={() => onEditLead(lead)}
                  className="text-xs font-semibold text-emerald-700"
                >
                  Open details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
