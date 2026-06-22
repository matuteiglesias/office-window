import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CAPTURE_LIFECYCLE_STATUSES } from "@/lib/captureOntology";
import { getCaptureRoots } from "@/lib/server/captureEvents";
import {
  type CaptureLifecycleItem,
  getCaptureLifecycle,
} from "@/lib/server/captureLifecycle";

export const dynamic = "force-dynamic";

const sections: Array<{ key: string; title: string; statuses: string[] }> = [
  { key: "inbox", title: "Inbox", statuses: ["pending_transcription", "queued", "failed"] },
  { key: "transcribed", title: "Transcribed", statuses: ["transcribed"] },
  { key: "routed", title: "Routed", statuses: ["routed"] },
  { key: "artifact", title: "Artifact candidates", statuses: ["artifact_candidate"] },
  { key: "reingest", title: "Reingest candidates", statuses: ["pending_reingest"] },
  { key: "done", title: "Done / Archived", statuses: ["approved", "applied", "archived", "discarded"] },
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

function CaptureEventCard({ event }: { event: CaptureLifecycleItem }) {
  const transcript = event.transcript && typeof event.transcript === "object" ? event.transcript : null;
  const routing = event.routing && typeof event.routing === "object" ? event.routing : null;
  const artifact =
    event.artifact_candidate && typeof event.artifact_candidate === "object" ? event.artifact_candidate : null;
  const reingest =
    event.reingest_candidate && typeof event.reingest_candidate === "object" ? event.reingest_candidate : null;

  return (
    <article className="capture-card">
      <div className="capture-card-head">
        <div>
          <h3>{event.target.title || event.target.project_id || event.event_id}</h3>
          <p className="muted">
            {event.target.queue_key} · {event.target.project_id} · {formatDate(event.created_at)}
          </p>
        </div>
        <StatusBadge status={event.status} subtle />
      </div>

      <div className="capture-trace-grid">
        <div>
          <span className="metric-label">event</span>
          <div className="artifact-path">{event.event_id}</div>
        </div>
        <div>
          <span className="metric-label">queue file</span>
          <div className="artifact-path">{event.target.queue_file}</div>
        </div>
        <div>
          <span className="metric-label">route</span>
          <div className="artifact-path">{event.route || "capture_lifecycle"}</div>
        </div>
      </div>

      {event.audio?.rel_path ? (
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

      {event.human_note ? (
        <div className="capture-detail-block">
          <div className="metric-label">human note</div>
          <p>{event.human_note}</p>
        </div>
      ) : null}

      {transcript?.text ? (
        <div className="capture-detail-block">
          <div className="metric-label">transcript{transcript.model ? ` · ${transcript.model}` : ""}</div>
          <p>{transcript.text}</p>
        </div>
      ) : null}

      {routing ? (
        <div className="capture-detail-block">
          <div className="metric-label">routing</div>
          {routing.routing_sentence ? <p>{routing.routing_sentence}</p> : null}
          <div className="capture-pills">
            {routing.capture_mode ? <span>{routing.capture_mode}</span> : null}
            {routing.lane ? <span>{routing.lane}</span> : null}
            {routing.artifact_type ? <span>{routing.artifact_type}</span> : null}
          </div>
          {routing.capture_mode || routing.lane || routing.artifact_type ? (
            <p className="muted">
              This is {routing.capture_mode || "[capture mode]"} for {routing.lane || "[lane]"}; it should become {routing.artifact_type || "[artifact]"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {artifact ? (
        <div className="capture-detail-block">
          <div className="metric-label">artifact candidate{artifact.type ? ` · ${artifact.type}` : ""}</div>
          {artifact.text ? <p>{artifact.text}</p> : null}
          {artifact.confidence ? <p className="muted">Confidence: {artifact.confidence}</p> : null}
        </div>
      ) : null}

      {reingest ? (
        <div className="capture-detail-block">
          <div className="metric-label">reingest candidate</div>
          {reingest.target_surface ? <p>Target surface: {reingest.target_surface}</p> : null}
          {reingest.target_id ? <p>Target ID: {reingest.target_id}</p> : null}
          {reingest.proposed_delta ? <pre className="capture-pre">{formatJson(reingest.proposed_delta)}</pre> : null}
          {typeof reingest.requires_human_approval === "boolean" ? (
            <p className="muted">
              Requires human approval: {reingest.requires_human_approval ? "yes" : "no"}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default async function CapturePage() {
  const roots = getCaptureRoots();
  const lifecycle = await getCaptureLifecycle();
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
        <p className="muted">
          {lifecycle.source === "compiled"
            ? "Showing capture lifecycle compiled by office-auto-lab."
            : "Showing append-only raw capture inbox records until a compiled lifecycle artifact is available."}
        </p>
        {lifecycle.generatedAt ? <p className="muted">Generated: {formatDate(lifecycle.generatedAt)}</p> : null}
        {lifecycle.warning ? <p className="muted">{lifecycle.warning}</p> : null}
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
