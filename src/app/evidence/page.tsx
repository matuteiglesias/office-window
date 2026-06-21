import { LedgerTail } from "@/components/LedgerTail";
import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import { getEvidenceOverview } from "@/lib/server/officeArtifacts";

export default async function EvidencePage() {
  const evidence = await getEvidenceOverview();

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Observability</div>
        <h1>Evidence</h1>
        <p>
          Ledger and log visibility. This page does not scan arbitrary evidence
          paths or open repository files.
        </p>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Daily ledgers" value={evidence.ledgerFiles} />
        <MetricCard label="Structured event logs" value={evidence.eventFiles} />
        <MetricCard label="Wrapper logs" value={evidence.wrapperFiles} />
      </section>

      <SectionCard title="Latest ledger tail" eyebrow="logs/daily">
        <LedgerTail ledger={evidence.latestLedger} />
      </SectionCard>
    </div>
  );
}
