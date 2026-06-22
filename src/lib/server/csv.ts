export type CsvRow = Record<string, string>;

// function parseCsvLine(line: string): string[] {
//   const cells: string[] = [];
//   let cell = "";
//   let inQuotes = false;

//   for (let i = 0; i < line.length; i += 1) {
//     const ch = line[i];
//     const next = line[i + 1];

//     if (ch === '"' && inQuotes && next === '"') {
//       cell += '"';
//       i += 1;
//       continue;
//     }

//     if (ch === '"') {
//       inQuotes = !inQuotes;
//       continue;
//     }

//     if (ch === "," && !inQuotes) {
//       cells.push(cell);
//       cell = "";
//       continue;
//     }

//     cell += ch;
//   }

//   cells.push(cell);
//   return cells.map((x) => x.trim());
// }


import { parse } from "csv-parse/sync";


export function parseCsv(text: string): CsvRow[] {
  if (!text.trim()) return [];

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, unknown>[];

  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
    ),
  );
}

export function safeColumns(rows: CsvRow[], preferred: string[]): string[] {
  const available = new Set(rows.flatMap((row) => Object.keys(row)));
  const cols = preferred.filter((col) => available.has(col));
  if (cols.length > 0) return cols;

  const first = rows[0];
  if (!first) return [];

  return Object.keys(first).slice(0, 8);
}