"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ReviewDecision = "approve" | "edit_approve" | "discard" | "archive" | "reprocess";
type ReviewPanel = "edit" | "discard" | "reprocess" | null;
type ReprocessStage = "route" | "artifactize" | "propose_reingest" | "full_pipeline";

type CaptureReviewActionsProps = {
  sourceEventId: string;
  proposedDelta?: unknown;
  targetSurface?: string;
  targetId?: string;
  looksLikeTest?: boolean;
};

const discardReasons = ["test_capture", "duplicate", "bad_transcript", "not_relevant", "other"] as const;

const reprocessInstructionExamples = [
  "Reprocess as work_block_candidate_stub.",
  "This is a support context note, not a queue update.",
  "No reingest candidate should be produced; this is a test capture.",
] as const;

const lifecycleCompileCommand =
  "cd ~/repos/office-auto-lab && PYTHONPATH=src python3 -m office_runtime.cli capture lifecycle";

function recordFromDelta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function CaptureReviewActions({
  sourceEventId,
  proposedDelta,
  targetSurface,
  targetId,
  looksLikeTest = false,
}: CaptureReviewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<ReviewPanel>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [discardReason, setDiscardReason] = useState<(typeof discardReasons)[number]>(
    looksLikeTest ? "test_capture" : "not_relevant",
  );
  const [reprocessStage, setReprocessStage] = useState<ReprocessStage>("artifactize");
  const [reprocessInstruction, setReprocessInstruction] = useState<string>(reprocessInstructionExamples[0]);
  const proposedDeltaRecord = useMemo(() => recordFromDelta(proposedDelta), [proposedDelta]);
  const [editedNext, setEditedNext] = useState(() => stringField(proposedDeltaRecord.next));
  const [editedNeeds, setEditedNeeds] = useState(() => stringField(proposedDeltaRecord.needs));

  const basePayload = useMemo(
    () => ({
      source_event_id: sourceEventId,
      note: reviewNote,
      ...(targetSurface ? { target_surface: targetSurface } : {}),
      ...(targetId ? { target_id: targetId } : {}),
    }),
    [reviewNote, sourceEventId, targetId, targetSurface],
  );

  async function submitReview(
    decision: ReviewDecision,
    options: {
      approvedDelta?: Record<string, unknown>;
      reason?: string;
      stage?: ReprocessStage;
      instruction?: string;
      note?: string;
    } = {},
  ) {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/capture/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...basePayload,
        decision,
        note: options.note ?? basePayload.note,
        ...(options.approvedDelta ? { approved_delta: options.approvedDelta } : {}),
        ...(options.reason ? { reason: options.reason } : {}),
        ...(options.stage ? { stage: options.stage } : {}),
        ...(options.instruction ? { instruction: options.instruction } : {}),
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "Unable to append capture review event.");
    }

    setOpenPanel(null);
    setMessage("Review saved. Run capture lifecycle to refresh compiled status.");
    startTransition(() => router.refresh());
  }

  async function handleApprove() {
    try {
      await submitReview("approve", { approvedDelta: proposedDeltaRecord, note: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to append capture review event.");
    }
  }

  async function handleEditedApprove() {
    try {
      await submitReview("edit_approve", {
        approvedDelta: {
          ...proposedDeltaRecord,
          next: editedNext,
          needs: editedNeeds,
        },
        note: reviewNote,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to append capture review event.");
    }
  }

  async function handleDiscard(reason = discardReason) {
    try {
      await submitReview("discard", { reason, note: reviewNote });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to append capture review event.");
    }
  }

  async function handleArchive() {
    try {
      await submitReview("archive", { reason: "no_action_needed", note: reviewNote });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to append capture review event.");
    }
  }

  async function handleReprocess() {
    try {
      await submitReview("reprocess", {
        stage: reprocessStage,
        instruction: reprocessInstruction,
        note: reviewNote,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to append capture review event.");
    }
  }

  return (
    <div className="capture-review-actions">
      {looksLikeTest ? (
        <div className="capture-warning">
          This looks like a test/noise capture. Consider discarding it instead of approving.
        </div>
      ) : null}
      <div className="capture-controls capture-review-buttons">
        <button className="capture-button" disabled={isPending} onClick={handleApprove} type="button">
          Approve
        </button>
        <button disabled={isPending} onClick={() => setOpenPanel(openPanel === "edit" ? null : "edit")} type="button">
          Edit &amp; approve
        </button>
        <button
          disabled={isPending}
          onClick={() => setOpenPanel(openPanel === "reprocess" ? null : "reprocess")}
          type="button"
        >
          Reprocess
        </button>
        <button disabled={isPending} onClick={handleArchive} type="button">
          Archive
        </button>
        <button
          disabled={isPending}
          onClick={() => setOpenPanel(openPanel === "discard" ? null : "discard")}
          type="button"
        >
          Discard
        </button>
      </div>

      {openPanel === "edit" ? (
        <div className="capture-review-panel">
          <label>
            next
            <input value={editedNext} onChange={(event) => setEditedNext(event.target.value)} />
          </label>
          <label>
            needs
            <textarea value={editedNeeds} onChange={(event) => setEditedNeeds(event.target.value)} rows={4} />
          </label>
          <label>
            review note
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} />
          </label>
          <p className="muted">This appends capture.approved with the edited delta. It does not apply Office state.</p>
          <div className="capture-controls">
            <button className="capture-button" disabled={isPending} onClick={handleEditedApprove} type="button">
              Save edited approval
            </button>
            <button disabled={isPending} onClick={() => setOpenPanel(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {openPanel === "discard" ? (
        <div className="capture-review-panel">
          <div className="metric-label">Discard reason</div>
          <div className="capture-reason-grid">
            {discardReasons.map((reason) => (
              <button
                className={discardReason === reason ? "selected" : ""}
                disabled={isPending}
                key={reason}
                onClick={() => setDiscardReason(reason)}
                type="button"
              >
                {reason}
              </button>
            ))}
          </div>
          <label>
            note
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} />
          </label>
          <div className="capture-controls">
            <button className="capture-button" disabled={isPending} onClick={() => handleDiscard()} type="button">
              Confirm discard
            </button>
            <button disabled={isPending} onClick={() => setOpenPanel(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {openPanel === "reprocess" ? (
        <div className="capture-review-panel">
          <label>
            stage
            <select value={reprocessStage} onChange={(event) => setReprocessStage(event.target.value as ReprocessStage)}>
              <option value="route">route</option>
              <option value="artifactize">artifactize</option>
              <option value="propose_reingest">propose_reingest</option>
              <option value="full_pipeline">full_pipeline</option>
            </select>
          </label>
          <label>
            instruction
            <textarea
              value={reprocessInstruction}
              onChange={(event) => setReprocessInstruction(event.target.value)}
              rows={4}
            />
          </label>
          <div className="capture-reason-grid">
            {reprocessInstructionExamples.map((example) => (
              <button disabled={isPending} key={example} onClick={() => setReprocessInstruction(example)} type="button">
                {example}
              </button>
            ))}
          </div>
          <label>
            review note
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} />
          </label>
          <div className="capture-controls">
            <button className="capture-button" disabled={isPending} onClick={handleReprocess} type="button">
              Request reprocess
            </button>
            <button disabled={isPending} onClick={() => setOpenPanel(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {looksLikeTest && openPanel !== "discard" ? (
        <button className="capture-inline-link" disabled={isPending} onClick={() => handleDiscard("test_capture")} type="button">
          Discard immediately as test_capture
        </button>
      ) : null}

      {message ? (
        <div className="capture-message saved capture-review-saved">
          <p>{message}</p>
          <code>{lifecycleCompileCommand}</code>
        </div>
      ) : null}
      {error ? <div className="capture-message error">{error}</div> : null}
    </div>
  );
}
