
"use client";

import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  KanbanSquare,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  ListChecks
} from "lucide-react";

const menu = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Enquiries", icon: Users },
  { name: "AI Queue", icon: ListChecks },
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
  setMobileOpen,
  queueRefreshKey = 0
}) {
  const [queueCounts, setQueueCounts] = useState({
    Pending: 0,
    Processing: 0,
    Completed: 0,
    Failed: 0
  });

  const [queueLoading, setQueueLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function loadQueueCounts() {
      try {
        const response = await fetch("/api/queue", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(
            "Unable to load queue counts."
          );
        }

        const data = await response.json();

        if (active && data.counts) {
          setQueueCounts({
            Pending: data.counts.Pending || 0,
            Processing: data.counts.Processing || 0,
            Completed: data.counts.Completed || 0,
            Failed: data.counts.Failed || 0
          });
        }
      } catch (error) {
        console.error(
          "Sidebar queue count error:",
          error
        );
      } finally {
        if (active) {
          setQueueLoading(false);
        }
      }
    }

    loadQueueCounts();

    // Refresh count every 15 seconds.
    const interval = setInterval(
      loadQueueCounts,
      15000
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [queueRefreshKey]);

  const pendingCount = queueCounts.Pending;

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
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Brand */}
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

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            Workspace
          </p>

          <nav className="space-y-1.5">
            {menu.map(({ name, icon: Icon }) => {
              const isQueue = name === "AI Queue";
              const isActive = tab === name;

              return (
                <button
                  key={name}
                  title={
                    isQueue
                      ? `AI Queue — ${pendingCount} pending`
                      : name
                  }
                  onClick={() => {
                    setTab(name);
                    setMobileOpen(false);
                  }}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    size={19}
                    className="shrink-0"
                  />

                  <span
                    className={`flex-1 text-left ${
                      collapsed ? "lg:hidden" : ""
                    }`}
                  >
                    {name}
                  </span>

                  {isQueue && !queueLoading && (
                    <span
                      className={`flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        pendingCount > 0
                          ? "bg-amber-400 text-slate-950"
                          : "bg-white/10 text-slate-300"
                      } ${
                        collapsed
                          ? "lg:absolute lg:right-1 lg:top-1 lg:min-w-4 lg:px-1 lg:text-[9px]"
                          : ""
                      }`}
                    >
                      {pendingCount > 99
                        ? "99+"
                        : pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Queue Summary */}
          <div
            className={`mt-5 rounded-xl border border-white/10 bg-white/5 p-3 ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                AI Queue Status
              </span>

              <ListChecks
                size={15}
                className="text-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-amber-400/10 p-2">
                <p className="text-[10px] text-amber-300">
                  Pending
                </p>
                <p className="mt-1 text-lg font-bold text-amber-300">
                  {queueCounts.Pending}
                </p>
              </div>

              <div className="rounded-lg bg-emerald-400/10 p-2">
                <p className="text-[10px] text-emerald-300">
                  Completed
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-300">
                  {queueCounts.Completed}
                </p>
              </div>

              <div className="rounded-lg bg-blue-400/10 p-2">
                <p className="text-[10px] text-blue-300">
                  Processing
                </p>
                <p className="mt-1 text-lg font-bold text-blue-300">
                  {queueCounts.Processing}
                </p>
              </div>

              <div className="rounded-lg bg-rose-400/10 p-2">
                <p className="text-[10px] text-rose-300">
                  Failed
                </p>
                <p className="mt-1 text-lg font-bold text-rose-300">
                  {queueCounts.Failed}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
            onClick={() =>
              setCollapsed(!collapsed)
            }
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
