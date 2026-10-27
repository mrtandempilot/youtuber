"use client";

import { useEffect } from "react";

// Reports the Google permission result to the window that opened this popup, then closes it.
export function AuthDone() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.opener) {
      window.opener.postMessage(
        { type: "ck-auth", ok: params.get("connected") === "1", error: params.get("error") },
        window.location.origin,
      );
      window.close();
    }
  }, []);
  return <p className="text-lg">All set — you can close this window.</p>;
}
