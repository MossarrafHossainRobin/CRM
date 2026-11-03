
"use client";

import {
  Sparkles,
  Loader2,
  Save,
  Copy,
  CalendarClock
} from "lucide-react";

const sources = [
  "WhatsApp",
  "Facebook Messenger",
  "Facebook comment",
  "Website form",
  "Phone call note",
  "Other"
];

const statuses = [
  "New",
  "Contacted",
  "Interested",
  "Paid",
  "Lost"
];

const interests = [
  "Bootcamp",
  "Fellowship",
  "Corporate Training",
  "Unknown"
];

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

export default function AIProcessor({
  draft,
  setDraft,
  loading,
  onAutoProcess,
  onManualSave,
  editId
}) {
  const update = (key, value) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  const copyText = async (text) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.alert("Unable to copy. Please copy manually.");
    }
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {editId ? "Edit Enquiry" : "AI Enquiry Processor"}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Paste a customer message or update enquiry details.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <div>
            <label className="text-sm font-semibold">
              Customer Message *
            </label>

            <textarea
              rows={8}
              value={draft.message || ""}
              onChange={(e) =>
                update("message", e.target.value)
              }
              placeholder="Vai ami AI Bootcamp korte chai. Fee koto?"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">
              Message Source
            </label>

            <select
              value={draft.source || "Other"}
              onChange={(e) =>
                update("source", e.target.value)
              }
              className={inputClass}
            >
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onAutoProcess}
              disabled={loading || !draft.message?.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Sparkles size={18} />
              )}

              {editId
                ? "Re-analyze & Save"
                : "AI Process & Save"}
            </button>

            <button
              onClick={onManualSave}
              disabled={loading || !draft.message?.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <Save size={17} />
              Save
            </button>
          </div>

          <p className="text-xs text-slate-400">
            AI generates a suggested reply. Messages are not
            automatically sent to customers.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold">
            Customer Details
          </h2>

          <label className="block text-sm">
            Customer Name
            <input
              value={draft.name || ""}
              onChange={(e) =>
                update("name", e.target.value)
              }
              placeholder="Not Provided"
              className={inputClass}
            />
          </label>

          <div>
            <label className="block text-sm">
              Phone Number
              <input
                type="tel"
                value={draft.phone || ""}
                onChange={(e) =>
                  update("phone", e.target.value)
                }
                placeholder="Not Provided"
                className={inputClass}
              />
            </label>

            {draft.phone && (
              <button
                onClick={() => copyText(draft.phone)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
              >
                <Copy size={13} />
                Copy Number
              </button>
            )}
          </div>

          <label className="block text-sm">
            Interest
            <select
              value={draft.interest || "Unknown"}
              onChange={(e) =>
                update("interest", e.target.value)
              }
              className={inputClass}
            >
              {interests.map((interest) => (
                <option key={interest} value={interest}>
                  {interest}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Pipeline Status
            <select
              value={draft.status || "New"}
              onChange={(e) =>
                update("status", e.target.value)
              }
              className={inputClass}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <CalendarClock size={16} />
              Follow-up Reminder
            </label>

            <input
              type="datetime-local"
              value={toDateTimeLocal(draft.followUpAt)}
              onChange={(e) =>
                update(
                  "followUpAt",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : ""
                )
              }
              className={inputClass}
            />

            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={draft.reminderCompleted === true}
                onChange={(e) =>
                  update(
                    "reminderCompleted",
                    e.target.checked
                  )
                }
                className="accent-emerald-600"
              />
              Reminder Completed
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm">
                AI Suggested Reply
              </label>

              <button
                onClick={() => copyText(draft.reply)}
                disabled={!draft.reply}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 disabled:opacity-40"
              >
                <Copy size={13} />
                Copy
              </button>
            </div>

            <textarea
              rows={5}
              value={draft.reply || ""}
              onChange={(e) =>
                update("reply", e.target.value)
              }
              placeholder="AI-generated reply will appear here."
              className={inputClass}
            />
          </div>

          <label className="block text-sm">
            Notes
            <textarea
              rows={3}
              value={draft.notes || ""}
              onChange={(e) =>
                update("notes", e.target.value)
              }
              className={inputClass}
            />
          </label>
        </section>
      </div>
    </div>
  );
}
