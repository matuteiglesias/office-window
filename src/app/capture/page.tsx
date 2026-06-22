import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CsvTable } from "@/components/CsvTable";
import { MarkdownDocument } from "@/components/MarkdownDocument";
import { RequestProcessingButton } from "@/components/capture/RequestProcessingButton";
import { CaptureReviewActions } from "@/components/capture/CaptureReviewActions";
import { CAPTURE_LIFECYCLE_STATUSES } from "@/lib/captureOntology";
import { getCaptureRoots } from "@/lib/server/captureEvents";
import {
  type CaptureLifecycleItem,
  getCaptureLifecycle,
} from "@/lib/server/captureLifecycle";
import { getCaptureCandidateArtifacts } from "@/lib/server/captureArtifacts";

export const dynamic = "force-dynamic";

const sections: Array<{ key: string; title: string; statuses: string[] }> = [
  { key: "inbox", title: "Inbox", statuses: ["pending_transcription", "queued", "failed"] },
  { key: "transcribed", title: "Transcribed", statuses: ["transcribed"] },
  { key: "routed", title: "Routed", statuses: ["routed"] },
  { key: "artifact", title: "Artifact candidates", statuses: ["artifact_candidate"] },
  { key: "reingest", title: "Reingest candidates", statuses: ["pending_reingest"] },
  { key: "done", title: "Done / Archived", statuses: ["approved", "applied", "archived", "discarded"] },
];

const blockStubColumns = [
  "candidate_id",
  "source_event_id",
  "project_id",
  "project_title",
  "suggested_title",
  "suggested_mode",
  "expected_duration_min",
  "status",
  "review_required",
];

function eventMatches(event: CaptureLifecycleItem, statuses: string[]) {
  return statuses.includes(event.status);
}

