import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { getCaptureRoots, getRecentCaptureEvents } from "@/lib/server/captureEvents";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const roots = getCaptureRoots();
  const events = await getRecentCaptureEvents(60);

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Append-only inbox</div>
        <h1>Capture</h1>
        <p>
          Recent human voice-note events stored under the configured office-auto-lab inbox.
          Audio remains local; no transcription or external API call is made here.
        </p>
      </header>

      {!roots.ok ? (
        <SectionCard title="Capture not configured" eyebrow="environment">
          <p className="muted">{roots.error}</p>
        </SectionCard>
      ) : null}

      <SectionCard title={`Recent events · ${events.length}`} eyebrow="human feedback">
        {events.length === 0 ? (
          <p className="muted">No capture events found in the latest JSONL files.</p>
        ) : (
          <div className="capture-list">
            {events.map((event) => (
              <article className="capture-card" key={event.event_id}>
                <div className="capture-card-head">
                  <div>
                    <h3>{event.target.title || event.target.project_id}</h3>
                    <p className="muted">
                      {event.target.queue_key} · {event.target.project_id} · {new Date(event.ts).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={event.status} subtle />
                </div>
                <div className="artifact-path">{event.audio.rel_path} · {event.audio.bytes.toLocaleString()} bytes</div>
                <audio controls src={`/api/capture/audio?path=${encodeURIComponent(event.audio.rel_path)}`} className="capture-audio" />
                {event.note ? <p className="capture-note-text">Note: {event.note}</p> : null}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
