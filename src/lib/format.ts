export function formatCount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }

  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n.toLocaleString();
    return value;
  }

  return "—";
}

export function formatMtime(mtimeMs: number | null | undefined): string {
  if (!mtimeMs) return "unknown";
  return new Date(mtimeMs).toLocaleString();
}

export function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
