
"use client";

import { useMemo, useState } from "react";
import {
  Users,
  MessageSquare,
  Clock3,
  CheckCircle2,
  Plus,
  ArrowRight,
  CalendarClock,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Activity,
  BarChart3,
  Layers3,
  RefreshCw,
  CircleCheck,
  CircleDot,
  CircleX,
  Zap,
  ChevronRight,
  Inbox,
  Send,
  Filter
} from "lucide-react";

const STAGES = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost"
];

const STAGE_COLORS = {
  New: "#64748b",
  Contacted: "#3b82f6",
  Interested: "#f59e0b",
  Paid: "#10b981",
  Lost: "#ef4444"
};

const AI_COLORS = {
  Pending: "#f59e0b",
  Processing: "#3b82f6",
  Completed: "#10b981",
  Failed: "#ef4444"
};

const formatNumber = (value) =>
  new Intl.NumberFormat("en-BD").format(value);

const formatDate = (value) => {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const getQueryId = (lead) =>
  lead.queryId ||
  `BIAI-${String(lead.id || "").slice(0, 8).toUpperCase()}`;

const getReplyStatus = (lead) => {
  if (lead.replyStatus === "Replied") return "Replied";
  if (lead.reply || lead.suggestedReply) return "Reply Ready";
  return "Pending";
};

const getAIStatus = (lead) => {
  if (
    ["Pending", "Processing", "Completed", "Failed"].includes(
      lead.aiStatus
    )
  ) {
    return lead.aiStatus;
  }

  return lead.reply || lead.suggestedReply
    ? "Completed"
    : "Pending";
};

const getLeadDate = (lead) => {
  const value = lead.receivedAt || lead.createdAt;
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
};

const percentage = (part, total) =>
  total > 0 ? (part / total) * 100 : 0;

const countBy = (items, field, fallback = "Unknown") => {
  const counts = {};

  for (const item of items) {
    const value = String(item[field] || fallback).trim();
    const key = value || fallback;
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  color = "emerald",
  onClick
}) {
  const themes = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600"
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">
          {label}
        </span>
        <div
          className={`rounded-xl p-2.5 ${
            themes[color] || themes.emerald
          }`}
        >
          <Icon size={19} />
        </div>
      </div>

      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </>
  );

  const classes =
    "rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md";

  return onClick ? (
    <button onClick={onClick} className={classes}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

function ProgressRow({
  label,
  count,
  total,
  color = "#10b981"
}) {
  const value = percentage(count, total);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-700">
          {label}
        </span>
        <span className="font-semibold text-slate-800">
          {count}
          <span className="ml-2 font-normal text-slate-400">
            {value.toFixed(1)}%
          </span>
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${value}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}

function TrendChart({ data }) {
  const width = 700;
  const height = 230;
  const left = 32;
  const right = 12;
  const top = 20;
  const bottom = 38;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const maxValue = Math.max(
    1,
    ...data.map((item) => item.count)
  );

  const getX = (index) =>
    left +
    (data.length === 1
      ? chartWidth / 2
      : (index / (data.length - 1)) * chartWidth);

  const getY = (value) =>
    top + chartHeight - (value / maxValue) * chartHeight;

  const points = data.map((item, index) => ({
    x: getX(index),
    y: getY(item.count)
  }));

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${
        top + chartHeight
      } L ${points[0].x} ${top + chartHeight} Z`
    : "";

  const labelStep = Math.max(
    1,
    Math.ceil(data.length / 7)
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Daily enquiry trend"
      >
        <defs>
          <linearGradient
            id="dashboardTrendFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#10b981"
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor="#10b981"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const value = maxValue * (1 - step);
          const y = top + chartHeight * step;

          return (
            <g key={step}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 5"
              />
              <text
                x={left - 7}
                y={y + 4}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
              >
                {Number.isInteger(value)
                  ? value
                  : value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <path
            d={areaPath}
            fill="url(#dashboardTrendFill)"
          />
        )}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => (
          <g key={data[index].date}>
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#059669"
            >
              <title>
                {`${data[index].date}: ${data[index].count} enquiries`}
              </title>
            </circle>

            {(index % labelStep === 0 ||
              index === data.length - 1) && (
              <text
                x={point.x}
                y={height - 10}
                fontSize="10"
                fill="#64748b"
                textAnchor="middle"
              >
                {data[index].label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    New: "bg-slate-100 text-slate-700",
    Contacted: "bg-blue-50 text-blue-700",
    Interested: "bg-amber-50 text-amber-700",
    Paid: "bg-emerald-50 text-emerald-700",
    Lost: "bg-rose-50 text-rose-700"
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        styles[status] || styles.New
      }`}
    >
      {status || "New"}
    </span>
  );
}

