export type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += ch;
  }

  cells.push(cell);
  return cells.map((x) => x.trim());
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h, i) => h || `unnamed_${i}`);
  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: CsvRow = {};

    headers.forEach((header, i) => {
      row[header] = values[i] ?? "";
    });

    rows.push(row);
  }

  return rows;
}

export function safeColumns(rows: CsvRow[], preferred: string[]): string[] {
  const available = new Set(rows.flatMap((row) => Object.keys(row)));
  const cols = preferred.filter((col) => available.has(col));
  if (cols.length > 0) return cols;

  const first = rows[0];
  if (!first) return [];

  return Object.keys(first).slice(0, 8);
}
