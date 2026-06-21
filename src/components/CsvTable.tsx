import type { CsvRow } from "@/lib/server/csv";
import { safeColumns } from "@/lib/server/csv";
import { QueueCaptureButton } from "@/components/capture/QueueCaptureButton";
import { truncate } from "@/lib/format";

export function CsvTable({
  rows,
  preferredColumns,
  maxRows,
  captureQueue,
}: {
  rows: CsvRow[];
  preferredColumns: string[];
  maxRows?: number;
  captureQueue?: { key: string; file: string };
}) {
  if (rows.length === 0) {
    return <p className="muted">No rows.</p>;
  }

  const columns = safeColumns(rows, preferredColumns);
  const rowLimit = maxRows ?? (captureQueue ? rows.length : 8);
  const visibleRows = rows.slice(0, rowLimit);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {captureQueue ? <th>capture</th> : null}
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, idx) => (
            <tr key={idx}>
              {captureQueue ? (
                <td>
                  <QueueCaptureButton
                    queueKey={captureQueue.key}
                    queueFile={captureQueue.file}
                    projectId={row.project_id || ""}
                    title={row.Title || ""}
                    rowSnapshot={Object.fromEntries(preferredColumns.map((col) => [col, row[col] || ""]))}
                  />
                </td>
              ) : null}
              {columns.map((col) => (
                <td key={col}>{truncate(row[col] || "", 110)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > rowLimit ? (
        <div className="table-note">Showing {rowLimit} of {rows.length} rows.</div>
      ) : null}
    </div>
  );
}
