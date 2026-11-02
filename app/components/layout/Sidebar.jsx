
"use client";

import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  KanbanSquare,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles
} from "lucide-react";

const menu = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Enquiries", icon: Users },
  { name: "AI Processor", icon: BrainCircuit },
  { name: "Pipeline", icon: KanbanSquare },
  { name: "Import CSV", icon: Upload }
];

export default function Sidebar({
  tab,
  setTab,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen
}) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0B1220] text-white transition-all duration-300
          ${collapsed ? "lg:w-20" : "lg:w-64"}
          w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 rounded-xl bg-emerald-600 p-2.5">
              <BrainCircuit size={23} />
            </div>

            <div className={collapsed ? "lg:hidden" : ""}>
              <h1 className="whitespace-nowrap text-lg font-extrabold">
                BIAI CRM
              </h1>
              <p className="whitespace-nowrap text-[10px] text-slate-400">
                AI Lead Intelligence
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            Workspace
          </p>

          <nav className="space-y-1.5">
            {menu.map(({ name, icon: Icon }) => (
              <button
                key={name}
                title={name}
                onClick={() => {
                  setTab(name);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  tab === name
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={19} className="shrink-0" />

                <span className={collapsed ? "lg:hidden" : ""}>
                  {name}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t border-white/10 p-3">
          <div
            className={`mb-3 rounded-xl bg-emerald-500/10 p-3 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Sparkles size={15} />
              AI Workspace
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              Analyze enquiries with n8n and Gemini.
            </p>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden w-full items-center justify-center rounded-xl bg-white/5 p-3 text-slate-400 hover:bg-white/10 lg:flex"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <ChevronRight size={19} />
            ) : (
              <ChevronLeft size={19} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
