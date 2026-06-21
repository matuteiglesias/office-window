import path from "path";
import { listArtifactDir, readArtifactText } from "./artifactRoots";
import { parseCsv, type CsvRow } from "./csv";

export type QueueDef = {
  key: string;
  title: string;
  file: string;
  description: string;
};

export type QueueSummary = QueueDef & {
  count: number;
  exists: boolean;
  rows: CsvRow[];
  relPath: string;
};

export type MarkdownArtifact = {
  key: string;
  title: string;
  file: string;
  exists: boolean;
  content: string;
  relPath: string;
  mtimeMs: number | null;
};

export type ManifestSummary = {
  exists: boolean;
  relPath: string;
  raw: Record<string, unknown> | null;
  runId: string | null;
  status: string | null;
  warnings: number;
  rowCounts: Record<string, unknown>;
};

export type LedgerTail = {
  exists: boolean;
  relPath: string | null;
  lines: string[];
};

export type BriefDoc = {
  name: string;
  relPath: string;
  content: string;
  mtimeMs: number | null;
};

export type RunSummary = {
  runId: string;
  status: string | null;
  warnings: number;
  rowCounts: Record<string, unknown>;
  relPath: string;
  mtimeMs: number | null;
};

export const QUEUES: QueueDef[] = [
  {
    key: "focus",
    title: "FOCUS",
    file: "focus_get_queue.csv",
    description: "Expressed deep work where staff can prepare a usable focus packet.",
  },
  {
    key: "maint",
    title: "MAINT",
    file: "maint_get_queue.csv",
    description: "Bounded upkeep, WARN reduction, checklists, prerequisites, small repairs.",
  },
  {
    key: "support",
    title: "SUPPORT",
    file: "support_queue.csv",
    description: "Health checks, unlockers, decision briefs, and diagnostics.",
  },
  {
    key: "watch",
    title: "WATCH",
    file: "watch_queue.csv",
    description: "Dormant or latent pathways that should stay quiet unless triggered.",
  },
  {
    key: "post",
    title: "POST",
    file: "post_eligible_queue.csv",
    description: "Rows that should be reingested if touched.",
  },
  {
    key: "expressed",
    title: "EXPRESSED",
    file: "expressed_state.csv",
    description: "Current expressed state surface.",
  },
  {
    key: "latent",
    title: "LATENT",
    file: "latent_state.csv",
    description: "Non-expressed state surface.",
  },
];

export const COCKPIT_MARKDOWNS = [
  { key: "office", title: "Office Summary", file: "office_summary.md" },
  { key: "today", title: "Today Compile", file: "today_compile.md" },
  { key: "clock", title: "Clock Compile", file: "clock_compile.md" },
  { key: "validation", title: "Validation Report", file: "validation_report.md" },
];

export const SAFE_TABLE_COLUMNS = [
  "project_id",
  "Title",
  "Priority",
  "carry",
  "horizon",
  "needs",
  "principal",
  "status",
  "_score",
];

export async function getManifestSummary(): Promise<ManifestSummary> {
  const artifact = await readArtifactText(["latest", "manifest.json"], 256_000);

  if (!artifact.exists) {
    return {
      exists: false,
      relPath: artifact.relPath,
      raw: null,
      runId: null,
      status: null,
      warnings: 0,
      rowCounts: {},
    };
  }

  try {
    const raw = JSON.parse(artifact.content) as Record<string, unknown>;
    const warningsRaw = raw.warnings;
    const warnings = Array.isArray(warningsRaw) ? warningsRaw.length : 0;

    return {
      exists: true,
      relPath: artifact.relPath,
      raw,
      runId: typeof raw.run_id === "string" ? raw.run_id : null,
      status: typeof raw.status === "string" ? raw.status : null,
      warnings,
      rowCounts:
        typeof raw.row_counts === "object" && raw.row_counts !== null
          ? (raw.row_counts as Record<string, unknown>)
          : {},
    };
  } catch {
    return {
      exists: true,
      relPath: artifact.relPath,
      raw: null,
      runId: null,
      status: "invalid-json",
      warnings: 0,
      rowCounts: {},
    };
  }
}

export async function readLatestCsv(file: string): Promise<{
  exists: boolean;
  relPath: string;
  rows: CsvRow[];
}> {
  const artifact = await readArtifactText(["latest", file], 2_000_000);
  return {
    exists: artifact.exists,
    relPath: artifact.relPath,
    rows: artifact.exists ? parseCsv(artifact.content) : [],
  };
}

