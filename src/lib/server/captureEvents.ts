import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { type CaptureLifecycleStatus } from "@/lib/captureOntology";
export { CAPTURE_LIFECYCLE_STATUSES } from "@/lib/captureOntology";

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

export type CaptureReviewDecision =
  | "approve"
  | "edit_approve"
  | "discard"
  | "reject"
  | "archive"
  | "reprocess";

export type CaptureReviewRequest = {
  source_event_id: string;
  decision: CaptureReviewDecision;
  note?: string;
  approved_delta?: Record<string, unknown>;
  target_surface?: string;
  target_id?: string;
  reason?: string;
  stage?: string;
  instruction?: string;
};

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

function assertSafeEventId(eventId: string) {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(eventId)) {
    throw new Error("Invalid source event id.");
  }
}

function getCaptureProcessingInboxRoot() {
  const configured = process.env.OFFICE_CAPTURE_PROCESSING_INBOX;
  if (configured) return path.resolve(configured);

  const labRoot = process.env.OFFICE_AUTO_LAB_ROOT;
  if (labRoot) return path.resolve(labRoot, "inbox", "capture_processing");

  const feedbackInbox = process.env.OFFICE_FEEDBACK_INBOX;
  if (feedbackInbox) return path.resolve(feedbackInbox, "..", "capture_processing");

  throw new Error(
    "Capture review storage is not configured. Set OFFICE_CAPTURE_PROCESSING_INBOX, OFFICE_AUTO_LAB_ROOT, or OFFICE_FEEDBACK_INBOX.",
  );
}

function sanitizeJsonObject(value: unknown, fieldName: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
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


export function sanitizeCaptureReviewRequest(raw: unknown):
  | { ok: true; value: CaptureReviewRequest }
  | { ok: false; error: string } {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "Request body must be a JSON object." };
    }

    const obj = raw as Record<string, unknown>;
    const sourceEventId = obj.source_event_id;
    if (typeof sourceEventId !== "string" || !sourceEventId.trim()) {
      return { ok: false, error: "source_event_id is required." };
    }
    assertSafeEventId(sourceEventId);

    const decision = obj.decision;
    if (!isCaptureReviewDecision(decision)) {
      return {
        ok: false,
        error: "decision must be approve, edit_approve, discard, reject, archive, or reprocess.",
      };
    }

    const approvedDelta = sanitizeJsonObject(obj.approved_delta, "approved_delta");

    return {
      ok: true,
      value: {
        source_event_id: sourceEventId,
        decision,
        ...(typeof obj.note === "string" ? { note: normalizeReviewText(obj.note) } : {}),
        ...(approvedDelta ? { approved_delta: approvedDelta } : {}),
        ...(typeof obj.target_surface === "string"
          ? { target_surface: normalizeReviewText(obj.target_surface) }
          : {}),
        ...(typeof obj.target_id === "string" ? { target_id: normalizeReviewText(obj.target_id) } : {}),
        ...(typeof obj.reason === "string" ? { reason: normalizeReviewText(obj.reason) } : {}),
        ...(typeof obj.stage === "string" ? { stage: normalizeReviewText(obj.stage) } : {}),
        ...(typeof obj.instruction === "string"
          ? { instruction: normalizeReviewText(obj.instruction) }
          : {}),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid capture review request.",
    };
  }
}

function isCaptureReviewDecision(value: unknown): value is CaptureReviewDecision {
  return (
    value === "approve" ||
    value === "edit_approve" ||
    value === "discard" ||
    value === "reject" ||
    value === "archive" ||
    value === "reprocess"
  );
}

function normalizeReviewText(value: string) {
  return value.slice(0, 4000);
}

export async function appendCaptureReviewEvent(review: CaptureReviewRequest) {
  const inboxRoot = getCaptureProcessingInboxRoot();
  const day = localDateParts();
  const inboxPath = path.join(inboxRoot, `${day}.jsonl`);
  assertInside(inboxRoot, inboxPath);

  const event = buildCaptureReviewLifecycleEvent(review);

  await mkdir(inboxRoot, { recursive: true });
  await appendFile(inboxPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function buildCaptureReviewLifecycleEvent(review: CaptureReviewRequest) {
  const base = {
    source_event_id: review.source_event_id,
    source: "office-window",
    ts: new Date().toISOString(),
  };
  const note = review.note || "";

  if (review.decision === "approve" || review.decision === "edit_approve") {
    return {
      ...base,
      event_type: "capture.approved",
      status: "approved",
      approval: {
        scope: "reingest_candidate",
        ...(review.target_surface ? { target_surface: review.target_surface } : {}),
        ...(review.target_id ? { target_id: review.target_id } : {}),
        ...(review.approved_delta ? { approved_delta: review.approved_delta } : {}),
        requires_apply: true,
      },
      review: { reviewer: "matias", note },
    };
  }

  if (review.decision === "discard" || review.decision === "reject") {
    return {
      ...base,
      event_type: "capture.discarded",
      status: "discarded",
      discard: { reason: review.reason || "rejected_by_user", note },
    };
  }

  if (review.decision === "archive") {
    return {
      ...base,
      event_type: "capture.archived",
      status: "archived",
      archive: { reason: review.reason || "no_action_needed", note },
    };
  }

  return {
    ...base,
    event_type: "capture.reprocess_requested",
    status: "queued",
    request: {
      ...(review.stage ? { stage: review.stage } : {}),
      ...(review.instruction ? { instruction: review.instruction } : {}),
    },
  };
}

export async function appendCaptureProcessingRequest(sourceEventId: string) {
  const roots = getCaptureRoots();
  if (!roots.ok) throw new Error(roots.error);
  assertSafeEventId(sourceEventId);

  const day = localDateParts();
  const requestDir = path.join(roots.inbox, "capture_processing");
  const requestPath = path.join(requestDir, `${day}.jsonl`);
  assertInside(roots.inbox, requestPath);

  const event = {
    event_type: "capture.processing_requested",
    source_event_id: sourceEventId,
    requested_by: "office-window",
    requested_stage: "full_pipeline",
    status: "queued",
    ts: new Date().toISOString(),
  };

  await mkdir(requestDir, { recursive: true });
  await appendFile(requestPath, `${JSON.stringify(event)}\n`, "utf8");
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

export function normalizeCaptureAudioRelPath(relPath: string) {
  const normalized = relPath.replaceAll("\\", "/").replace(/^inbox\/human_feedback_audio\//, "");
  if (!/^\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\.webm$/.test(normalized)) return null;
  return normalized;
}

export async function readCaptureAudio(relPath: string) {
  const roots = getCaptureRoots();
  if (!roots.ok) throw new Error(roots.error);
  const safeRelPath = normalizeCaptureAudioRelPath(relPath);
  if (!safeRelPath) {
    throw new Error("Invalid capture audio path.");
  }
  const audioPath = path.join(roots.audioRoot, safeRelPath);
  assertInside(roots.audioRoot, audioPath);
  const info = await stat(audioPath);
  if (!info.isFile()) throw new Error("Capture audio not found.");
  return readFile(audioPath);
}