export default function Dashboard({
  leads = [],
  onNewLead,
  setTab,
  onEditLead
}) {
  const [period, setPeriod] = useState("30");
  const [sourceFilter, setSourceFilter] = useState("All");

  const now = new Date();

  const sources = useMemo(
    () => [
      "All",
      ...new Set(
        leads.map((lead) => lead.source || "Other")
      )
    ],
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    cutoff.setHours(0, 0, 0, 0);

    return leads.filter((lead) => {
      const sourceMatches =
        sourceFilter === "All" ||
        (lead.source || "Other") === sourceFilter;

      if (!sourceMatches) return false;

      if (period === "All") return true;

      const date = getLeadDate(lead);

      return date && date >= cutoff && date <= now;
    });
  }, [leads, period, sourceFilter]);

  const analytics = useMemo(() => {
    const total = filteredLeads.length;

    const stageCounts = Object.fromEntries(
      STAGES.map((stage) => [
        stage,
        filteredLeads.filter(
          (lead) => (lead.status || "New") === stage
        ).length
      ])
    );

    const aiCounts = Object.fromEntries(
      ["Pending", "Processing", "Completed", "Failed"].map(
        (status) => [
          status,
          filteredLeads.filter(
            (lead) => getAIStatus(lead) === status
          ).length
        ]
      )
    );

    const replyCounts = {
      Pending: 0,
      "Reply Ready": 0,
      Replied: 0
    };

    for (const lead of filteredLeads) {
      replyCounts[getReplyStatus(lead)]++;
    }

    const activeReminders = filteredLeads
      .filter((lead) => {
        if (!lead.followUpAt || lead.reminderCompleted) {
          return false;
        }

        if (["Paid", "Lost"].includes(lead.status)) {
          return false;
        }

        return !Number.isNaN(
          new Date(lead.followUpAt).getTime()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.followUpAt) -
          new Date(b.followUpAt)
      );

    const dueReminders = activeReminders.filter(
      (lead) => new Date(lead.followUpAt) <= now
    );

    const recent = [...filteredLeads]
      .sort(
        (a, b) =>
          (getLeadDate(b)?.getTime() || 0) -
          (getLeadDate(a)?.getTime() || 0)
      )
      .slice(0, 7);

    const trendDays =
      period === "7" ? 7 :
      period === "90" ? 90 :
      period === "All" ? 30 : 30;

    const trend = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      const count = filteredLeads.filter((lead) => {
        const leadDate = getLeadDate(lead);

        return (
          leadDate &&
          leadDate.getFullYear() === year &&
          leadDate.getMonth() === month &&
          leadDate.getDate() === day
        );
      }).length;

      trend.push({
        date: date.toISOString(),
        label: date.toLocaleDateString("en-BD", {
          month: "short",
          day: "numeric"
        }),
        count
      });
    }

    return {
      total,
      stageCounts,
      aiCounts,
      replyCounts,
      activeReminders,
      dueReminders,
      recent,
      trend,
      sources: countBy(filteredLeads, "source", "Other"),
      interests: countBy(
        filteredLeads,
        "interest",
        "Unknown"
      ),
      priorities: countBy(
        filteredLeads,
        "priority",
        "Unassigned"
      ),
      sentiments: countBy(
        filteredLeads,
        "sentiment",
        "Unassigned"
      )
    };
  }, [filteredLeads]);

  const conversionRate = percentage(
    analytics.stageCounts.Paid,
    analytics.total
  );

  const replyRate = percentage(
    analytics.replyCounts.Replied,
    analytics.total
  );

  const aiCompletionRate = percentage(
    analytics.aiCounts.Completed,
    analytics.total
  );

  const openLeads =
    analytics.stageCounts.New +
    analytics.stageCounts.Contacted +
    analytics.stageCounts.Interested;

  const topSource = analytics.sources[0];

  const navigate = (page) => {
    if (typeof setTab === "function") setTab(page);
  };

  const edit = (lead) => {
    if (typeof onEditLead === "function") {
      onEditLead(lead);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              CRM Intelligence
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            Executive Dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Customer activity, pipeline performance and AI operations.
          </p>
        </div>

        <button
          onClick={onNewLead}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <Plus size={17} />
          New Enquiry
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <Filter size={17} className="text-slate-400" />

        <select
          value={period}
          onChange={(event) =>
            setPeriod(event.target.value)
          }
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="All">All Time</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(event.target.value)
          }
          className="max-w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
        >
          {sources.map((source) => (
            <option key={source} value={source}>
              {source === "All" ? "All Sources" : source}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-slate-500">
          {formatNumber(analytics.total)} matching enquiries
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total Enquiries"
          value={formatNumber(analytics.total)}
          icon={Users}
          detail="Customer records"
          color="blue"
          onClick={() => navigate("Enquiries")}
        />

        <MetricCard
          label="Open Pipeline"
          value={formatNumber(openLeads)}
          icon={Layers3}
          detail="New, contacted & interested"
          color="violet"
          onClick={() => navigate("Pipeline")}
        />

        <MetricCard
          label="Paid Customers"
          value={formatNumber(analytics.stageCounts.Paid)}
          icon={CheckCircle2}
          detail={`${conversionRate.toFixed(1)}% conversion rate`}
          color="emerald"
          onClick={() => navigate("Pipeline")}
        />

        <MetricCard
          label="AI Pending"
          value={formatNumber(analytics.aiCounts.Pending)}
          icon={BrainCircuit}
          detail="Waiting for analysis"
          color="amber"
          onClick={() => navigate("AI Queue")}
        />

        <MetricCard
          label="Pending Replies"
          value={formatNumber(analytics.replyCounts.Pending)}
          icon={MessageSquare}
          detail="No reply prepared"
          color="slate"
          onClick={() => navigate("Enquiries")}
        />

        <MetricCard
          label="Reply Ready"
          value={formatNumber(
            analytics.replyCounts["Reply Ready"]
          )}
          icon={Send}
          detail={`${replyRate.toFixed(1)}% already replied`}
          color="blue"
          onClick={() => navigate("Enquiries")}
        />

        <MetricCard
          label="Due Follow-ups"
          value={formatNumber(
            analytics.dueReminders.length
          )}
          icon={CalendarClock}
          detail="Need attention"
          color="rose"
        />

        <MetricCard
          label="AI Completed"
          value={formatNumber(analytics.aiCounts.Completed)}
          icon={Zap}
          detail={`${aiCompletionRate.toFixed(1)}% of enquiries`}
          color="emerald"
          onClick={() => navigate("AI Queue")}
        />
      </div>

      {/* Trend and Conversion */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel
          title="Enquiry Activity"
          subtitle="Daily customer enquiries over time"
          className="xl:col-span-2"
          action={
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <Activity size={15} />
              Activity Trend
            </div>
          }
        >
          <div className="p-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  {formatNumber(
                    analytics.trend.reduce(
                      (sum, item) => sum + item.count,
                      0
                    )
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Enquiries within chart period
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Daily enquiries
              </div>
            </div>

            <TrendChart data={analytics.trend} />
          </div>
        </Panel>

        <Panel
          title="Conversion Performance"
          subtitle="Paid outcomes and customer engagement"
        >
          <div className="space-y-6 p-5">
            <div className="flex justify-center">
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#10b981 ${conversionRate}%, #e2e8f0 ${conversionRate}% 100%)`
                }}
              >
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
                  <p className="text-3xl font-extrabold text-slate-900">
                    {conversionRate.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Conversion
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <ProgressRow
                label="Paid Conversion"
                count={analytics.stageCounts.Paid}
                total={analytics.total}
                color="#10b981"
              />

              <ProgressRow
                label="Customer Reply Rate"
                count={analytics.replyCounts.Replied}
                total={analytics.total}
                color="#3b82f6"
              />

              <ProgressRow
                label="AI Completion"
                count={analytics.aiCounts.Completed}
                total={analytics.total}
                color="#8b5cf6"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Pipeline and AI */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Sales Pipeline"
          subtitle="Current stage distribution"
          action={
            <button
              onClick={() => navigate("Pipeline")}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700"
            >
              Open Pipeline
              <ArrowRight size={14} />
            </button>
          }
        >
          <div className="space-y-5 p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {STAGES.map((stage) => (
                <div
                  key={stage}
                  title={`${stage}: ${analytics.stageCounts[stage]}`}
                  style={{
                    width: `${percentage(
                      analytics.stageCounts[stage],
                      analytics.total
                    )}%`,
                    backgroundColor: STAGE_COLORS[stage]
                  }}
                />
              ))}
            </div>

            {STAGES.map((stage) => (
              <ProgressRow
                key={stage}
                label={stage}
                count={analytics.stageCounts[stage]}
                total={analytics.total}
                color={STAGE_COLORS[stage]}
              />
            ))}
          </div>
        </Panel>

        <Panel
          title="AI Operations"
          subtitle="Processing status across enquiries"
          action={
            <button
              onClick={() => navigate("AI Queue")}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700"
            >
              Open Queue
              <ArrowRight size={14} />
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3 p-5">
            {[
              {
                name: "Pending",
                icon: Clock3,
                color: "text-amber-600",
                bg: "bg-amber-50"
              },
              {
                name: "Processing",
                icon: RefreshCw,
                color: "text-blue-600",
                bg: "bg-blue-50"
              },
              {
                name: "Completed",
                icon: CircleCheck,
                color: "text-emerald-600",
                bg: "bg-emerald-50"
              },
              {
                name: "Failed",
                icon: CircleX,
                color: "text-rose-600",
                bg: "bg-rose-50"
              }
            ].map(({ name, icon: Icon, color, bg }) => (
              <div
                key={name}
                className={`rounded-xl p-4 ${bg}`}
              >
                <Icon size={19} className={color} />

                <p className={`mt-4 text-3xl font-bold ${color}`}>
                  {analytics.aiCounts[name]}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-600">
                  {name}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-5 mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                AI Completion Rate
              </span>
              <span className="font-bold text-emerald-700">
                {aiCompletionRate.toFixed(1)}%
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${aiCompletionRate}%`
                }}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Intelligence */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Lead Sources"
          subtitle="Where customers come from"
        >
          <div className="space-y-5 p-5">
            {analytics.sources.length === 0 ? (
              <p className="text-sm text-slate-400">
                No source data.
              </p>
            ) : (
              analytics.sources.slice(0, 6).map((item) => (
                <ProgressRow
                  key={item.name}
                  label={item.name}
                  count={item.count}
                  total={analytics.total}
                  color="#3b82f6"
                />
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Program Interests"
          subtitle="Customer interest classification"
        >
          <div className="space-y-5 p-5">
            {analytics.interests.length === 0 ? (
              <p className="text-sm text-slate-400">
                No interest data.
              </p>
            ) : (
              analytics.interests.slice(0, 6).map((item) => (
                <ProgressRow
                  key={item.name}
                  label={item.name}
                  count={item.count}
                  total={analytics.total}
                  color="#8b5cf6"
                />
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Priority & Sentiment"
          subtitle="AI-classified customer signals"
        >
          <div className="space-y-5 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Priority
            </p>

            {analytics.priorities.map((item) => (
              <ProgressRow
                key={item.name}
                label={item.name}
                count={item.count}
                total={analytics.total}
                color={
                  item.name === "High"
                    ? "#ef4444"
                    : item.name === "Medium"
                    ? "#f59e0b"
                    : "#64748b"
                }
              />
            ))}

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                Sentiment
              </p>

              <div className="flex flex-wrap gap-2">
                {analytics.sentiments.map((item) => (
                  <span
                    key={item.name}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {item.name}: {item.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Action Center */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel
          title="Recent Enquiries"
          subtitle="Latest customer activity"
          className="xl:col-span-2"
          action={
            <button
              onClick={() => navigate("Enquiries")}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700"
            >
              View All
              <ArrowRight size={14} />
            </button>
          }
        >
          {analytics.recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-slate-400">
              <Inbox size={28} />
              <p className="text-sm">No enquiries found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {analytics.recent.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => edit(lead)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {lead.name || "Not Provided"}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {getQueryId(lead)} ·{" "}
                      {lead.source || "Other"} ·{" "}
                      {lead.interest || "Unknown"}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatDate(
                        lead.receivedAt || lead.createdAt
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={lead.status} />
                    <ChevronRight
                      size={15}
                      className="text-slate-400"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Follow-up Center"
          subtitle={`${analytics.dueReminders.length} due · ${analytics.activeReminders.length} active`}
          action={
            <CalendarClock
              size={18}
              className="text-emerald-600"
            />
          }
        >
          {analytics.activeReminders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <CircleCheck
                size={28}
                className="text-emerald-500"
              />
              <p className="text-sm font-medium text-slate-600">
                No active reminders
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {analytics.activeReminders
                .slice(0, 6)
                .map((lead) => {
                  const due =
                    new Date(lead.followUpAt) <= now;

                  return (
                    <button
                      key={lead.id}
                      onClick={() => edit(lead)}
                      className="w-full px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {lead.name || getQueryId(lead)}
                        </p>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            due
                              ? "bg-rose-50 text-rose-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {due ? "Due" : "Upcoming"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(lead.followUpAt)}
                      </p>
                    </button>
                  );
                })}
            </div>
          )}
        </Panel>
      </div>

      {/* Insights */}
      <div className="rounded-2xl bg-[#0B1220] p-5 text-white md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3
            size={20}
            className="text-emerald-400"
          />
          <h2 className="font-bold">
            Business Snapshot
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Top Lead Source
            </p>
            <p className="mt-2 text-lg font-bold">
              {topSource?.name || "No data"}
            </p>
            <p className="mt-1 text-xs text-emerald-400">
              {topSource
                ? `${topSource.count} enquiries`
                : "Awaiting enquiries"}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Interested Customers
            </p>
            <p className="mt-2 text-lg font-bold">
              {analytics.stageCounts.Interested}
            </p>
            <p className="mt-1 text-xs text-emerald-400">
              Currently in Interested stage
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Lost Enquiries
            </p>
            <p className="mt-2 text-lg font-bold">
              {analytics.stageCounts.Lost}
            </p>
            <p className="mt-1 text-xs text-rose-400">
              Closed without conversion
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate("AI Queue")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <BrainCircuit size={16} />
          Process AI Queue
        </button>

        <button
          onClick={() => navigate("Import CSV")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Inbox size={16} />
          Import Enquiries
        </button>

        <button
          onClick={() => navigate("Pipeline")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Target size={16} />
          Manage Pipeline
        </button>
      </div>
    </div>
  );
}
