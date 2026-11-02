
"use client";

import {
  BrainCircuit,
  Sparkles,
  Loader2,
  Save
} from "lucide-react";

export default function AIProcessor({
  draft,
  setDraft,
  loading,
  onAutoProcess,
  onManualSave,
  editId
}) {
  const sources = [
    "WhatsApp",
    "Facebook Messenger",
    "Facebook comment",
    "Website form",
    "Phone call note",
    "Other"
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-600 p-3 text-white">
            <BrainCircuit size={24} />
          </div>

          <div>
            <h2 className="text-xl font-bold">
              AI Enquiry Processor
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste a message and let AI handle the analysis.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-bold">
              {editId ? "Edit Enquiry" : "New Customer Enquiry"}
            </h3>

            <label className="mb-2 block text-sm font-semibold">
              Customer Message
            </label>

            <textarea
              rows={9}
              value={draft.message}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  message: e.target.value
                })
              }
              placeholder="Vai ami AI bootcamp korte chai. Fee koto?"
              className="w-full rounded-xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-emerald-500"
            />

            <label className="mb-2 mt-5 block text-sm font-semibold">
              Message Source
            </label>

            <select
              value={draft.source}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  source: e.target.value
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500"
            >
              {sources.map((source) => (
                <option key={source}>
                  {source}
                </option>
              ))}
            </select>

            <button
              onClick={onAutoProcess}
              disabled={loading || !draft.message.trim()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Auto Process & Save
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              AI analysis → Firestore save → Dashboard update
            </p>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold">
              Customer Details
            </h3>

            <p className="mb-5 mt-1 text-xs text-slate-500">
              Optional manual information
            </p>

            <div className="space-y-4">
              {[
                ["Customer Name", "name"],
                ["Phone Number", "phone"],
                ["Follow-up Date", "followUpAt"]
              ].map(([label, key]) => (
                <label key={key} className="block text-sm">
                  {label}

                  <input
                    value={draft[key] || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]: e.target.value
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  />
                </label>
              ))}

              <label className="block text-sm">
                Suggested Reply

                <textarea
                  rows={5}
                  value={draft.reply || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      reply: e.target.value
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </label>

              <label className="block text-sm">
                Notes

                <textarea
                  rows={4}
                  value={draft.notes || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      notes: e.target.value
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                />
              </label>

              <button
                onClick={onManualSave}
                disabled={loading || !draft.message.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save size={17} />
                Save Manually
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
