
"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";

function getActivity(leads) {
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const dateKey = date.toLocaleDateString("en-CA");

    const count = leads.filter((lead) => {
      const raw = lead.receivedAt || lead.createdAt;
      if (!raw) return false;

      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return false;

      return parsed.toLocaleDateString("en-CA") === dateKey;
    }).length;

    result.push({
      label: date.toLocaleDateString("en-US", {
        weekday: "short"
      }),
      count
    });
  }

  return result;
}

export default function ActivityChart({ leads = [] }) {
  const data = useMemo(() => getActivity(leads), [leads]);

  const max = Math.max(1, ...data.map((x) => x.count));

  const width = 700;
  const height = 230;
  const left = 30;
  const top = 25;
  const bottom = 35;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - 20;

  const points = data.map((item, index) => ({
    x: left + (index * plotWidth) / 6,
    y: top + plotHeight - (item.count / max) * plotHeight,
    count: item.count
  }));

  const line = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const area = `${line} L ${points[6].x} ${
    top + plotHeight
  } L ${points[0].x} ${top + plotHeight} Z`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">
            Lead Activity
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Enquiries received in the last 7 days
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <Activity size={14} />
          Live Data
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Last seven days lead activity"
      >
        <defs>
          <linearGradient
            id="activityFill"
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

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={left}
            x2={width - 20}
            y1={top + plotHeight * fraction}
            y2={top + plotHeight * fraction}
            stroke="#e2e8f0"
            strokeDasharray="4 5"
          />
        ))}

        <path d={area} fill="url(#activityFill)" />

        <path
          d={line}
          fill="none"
          stroke="#059669"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#059669"
              stroke="white"
              strokeWidth="2"
            />

            <text
              x={point.x}
              y={point.y - 14}
              fontSize="12"
              fill="#475569"
              textAnchor="middle"
            >
              {point.count}
            </text>

            <text
              x={point.x}
              y={height - 8}
              fontSize="12"
              fill="#64748b"
              textAnchor="middle"
            >
              {data[index].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
