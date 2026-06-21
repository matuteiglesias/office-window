import type { CsvRow } from "@/lib/server/csv";
import { safeColumns } from "@/lib/server/csv";
import { truncate } from "@/lib/format";

export function CsvTable({
  rows,
  preferredColumns,
  maxRows = 8,
}: {
  rows: CsvRow[];
  preferredColumns: string[];
  maxRows?: number;
}) {
  if (rows.length === 0) {
    return <p className="muted">No rows.</p>;
  }

  const columns = safeColumns(rows, preferredColumns);
  const visibleRows = rows.slice(0, maxRows);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col}>{truncate(row[col] || "", 110)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows ? (
        <div className="table-note">Showing {maxRows} of {rows.length} rows.</div>
      ) : null}
    </div>
  );
}
