import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const CAPTURE_SAFE_COLUMNS = [
  "project_id",
  "Title",
  "Priority",
  "carry",
  "horizon",
  "needs",
  "principal",
  "status",
  "_score",
] as const;

type CaptureTarget = {
  queue_key: string;
  queue_file: string;
  project_id: string;
  title: string;
};

type CaptureMetadata = {
  route: string;
  target: CaptureTarget;
  row_snapshot: Record<string, string>;
};

export const CAPTURE_LIFECYCLE_STATUSES = [
  "pending_transcription",
  "transcribed",
  "routed",
  "artifact_candidate",
  "pending_reingest",
  "applied",
  "archived",
  "discarded",
  "failed",
] as const;

export type CaptureLifecycleStatus = (typeof CAPTURE_LIFECYCLE_STATUSES)[number];

export type CaptureEvent = {
  event_id: string;
  ts: string;
  source: "office-window";
  capture_modality: "audio";
  capture_type: "row_voice_note";
  status: CaptureLifecycleStatus;
  route: string;
  target_kind: "queue_row";
  target: CaptureTarget;
  row_snapshot: Record<string, string>;
  audio: {
    rel_path: string;
    mime_type: string;
    bytes: number;
  };
  note?: string;
  transcript: { text?: string; model?: string } | null;
  routing?: {
    capture_mode?: string;
    lane?: string;
    artifact_type?: string;
    routing_sentence?: string;
  } | null;
  artifact_candidate?: {
    type?: string;
    text?: string;
  } | null;
  reingest_candidate?: {
    target_surface?: string;
    proposed_delta?: unknown;
    requires_human_approval?: boolean;
  } | null;
  agent_notes: unknown;
};

export function getCaptureRoots() {
  const inbox = process.env.OFFICE_FEEDBACK_INBOX;
  const audioRoot = process.env.OFFICE_FEEDBACK_AUDIO_ROOT;

  if (!inbox || !audioRoot) {
    return {
      ok: false as const,
      error:
        "Capture storage is not configured. Set OFFICE_FEEDBACK_INBOX and OFFICE_FEEDBACK_AUDIO_ROOT.",
    };
  }

  return { ok: true as const, inbox: path.resolve(inbox), audioRoot: path.resolve(audioRoot) };
}

function assertInside(root: string, candidate: string) {
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Refusing to write outside configured capture roots.");
  }
}

function localDateParts(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function sanitizeCaptureMetadata(raw: unknown): CaptureMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const target = obj.target;
  if (!target || typeof target !== "object") return null;
  const t = target as Record<string, unknown>;
  const route = typeof obj.route === "string" && obj.route === "/queues" ? obj.route : null;
  const queueKey = typeof t.queue_key === "string" ? t.queue_key : "";
  const queueFile = typeof t.queue_file === "string" ? t.queue_file : "";
  const projectId = typeof t.project_id === "string" ? t.project_id : "";
  const title = typeof t.title === "string" ? t.title : "";

  if (!route || !queueKey || !queueFile || !projectId) return null;

  const inputSnapshot =
    obj.row_snapshot && typeof obj.row_snapshot === "object"
      ? (obj.row_snapshot as Record<string, unknown>)
      : {};
  const row_snapshot: Record<string, string> = {};
  for (const col of CAPTURE_SAFE_COLUMNS) {
    const value = inputSnapshot[col];
    row_snapshot[col] = typeof value === "string" ? value : "";
  }

  return {
    route,
    target: { queue_key: queueKey, queue_file: queueFile, project_id: projectId, title },
    row_snapshot,
  };
}

export async function saveAudioCapture({
  audio,
  mimeType,
  metadata,
  note,
}: {
  audio: Buffer;
  mimeType: string;
  metadata: CaptureMetadata;
  note?: string;
}) {
  const roots = getCaptureRoots();
  if (!roots.ok) throw new Error(roots.error);

  const eventId = randomUUID();
  const day = localDateParts();
  const audioDir = path.join(roots.audioRoot, day);
  const audioPath = path.join(audioDir, `${eventId}.webm`);
  const inboxPath = path.join(roots.inbox, `${day}.jsonl`);

  assertInside(roots.audioRoot, audioPath);
  assertInside(roots.inbox, inboxPath);

  await mkdir(audioDir, { recursive: true });
  await mkdir(roots.inbox, { recursive: true });
  await writeFile(audioPath, audio);

  const event: CaptureEvent = {
    event_id: eventId,
    ts: new Date().toISOString(),
    source: "office-window",
    capture_modality: "audio",
    capture_type: "row_voice_note",
    status: "pending_transcription",
    route: metadata.route,
    target_kind: "queue_row",
    target: metadata.target,
    row_snapshot: metadata.row_snapshot,
    audio: { rel_path: `${day}/${eventId}.webm`, mime_type: mimeType, bytes: audio.byteLength },
    ...(note ? { note } : {}),
    transcript: null,
    agent_notes: null,
  };

  await appendFile(inboxPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function getRecentCaptureEvents(limit = 50): Promise<CaptureEvent[]> {
  const roots = getCaptureRoots();
  if (!roots.ok) return [];

  let entries: string[] = [];
  try {
    entries = await readdir(roots.inbox);
  } catch {
    return [];
  }

  const files = entries
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()
    .reverse()
    .slice(0, 7);

  const events: CaptureEvent[] = [];
  for (const file of files) {
    const fullPath = path.join(roots.inbox, file);
    assertInside(roots.inbox, fullPath);
    const text = await readFile(fullPath, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as CaptureEvent);
      } catch {
        // Skip malformed append records instead of breaking the page.
      }
    }
  }

  return events.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export async function readCaptureAudio(relPath: string) {
  const roots = getCaptureRoots();
  if (!roots.ok) throw new Error(roots.error);
  if (!/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.webm$/.test(relPath)) {
    throw new Error("Invalid capture audio path.");
  }
  const audioPath = path.join(roots.audioRoot, relPath);
  assertInside(roots.audioRoot, audioPath);
  const info = await stat(audioPath);
  if (!info.isFile()) throw new Error("Capture audio not found.");
  return readFile(audioPath);
}
