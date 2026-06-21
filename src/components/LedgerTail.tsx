import type { LedgerTail as LedgerTailType } from "@/lib/server/officeArtifacts";

export function LedgerTail({ ledger }: { ledger: LedgerTailType }) {
  if (!ledger.exists) {
    return <p className="muted">No daily ledger found.</p>;
  }

  return (
    <div>
      <div className="artifact-path">{ledger.relPath}</div>
      <pre className="log-box">
        {ledger.lines.length ? ledger.lines.join("\n") : "(empty ledger)"}
      </pre>
    </div>
  );
}
