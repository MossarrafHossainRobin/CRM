
export default function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = "emerald"
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h3 className="mt-3 text-3xl font-extrabold text-slate-900">
            {value}
          </h3>
        </div>

        <div
          className={`rounded-xl p-3 ${
            colors[color] || colors.emerald
          }`}
        >
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}
