"use client";

import { useState } from "react";

export function RequestProcessingButton({ sourceEventId }: { sourceEventId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function requestProcessing() {
    setState("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/capture/processing-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_event_id: sourceEventId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("saved");
      setMessage("Processing requested.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to request processing.");
    }
  }

  return (
    <div className="capture-processing-request">
      <button className="capture-button" type="button" onClick={requestProcessing} disabled={state === "saving" || state === "saved"}>
        {state === "saving" ? "Requesting…" : state === "saved" ? "Requested" : "Request processing"}
      </button>
      {message ? <p className={`capture-message ${state === "error" ? "error" : "saved"}`}>{message}</p> : null}
    </div>
  );
}
