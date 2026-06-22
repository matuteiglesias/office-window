import { readArtifactText } from "@/lib/server/artifactRoots";
import { parseCsv, type CsvRow } from "@/lib/server/csv";

export type CaptureCandidateArtifacts = {
  candidatesJson: {
    exists: boolean;
    content: unknown | null;
    warning: string | null;
    generatedAt: string | null;
  };
  candidatesMarkdown: { exists: boolean; content: string };
  blockStubsCsv: { exists: boolean; rows: CsvRow[]; warning: string | null };
  blockStubsMarkdown: { exists: boolean; content: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function getCaptureCandidateArtifacts(): Promise<CaptureCandidateArtifacts> {
  const [candidatesJsonArtifact, candidatesMarkdown, blockStubsCsvArtifact, blockStubsMarkdown] = await Promise.all([
    readArtifactText(["latest", "capture_candidates.json"], 5_000_000),
    readArtifactText(["latest", "capture_candidates.md"], 1_000_000),
    readArtifactText(["latest", "block_candidate_stubs.csv"], 2_000_000),
    readArtifactText(["latest", "block_candidate_stubs.md"], 1_000_000),
  ]);

  let candidatesContent: unknown | null = null;
  let candidatesWarning: string | null = null;
  let generatedAt: string | null = null;
  if (candidatesJsonArtifact.exists) {
    try {
      candidatesContent = JSON.parse(candidatesJsonArtifact.content) as unknown;
      generatedAt = asString(asRecord(candidatesContent)?.generated_at) ?? null;
    } catch {
      candidatesWarning = "Capture candidates JSON is malformed; showing markdown summary if available.";
    }
  }

  let blockRows: CsvRow[] = [];
  let blockWarning: string | null = null;
  if (blockStubsCsvArtifact.exists) {
    try {
      blockRows = parseCsv(blockStubsCsvArtifact.content);
    } catch {
      blockWarning = "Work block candidate stubs CSV is malformed; showing markdown summary if available.";
    }
  }

  return {
    candidatesJson: {
      exists: candidatesJsonArtifact.exists,
      content: candidatesContent,
      warning: candidatesWarning,
      generatedAt,
    },
    candidatesMarkdown: {
      exists: candidatesMarkdown.exists,
      content: candidatesMarkdown.content,
    },
    blockStubsCsv: {
      exists: blockStubsCsvArtifact.exists,
      rows: blockRows,
      warning: blockWarning,
    },
    blockStubsMarkdown: {
      exists: blockStubsMarkdown.exists,
      content: blockStubsMarkdown.content,
    },
  };
}
