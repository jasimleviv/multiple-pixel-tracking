"use client";

import { RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { deleteRecipientTrackingAction, resetRecipientReportAction } from "@/app/actions";

type ActionKind = "reset" | "delete";

type RecipientActionsProps = {
  recipientId: number;
  recipientName: string;
  campaignName: string | null;
};

const actionCopy = {
  reset: {
    title: "Reset tracking report?",
    body: "This clears open and click report counts for this recipient only. The pixel URL and wrapper link stay valid.",
    confirm: "Reset report",
    button: "Reset",
  },
  delete: {
    title: "Delete tracking?",
    body: "This deletes this recipient's pixel URL, wrapper link, and related reports. If this is the only recipient in the campaign, the campaign is deleted too.",
    confirm: "Delete tracking",
    button: "Delete",
  },
} satisfies Record<ActionKind, { title: string; body: string; confirm: string; button: string }>;

export function RecipientActions({ recipientId, recipientName, campaignName }: RecipientActionsProps) {
  const [pendingAction, setPendingAction] = useState<ActionKind | null>(null);
  const copy = pendingAction ? actionCopy[pendingAction] : null;

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setPendingAction("reset")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-400/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={() => setPendingAction("delete")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50 dark:border-red-400/30 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-400/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {copy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20 dark:border-white/10 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{copy.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
              <p className="font-medium">{recipientName}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{campaignName || "No campaign name"}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <form
                action={pendingAction === "reset" ? resetRecipientReportAction : deleteRecipientTrackingAction}
                onSubmit={() => setPendingAction(null)}
              >
                <input type="hidden" name="recipientId" value={recipientId} />
                <button
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition ${
                    pendingAction === "reset" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {pendingAction === "reset" ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  {copy.confirm}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
