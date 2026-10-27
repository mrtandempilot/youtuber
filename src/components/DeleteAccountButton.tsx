"use client";

import { useState } from "react";

// Two-step "delete my data" control (no browser confirm dialog).
export function DeleteAccountButton() {
  const [stage, setStage] = useState<"idle" | "confirm" | "working" | "done" | "error">("idle");

  async function run() {
    setStage("working");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error();
      try {
        localStorage.removeItem("ck_onboarding_v1");
      } catch {
        /* ignore */
      }
      setStage("done");
    } catch {
      setStage("error");
    }
  }

  if (stage === "done") return <p className="font-medium text-ink">Your data was deleted and Google access was revoked.</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {stage === "confirm" ? (
        <>
          <button type="button" onClick={run} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Yes, delete everything
          </button>
          <button type="button" onClick={() => setStage("idle")} className="rounded-xl border border-line px-4 py-2 text-sm">
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={stage === "working"}
          onClick={() => setStage("confirm")}
          className="rounded-xl border border-line px-4 py-2 text-sm text-ink hover:border-ink disabled:opacity-60"
        >
          {stage === "working" ? "Deleting…" : "Delete my data"}
        </button>
      )}
      {stage === "error" && <span className="text-sm text-accent">Something went wrong. Please try again.</span>}
    </div>
  );
}
