import { CsvTable } from "@/components/CsvTable";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  SAFE_TABLE_COLUMNS,
  getQueueSummaries,
} from "@/lib/server/officeArtifacts";

export default async function QueuesPage() {
  const queues = await getQueueSummaries();

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Latest routing surfaces</div>
        <h1>Queues</h1>
        <p>
          Read-only tables from <code>artifacts/latest</code>. Sensitive columns
          are hidden by default.
        </p>
      </header>

      <div className="stack">
        {queues.map((queue) => (
          <SectionCard
            key={queue.key}
            title={`${queue.title} · ${queue.count}`}
            eyebrow={queue.file}
          >
            <div className="section-meta">
              <StatusBadge status={queue.exists ? "ok" : "missing"} subtle />
              <span>{queue.description}</span>
            </div>
            <CsvTable
              rows={queue.rows}
              preferredColumns={SAFE_TABLE_COLUMNS}
              captureQueue={{ key: queue.key, file: queue.file }}
            />
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
