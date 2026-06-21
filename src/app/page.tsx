import { CsvTable } from "@/components/CsvTable";
import { LedgerTail } from "@/components/LedgerTail";
import { MarkdownDocument } from "@/components/MarkdownDocument";
import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCount } from "@/lib/format";
import { getWeekBias } from "@/lib/week";
import {
  SAFE_TABLE_COLUMNS,
  getCockpitMarkdowns,
  getLatestLedgerTail,
  getManifestSummary,
  getQueueSummaries,
} from "@/lib/server/officeArtifacts";

export default async function HomePage() {
  const [manifest, queues, docs, ledger] = await Promise.all([
    getManifestSummary(),
    getQueueSummaries(),
    getCockpitMarkdowns(),
    getLatestLedgerTail(30),
  ]);

  const week = getWeekBias();
  const focus = queues.find((q) => q.key === "focus");
  const maint = queues.find((q) => q.key === "maint");
  const support = queues.find((q) => q.key === "support");
  const watch = queues.find((q) => q.key === "watch");
  const post = queues.find((q) => q.key === "post");

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="eyebrow">Today Cockpit</div>
          <h1>Office Window</h1>
          <p>
            A local read-only view over the current Office artifacts. No writes,
            no CLI execution, no second source of truth.
          </p>
        </div>

        <div className="week-card">
          <div className="eyebrow">{week.dayName}</div>
          <h2>{week.label}</h2>
          <p>{week.description}</p>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard
          label="Compile status"
          value={manifest.status || "missing"}
          detail={manifest.exists ? manifest.relPath : "manifest not found"}
        />
        <MetricCard label="Run id" value={manifest.runId || "—"} />
        <MetricCard label="Warnings" value={manifest.warnings} />
        <MetricCard
          label="Merged rows"
          value={formatCount(manifest.rowCounts.merged || manifest.rowCounts.merged_state)}
        />
        <MetricCard label="FOCUS" value={focus?.count ?? 0} detail={focus?.file} />
        <MetricCard label="MAINT" value={maint?.count ?? 0} detail={maint?.file} />
        <MetricCard label="SUPPORT" value={support?.count ?? 0} detail={support?.file} />
        <MetricCard label="WATCH" value={watch?.count ?? 0} detail={watch?.file} />
        <MetricCard label="POST" value={post?.count ?? 0} detail={post?.file} />
      </section>

      <SectionCard title="Queue preview" eyebrow="current latest">
        <div className="queue-preview-grid">
          {queues.slice(0, 5).map((queue) => (
            <div key={queue.key} className="queue-mini-card">
              <div className="queue-mini-head">
                <h3>{queue.title}</h3>
                <StatusBadge status={queue.exists ? "ok" : "missing"} subtle />
              </div>
              <p>{queue.description}</p>
              <CsvTable
                rows={queue.rows}
                preferredColumns={SAFE_TABLE_COLUMNS}
                maxRows={3}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <section className="doc-grid">
        {docs.map((doc) => (
          <MarkdownDocument
            key={doc.key}
            title={doc.title}
            content={doc.content}
            empty={`${doc.file} not found.`}
          />
        ))}
      </section>

      <SectionCard title="Latest ledger tail" eyebrow="logs/daily">
        <LedgerTail ledger={ledger} />
      </SectionCard>
    </div>
  );
}
