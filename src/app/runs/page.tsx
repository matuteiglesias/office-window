import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCount, formatMtime } from "@/lib/format";
import { getRunSummaries } from "@/lib/server/officeArtifacts";

export default async function RunsPage() {
  const runs = await getRunSummaries(16);

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Compile history</div>
        <h1>Runs</h1>
        <p>
          Recent run directories under <code>artifacts/runs</code>. No replay,
          no deletion, no mutation.
        </p>
      </header>

      <div className="run-grid">
        {runs.map((run) => (
          <SectionCard key={run.runId} title={run.runId} eyebrow={run.relPath}>
            <div className="section-meta">
              <StatusBadge status={run.status} />
              <span>modified {formatMtime(run.mtimeMs)}</span>
            </div>
            <div className="metrics-grid compact">
              <MetricCard label="Warnings" value={run.warnings} />
              <MetricCard
                label="Merged"
                value={formatCount(run.rowCounts.merged || run.rowCounts.merged_state)}
              />
              <MetricCard
                label="Expressed"
                value={formatCount(
                  run.rowCounts.expressed || run.rowCounts.expressed_state,
                )}
              />
            </div>
          </SectionCard>
        ))}
      </div>

      {runs.length === 0 ? <p className="muted">No runs found.</p> : null}
    </div>
  );
}
