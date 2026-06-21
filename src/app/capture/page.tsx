import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CAPTURE_LIFECYCLE_STATUSES,
  type CaptureEvent,
  getCaptureRoots,
  getRecentCaptureEvents,
} from "@/lib/server/captureEvents";

export const dynamic = "force-dynamic";

const sections: Array<{ key: string; title: string; statuses: string[] }> = [
  { key: "inbox", title: "Inbox", statuses: ["pending_transcription", "failed"] },
  { key: "transcribed", title: "Transcribed", statuses: ["transcribed"] },
  { key: "routed", title: "Routed", statuses: ["routed"] },
  { key: "artifact", title: "Artifact candidates", statuses: ["artifact_candidate"] },
  { key: "reingest", title: "Reingest candidates", statuses: ["pending_reingest"] },
  { key: "done", title: "Done / Archived", statuses: ["applied", "archived", "discarded"] },
];

function eventMatches(event: CaptureEvent, statuses: string[]) {
  return statuses.includes(event.status);
}

function formatJson(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function CaptureEventCard({ event }: { event: CaptureEvent }) {
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
            {event.target.queue_key} · {event.target.project_id} · {new Date(event.ts).toLocaleString()}
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
          <div className="artifact-path">{event.route}</div>
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

      {event.note ? (
        <div className="capture-detail-block">
          <div className="metric-label">human note</div>
          <p>{event.note}</p>
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
        </div>
      ) : null}

      {reingest ? (
        <div className="capture-detail-block">
          <div className="metric-label">reingest candidate</div>
          {reingest.target_surface ? <p>Target surface: {reingest.target_surface}</p> : null}
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
  const events = await getRecentCaptureEvents(100);
  const statusCounts = Object.fromEntries(CAPTURE_LIFECYCLE_STATUSES.map((status) => [status, 0]));
  for (const event of events) {
    statusCounts[event.status] = (statusCounts[event.status] ?? 0) + 1;
  }

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