function formatJson(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function formatDate(value: string) {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return formatJson(value);
}

function proposalEntries(value: unknown) {
  const record = asRecord(value);
  if (!record) return [];
  const preferredKeys = ["next", "needs", "status", "carry", "horizon"];
  const preferred = preferredKeys.filter((key) => record[key] !== undefined && record[key] !== null && record[key] !== "");
  const extra = Object.keys(record).filter((key) => !preferredKeys.includes(key) && record[key] !== undefined && record[key] !== null && record[key] !== "");
  return [...preferred, ...extra].map((key) => [key, record[key]] as const);
}

function looksLikeTestTranscript(value: unknown) {
  if (typeof value !== "string") return false;
  const text = value.toLowerCase().trim();
  if (!text) return false;
  return (
    text.includes("uno, dos, tres") ||
    text.includes("uno dos tres") ||
    text.includes("hola, hola") ||
    text.includes("test") ||
    text.includes("prueba")
  );
}

function humanStatusLabel(event: CaptureLifecycleItem) {
  if (event.status === "pending_reingest") return "Pending human review";
  if (event.status === "approved") return "Approved · awaiting apply";
  if (event.status === "archived") return "Archived";
  if (event.status === "discarded") return "Discarded";
  if (event.status === "queued" && event.events?.includes("capture.reprocess_requested")) return "Queued for reprocess";
  return event.status.replaceAll("_", " ");
}

function humanTitle(event: CaptureLifecycleItem, artifact: CaptureLifecycleItem["artifact_candidate"], reingest: CaptureLifecycleItem["reingest_candidate"]) {
  const delta = asRecord(reingest?.proposed_delta);
  return (
    event.target.title ||
    (artifact && "title" in artifact && typeof artifact.title === "string" ? artifact.title : "") ||
    (delta && typeof delta.project_title === "string" ? delta.project_title : "") ||
    (delta && typeof delta.title === "string" ? delta.title : "") ||
    event.target.project_id ||
    event.event_id
  );
}

function targetLine(event: CaptureLifecycleItem) {
  return [
    event.target.project_id ? `Project ${event.target.project_id}` : null,
    event.target.queue_key || null,
    event.created_at ? `captured ${formatDate(event.created_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function reviewOutcome(event: CaptureLifecycleItem) {
  if (event.status === "approved") {
    return { label: "Approved · awaiting apply", reason: event.review?.note ? `Note: ${event.review.note}` : "Approved for later Office Auto Lab apply." };
  }
  if (event.status === "discarded") {
    return { label: "Discarded", reason: [event.discard?.reason, event.discard?.note].filter(Boolean).join(" · ") };
  }
  if (event.status === "archived") {
    return { label: "Archived", reason: [event.archive?.reason, event.archive?.note].filter(Boolean).join(" · ") };
  }
  if (event.status === "applied") {
    return { label: "Applied", reason: event.review?.note ? `Note: ${event.review.note}` : "Applied by Office Auto Lab." };
  }
  if (event.status === "queued" && event.events?.includes("capture.reprocess_requested")) {
    return { label: "Queued for reprocess", reason: [event.request?.stage, event.request?.instruction].filter(Boolean).join(" · ") };
  }
  return null;
}

function terminalBadge(event: CaptureLifecycleItem) {
  if (event.status === "approved") return "Awaiting apply";
  if (event.status === "discarded") return "Closed";
  if (event.status === "archived") return "No action";
  if (event.status === "applied") return "Applied";
  return null;
}

function CaptureEventCard({ event }: { event: CaptureLifecycleItem }) {
  const transcript = event.transcript && typeof event.transcript === "object" ? event.transcript : null;
  const routing = event.routing && typeof event.routing === "object" ? event.routing : null;
  const artifact =
    event.artifact_candidate && typeof event.artifact_candidate === "object" ? event.artifact_candidate : null;
  const reingest =
    event.reingest_candidate && typeof event.reingest_candidate === "object" ? event.reingest_candidate : null;
  const isPendingReview = event.status === "pending_reingest";
  const isClosed = ["approved", "applied", "archived", "discarded"].includes(event.status);
  const isQueuedReprocess = event.status === "queued" && event.events?.includes("capture.reprocess_requested");
  const title = humanTitle(event, artifact, reingest);
  const deltaEntries = proposalEntries(reingest?.proposed_delta ?? event.approval?.approved_delta);
  const approvedDeltaEntries = proposalEntries(event.approval?.approved_delta ?? reingest?.proposed_delta);
  const testLikeTranscript = looksLikeTestTranscript(transcript?.text);
  const outcome = reviewOutcome(event);
  const badge = terminalBadge(event);

  if (isClosed) {
    return (
      <article className="capture-card capture-review-card capture-terminal-card">
        <div className="capture-review-header">
          <StatusBadge status={event.status} subtle />
          <div className="capture-review-title-block">
            <div className="eyebrow">{humanStatusLabel(event)}</div>
            <h3>{title}</h3>
            {targetLine(event) ? <p className="muted">{targetLine(event)}</p> : null}
          </div>
        </div>

        <div className="capture-pills" aria-label="Terminal capture badges">
          {badge ? <span>{badge}</span> : null}
          {event.status === "approved" ? <span>Not applied to Office state</span> : null}
        </div>

        <div className="capture-terminal-summary">
          {event.status === "approved" || event.status === "applied" ? (
            <>
              <div>
                <span className="metric-label">approved target</span>
                <p>{[event.approval?.target_surface || reingest?.target_surface, event.approval?.target_id || reingest?.target_id].filter(Boolean).join(" / ") || "No target recorded"}</p>
              </div>
              {approvedDeltaEntries.length ? (
                <div>
                  <span className="metric-label">approved delta</span>
                  <dl className="capture-delta-list compact">
                    {approvedDeltaEntries.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{formatValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              <div>
                <span className="metric-label">note</span>
                <p>{event.review?.note || "No note"}</p>
              </div>
            </>
          ) : null}

          {event.status === "discarded" ? (
            <>
              <div>
                <span className="metric-label">discard reason</span>
                <p>{event.discard?.reason || "No reason recorded"}</p>
              </div>
              <div>
                <span className="metric-label">note</span>
                <p>{event.discard?.note || "No note"}</p>
              </div>
            </>
          ) : null}

          {event.status === "archived" ? (
            <>
              <div>
                <span className="metric-label">archive reason</span>
                <p>{event.archive?.reason || "No reason recorded"}</p>
              </div>
              <div>
                <span className="metric-label">note</span>
                <p>{event.archive?.note || "No note"}</p>
              </div>
            </>
          ) : null}
        </div>

        <details className="capture-technical-details">
          <summary>Technical details</summary>
          <div className="capture-trace-grid">
            <div>
              <span className="metric-label">event_id</span>
              <div className="artifact-path">{event.event_id}</div>
            </div>
            {event.route ? (
              <div>
                <span className="metric-label">route</span>
                <div className="artifact-path">{event.route}</div>
              </div>
            ) : null}
            {event.target.queue_file ? (
              <div>
                <span className="metric-label">queue file</span>
                <div className="artifact-path">{event.target.queue_file}</div>
              </div>
            ) : null}
          </div>
          {routing ? <pre className="capture-pre">{formatJson({ routing })}</pre> : null}
          {reingest ? <pre className="capture-pre">{formatJson({ reingest_candidate: reingest })}</pre> : null}
          {artifact ? <pre className="capture-pre">{formatJson({ artifact_candidate: artifact })}</pre> : null}
          {event.approval ? <pre className="capture-pre">{formatJson({ approval: event.approval })}</pre> : null}
          {event.discard ? <pre className="capture-pre">{formatJson({ discard: event.discard })}</pre> : null}
          {event.archive ? <pre className="capture-pre">{formatJson({ archive: event.archive })}</pre> : null}
          {event.request ? <pre className="capture-pre">{formatJson({ request: event.request })}</pre> : null}
          {event.events ? <pre className="capture-pre">{formatJson({ events: event.events })}</pre> : null}
        </details>
      </article>
    );
  }

  return (
    <article className={`capture-card capture-review-card${isClosed ? " capture-card-compact" : ""}`}>
      <div className="capture-review-header">
        <StatusBadge status={event.status} subtle />
        <div className="capture-review-title-block">
          <div className="eyebrow">{humanStatusLabel(event)}</div>
          <h3>{title}</h3>
          {targetLine(event) ? <p className="muted">{targetLine(event)}</p> : null}
        </div>
      </div>

      <div className="capture-pills" aria-label="Capture review badges">
        {isPendingReview ? <span>Requires review</span> : null}
        {artifact || reingest ? <span>AI generated</span> : null}
        {reingest?.requires_human_approval ? <span>Requires approval</span> : null}
        {isPendingReview || event.status === "approved" ? <span>Not applied to Office state</span> : null}
        {isQueuedReprocess ? <span>Queued for reprocess</span> : null}
      </div>

      {event.audio?.rel_path && !isClosed ? (
        <>
          <div className="artifact-path">
            {event.audio.rel_path} · {(event.audio.bytes ?? 0).toLocaleString()} bytes
          </div>
          <audio
            controls
            src={`/api/capture/audio?path=${encodeURIComponent(event.audio.rel_path)}`}
            className="capture-audio"
          />
        </>
      ) : null}

      {transcript?.text ? (
        <section className="capture-review-section">
          <div className="capture-section-head">
            <div className="metric-label">Transcript</div>
            {transcript.model ? <span className="muted">model: {transcript.model}</span> : null}
          </div>
          <blockquote className="capture-transcript-quote">“{transcript.text}”</blockquote>
        </section>
      ) : null}

      {(artifact || routing || reingest || event.approval) && !["pending_transcription", "queued"].includes(event.status) ? (
        <section className="capture-review-section">
          <div className="metric-label">AI Proposal</div>
          <div className="capture-proposal-card">
            {artifact?.type || routing?.artifact_type || routing?.capture_mode ? (
              <p><strong>Type:</strong> {artifact?.type || routing?.artifact_type || routing?.capture_mode}</p>
            ) : null}
            {reingest?.target_surface || event.approval?.target_surface ? (
              <p>
                <strong>Target:</strong> {reingest?.target_surface || event.approval?.target_surface}
                {reingest?.target_id || event.approval?.target_id ? ` / ${reingest?.target_id || event.approval?.target_id}` : ""}
              </p>
            ) : null}
            {artifact?.confidence ? <p className="muted">Confidence: {artifact.confidence}</p> : null}
            {deltaEntries.length ? (
              <dl className="capture-delta-list">
                {deltaEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">No proposed delta fields to show.</p>
            )}
          </div>
        </section>
      ) : null}

      {outcome ? (
        <section className="capture-review-section">
          <div className="metric-label">Human Decision</div>
          <div className="capture-outcome-card">
            <strong>{outcome.label}</strong>
            {outcome.reason ? <p>{outcome.reason}</p> : null}
          </div>
        </section>
      ) : null}

      {isPendingReview ? (
        <section className="capture-review-section">
          <div className="metric-label">Human Decision</div>
          <p className="muted">Append a review event only. Nothing is applied to Office state from this page.</p>
          <CaptureReviewActions
            sourceEventId={event.event_id}
            proposedDelta={reingest?.proposed_delta}
            targetSurface={reingest?.target_surface}
            targetId={reingest?.target_id}
            looksLikeTest={testLikeTranscript}
          />
        </section>
      ) : null}

      {!isPendingReview && ["pending_transcription", "queued"].includes(event.status) && !isQueuedReprocess ? (
        <section className="capture-review-section">
          <div className="metric-label">Processing request</div>
          <p className="muted">
            Appends a local request event only. Office Window does not transcribe, call OpenAI, or run the Office Auto Lab pipeline.
          </p>
          <RequestProcessingButton sourceEventId={event.event_id} />
        </section>
      ) : null}

      {event.human_note && !outcome ? (
        <section className="capture-review-section">
          <div className="metric-label">Human note</div>
          <p>{event.human_note}</p>
        </section>
      ) : null}

      <details className="capture-technical-details">
        <summary>Technical details</summary>
        <div className="capture-trace-grid">
          <div>
            <span className="metric-label">event_id</span>
            <div className="artifact-path">{event.event_id}</div>
          </div>
          {event.route ? (
            <div>
              <span className="metric-label">route</span>
              <div className="artifact-path">{event.route}</div>
            </div>
          ) : null}
          {event.target.queue_file ? (
            <div>
              <span className="metric-label">queue file</span>
              <div className="artifact-path">{event.target.queue_file}</div>
            </div>
          ) : null}
        </div>
        {routing ? <pre className="capture-pre">{formatJson({ routing })}</pre> : null}
        {reingest ? <pre className="capture-pre">{formatJson({ reingest_candidate: reingest })}</pre> : null}
        {artifact ? <pre className="capture-pre">{formatJson({ artifact_candidate: artifact })}</pre> : null}
        {event.approval ? <pre className="capture-pre">{formatJson({ approval: event.approval })}</pre> : null}
        {event.discard ? <pre className="capture-pre">{formatJson({ discard: event.discard })}</pre> : null}
        {event.archive ? <pre className="capture-pre">{formatJson({ archive: event.archive })}</pre> : null}
        {event.request ? <pre className="capture-pre">{formatJson({ request: event.request })}</pre> : null}
        {event.events ? <pre className="capture-pre">{formatJson({ events: event.events })}</pre> : null}
      </details>
    </article>
  );
}

export default async function CapturePage() {
  const roots = getCaptureRoots();
  const lifecycle = await getCaptureLifecycle();
  const candidateArtifacts = await getCaptureCandidateArtifacts();
  const events = lifecycle.captures;
  const statusCounts = lifecycle.statusCounts;

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Append-only capture pipeline</div>
        <h1>Capture</h1>
        <p>
          Observe local voice-note captures as they move from raw inbox events toward future transcript, routing,
          artifact candidate, and reingest proposal stages. This page does not transcribe, call AI APIs, or mutate Office state.
        </p>
      </header>

      {!roots.ok ? (
        <SectionCard title="Capture not configured" eyebrow="environment">
          <p className="muted">{roots.error}</p>
        </SectionCard>
      ) : null}

      <SectionCard
        title={lifecycle.source === "compiled" ? "Compiled lifecycle" : "Raw inbox fallback"}
        eyebrow="capture source"
      >
        <div className="capture-pills">
          <span>{lifecycle.source === "compiled" ? "Compiled lifecycle" : "Raw inbox fallback"}</span>
        </div>
        <p className="muted">
          {lifecycle.source === "compiled"
            ? "Showing capture lifecycle compiled by office-auto-lab."
            : "Showing append-only raw capture inbox records until a compiled lifecycle artifact is available."}
        </p>
        {lifecycle.generatedAt ? <p className="muted">Generated: {formatDate(lifecycle.generatedAt)}</p> : null}
        {lifecycle.warning ? <p className="capture-warning">{lifecycle.warning}</p> : null}
      </SectionCard>

      <SectionCard title="Candidate artifacts" eyebrow="office-auto-lab compiled surfaces">
        {candidateArtifacts.candidatesJson.generatedAt ? (
          <p className="muted">Generated: {formatDate(candidateArtifacts.candidatesJson.generatedAt)}</p>
        ) : null}
        {candidateArtifacts.candidatesJson.warning ? (
          <p className="capture-warning">{candidateArtifacts.candidatesJson.warning}</p>
        ) : null}
        {candidateArtifacts.candidatesMarkdown.exists ? (
          <MarkdownDocument content={candidateArtifacts.candidatesMarkdown.content} empty="Capture candidate summary is empty." />
        ) : candidateArtifacts.candidatesJson.content ? (
          <pre className="capture-pre">{formatJson(candidateArtifacts.candidatesJson.content)}</pre>
        ) : (
          <p className="muted">No compiled capture candidate artifacts found.</p>
        )}
      </SectionCard>

      <SectionCard title="Work block candidate stubs" eyebrow="review-only candidates">
        <div className="capture-pills">
          <span>Candidate</span>
          <span>Review required</span>
          <span>Not a task yet</span>
          <span>Not applied to Office state</span>
        </div>
        <p className="muted">
          These stubs are Office Auto Lab suggestions for review. Office Window only displays them and does not apply them to Office state.
        </p>
        {candidateArtifacts.blockStubsCsv.warning ? (
          <p className="capture-warning">{candidateArtifacts.blockStubsCsv.warning}</p>
        ) : null}
        {candidateArtifacts.blockStubsMarkdown.exists ? (
          <MarkdownDocument content={candidateArtifacts.blockStubsMarkdown.content} empty="Work block candidate summary is empty." />
        ) : null}
        {candidateArtifacts.blockStubsCsv.exists ? (
          <CsvTable rows={candidateArtifacts.blockStubsCsv.rows} preferredColumns={blockStubColumns} maxRows={50} />
        ) : !candidateArtifacts.blockStubsMarkdown.exists ? (
          <p className="muted">No compiled work block candidate stubs found.</p>
        ) : null}
      </SectionCard>

      <section className="capture-helper-grid">
        <SectionCard title="Lifecycle" eyebrow="human → capture → reuse">
          <p className="muted">
            Human → Capture → Lane / Thread → Artifact → Reuse. Future agents can append transcript, routing,
            artifact, and reingest proposal fields to the JSONL event stream.
          </p>
        </SectionCard>
        <SectionCard title="Canonical routing form" eyebrow="routing sentence">
          <p className="capture-routing-form">This is [capture mode] for [lane]; it should become [artifact].</p>
        </SectionCard>
      </section>

      <div className="capture-status-grid">
        {CAPTURE_LIFECYCLE_STATUSES.map((status) => (
          <div className="capture-status-card" key={status}>
            <div className="metric-label">{status}</div>
            <div className="metric-value">{statusCounts[status] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="capture-section-nav" aria-label="Capture lifecycle sections">
        {sections.map((section) => (
          <a href={`#${section.key}`} key={section.key}>{section.title}</a>
        ))}
      </div>

      <div className="stack">
        {sections.map((section) => {
          const sectionEvents = events.filter((event) => eventMatches(event, section.statuses));
          return (
            <SectionCard
              key={section.key}
              title={`${section.title} · ${sectionEvents.length}`}
              eyebrow={section.statuses.join(" / ")}
            >
              <div id={section.key} className="capture-anchor" />
              {sectionEvents.length === 0 ? (
                <p className="muted">No events in this stage.</p>
              ) : (
                <div className="capture-list">
                  {sectionEvents.map((event) => (
                    <CaptureEventCard event={event} key={event.event_id} />
                  ))}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
