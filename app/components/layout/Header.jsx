
"use client";

import {
  Menu,
  RefreshCw,
  Plus,
  CircleUserRound
} from "lucide-react";

export default function Header({
  tab,
  loading,
  refresh,
  setMobileOpen,
  onNewLead,
  sessionId
}) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
            {tab}
          </h1>

          <p className="hidden text-xs text-slate-500 sm:block">
            Intelligent Customer Relationship Management
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
        </button>

        <button
          onClick={onNewLead}
          className="hidden items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex"
        >
          <Plus size={17} />
          New Enquiry
        </button>

        <div
          title={sessionId ? `Session: ${sessionId}` : "Anonymous session"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"
        >
          <CircleUserRound size={23} />
        </div>
      </div>
    </header>
  );
}
