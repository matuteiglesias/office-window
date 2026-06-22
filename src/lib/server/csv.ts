export type CsvRow = Record<string, string>;

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

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
      record.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      record.push(cell.trim());
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  record.push(cell.trim());
  if (record.some((value) => value.length > 0)) records.push(record);
  return records;
}

export function parseCsv(text: string): CsvRow[] {
  if (!text.trim()) return [];

  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  const [headers, ...rows] = records;
  if (!headers) return [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
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