export async function getQueueSummaries(): Promise<QueueSummary[]> {
  const out: QueueSummary[] = [];

  for (const q of QUEUES) {
    const csv = await readLatestCsv(q.file);
    out.push({
      ...q,
      count: csv.rows.length,
      exists: csv.exists,
      rows: csv.rows,
      relPath: csv.relPath,
    });
  }

  return out;
}

export async function getCockpitMarkdowns(): Promise<MarkdownArtifact[]> {
  const out: MarkdownArtifact[] = [];

  for (const doc of COCKPIT_MARKDOWNS) {
    const artifact = await readArtifactText(["latest", doc.file], 512_000);
    out.push({
      ...doc,
      exists: artifact.exists,
      content: artifact.content,
      relPath: artifact.relPath,
      mtimeMs: artifact.mtimeMs,
    });
  }

  return out;
}

export async function getLatestLedgerTail(limit = 40): Promise<LedgerTail> {
  const daily = await listArtifactDir(["logs", "daily"]);
  const candidates = daily.filter((x) => x.isFile && x.name.endsWith(".ledger.log"));

  if (candidates.length === 0) {
    return { exists: false, relPath: null, lines: [] };
  }

  const latest = candidates.sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  if (!latest) {
    return { exists: false, relPath: null, lines: [] };
  }

  const artifact = await readArtifactText(latest.relPath.split(path.sep), 512_000);
  const lines = artifact.content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-limit);

  return {
    exists: artifact.exists,
    relPath: artifact.relPath,
    lines,
  };
}

export async function getBriefDocs(limit = 12): Promise<BriefDoc[]> {
  const entries = await listArtifactDir(["latest", "briefs"]);
  const mdFiles = entries
    .filter((x) => x.isFile && x.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);

  const out: BriefDoc[] = [];

  for (const entry of mdFiles) {
    const artifact = await readArtifactText(entry.relPath.split(path.sep), 512_000);
    out.push({
      name: entry.name,
      relPath: artifact.relPath,
      content: artifact.content,
      mtimeMs: artifact.mtimeMs,
    });
  }

  return out;
}

export async function getBriefIndex(): Promise<CsvRow[]> {
  const csv = await readLatestCsv("brief_index.csv");
  return csv.rows;
}

export async function getAiJobs(): Promise<CsvRow[]> {
  const csv = await readLatestCsv("ai_jobs.csv");
  return csv.rows;
}

export async function getRunSummaries(limit = 12): Promise<RunSummary[]> {
  const runDirs = await listArtifactDir(["runs"]);
  const dirs = runDirs
    .filter((x) => x.isDirectory)
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, limit);

  const out: RunSummary[] = [];

  for (const dir of dirs) {
    const manifest = await readArtifactText(["runs", dir.name, "manifest.json"], 256_000);
    let status: string | null = null;
    let warnings = 0;
    let rowCounts: Record<string, unknown> = {};

    if (manifest.exists) {
      try {
        const raw = JSON.parse(manifest.content) as Record<string, unknown>;
        status = typeof raw.status === "string" ? raw.status : null;
        warnings = Array.isArray(raw.warnings) ? raw.warnings.length : 0;
        rowCounts =
          typeof raw.row_counts === "object" && raw.row_counts !== null
            ? (raw.row_counts as Record<string, unknown>)
            : {};
      } catch {
        status = "invalid-json";
      }
    }

    out.push({
      runId: dir.name,
      status,
      warnings,
      rowCounts,
      relPath: dir.relPath,
      mtimeMs: dir.mtimeMs,
    });
  }

  return out;
}

export async function getEvidenceOverview(): Promise<{
  ledgerFiles: number;
  eventFiles: number;
  wrapperFiles: number;
  latestLedger: LedgerTail;
}> {
  const ledgerFiles = (await listArtifactDir(["logs", "daily"])).filter(
    (x) => x.isFile && x.name.endsWith(".ledger.log"),
  ).length;
  const eventFiles = (await listArtifactDir(["logs", "events"])).filter(
    (x) => x.isFile && x.name.endsWith(".jsonl"),
  ).length;
  const wrapperFiles = (await listArtifactDir(["logs", "wrapper"])).filter(
    (x) => x.isFile && x.name.endsWith(".log"),
  ).length;

  return {
    ledgerFiles,
    eventFiles,
    wrapperFiles,
    latestLedger: await getLatestLedgerTail(80),
  };
}
