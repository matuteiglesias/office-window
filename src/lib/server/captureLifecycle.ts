import { readArtifactText } from "@/lib/server/artifactRoots";
import {
  CAPTURE_LIFECYCLE_STATUSES,
  type CaptureLifecycleStatus,
} from "@/lib/captureOntology";
import {
  type CaptureEvent,
  getRecentCaptureEvents,
  normalizeCaptureAudioRelPath,
} from "@/lib/server/captureEvents";

export type CaptureLifecycleSource = "compiled" | "raw_fallback";

export type CaptureLifecycleItem = {
  event_id: string;
  created_at: string;
  status: CaptureLifecycleStatus;
  target: {
    queue_key: string;
    queue_file: string;
    project_id: string;
    title: string;
  };
  route?: string;
  audio?: {
    rel_path: string;
    mime_type?: string;
    bytes?: number;
  } | null;
  human_note?: string;
  transcript?: { text?: string; model?: string; created_at?: string } | null;
  routing?: {
    capture_mode?: string;
    lane?: string;
    artifact_type?: string;
    routing_sentence?: string;
  } | null;
  artifact_candidate?: {
    type?: string;
    title?: string;
    text?: string;
    confidence?: string;
    artifact_path?: string;
  } | null;
  reingest_candidate?: {
    target_surface?: string;
    target_id?: string;
    proposed_delta?: unknown;
    requires_human_approval?: boolean;
  } | null;
  events?: string[];
  approval?: {
    target_surface?: string;
    target_id?: string;
    approved_delta?: unknown;
    requires_apply?: boolean;
  } | null;
  review?: { reviewer?: string; note?: string } | null;
  discard?: { reason?: string; note?: string } | null;
  archive?: { reason?: string; note?: string } | null;
  request?: { stage?: string; instruction?: string } | null;
};

export type CaptureLifecycle = {
  source: CaptureLifecycleSource;
  generatedAt: string | null;
  warning: string | null;
  statusCounts: Record<string, number>;
  captures: CaptureLifecycleItem[];
};

const STATUS_SET = new Set<string>(CAPTURE_LIFECYCLE_STATUSES);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStatus(value: unknown): CaptureLifecycleStatus {
  const status = asString(value);
  return status && STATUS_SET.has(status) ? (status as CaptureLifecycleStatus) : "pending_transcription";
}

function countStatuses(captures: CaptureLifecycleItem[]): Record<string, number> {
  const counts = Object.fromEntries(CAPTURE_LIFECYCLE_STATUSES.map((status) => [status, 0]));
  for (const capture of captures) counts[capture.status] = (counts[capture.status] ?? 0) + 1;
  return counts;
}

function parseStatusCounts(value: unknown, captures: CaptureLifecycleItem[]): Record<string, number> {
  const counts = countStatuses(captures);
  const record = asRecord(value);
  if (!record) return counts;

  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) counts[key] = raw;
  }
  return counts;
}

function parseTarget(value: unknown): CaptureLifecycleItem["target"] {
  const target = asRecord(value) ?? {};
  return {
    queue_key: asString(target.queue_key) ?? "",
    queue_file: asString(target.queue_file) ?? "",
    project_id: asString(target.project_id) ?? "",
    title: asString(target.title) ?? "",
  };
}

function parseAudio(value: unknown): CaptureLifecycleItem["audio"] {
  const audio = asRecord(value);
  if (!audio) return null;
  const relPath = normalizeCaptureAudioRelPath(asString(audio.rel_path) ?? "");
  if (!relPath) return null;
  return {
    rel_path: relPath,
    mime_type: asString(audio.mime_type),
    bytes: asNumber(audio.bytes),
  };
}

function copyOptionalObject<T extends Record<string, unknown>>(value: unknown): T | null {
  const record = asRecord(value);
  return record ? (record as T) : null;
}

function parseEvents(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const events = value.filter((event): event is string => typeof event === "string");
  return events.length ? events : undefined;
}

function parseCompiledCapture(value: unknown): CaptureLifecycleItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const eventId = asString(record.event_id) ?? asString(record.source_event_id);
  if (!eventId) return null;

  const item: CaptureLifecycleItem = {
    event_id: eventId,
    created_at: asString(record.created_at) ?? asString(record.ts) ?? "",
    status: asStatus(record.status),
    target: parseTarget(record.target),
    route: asString(record.route),
    audio: parseAudio(record.audio),
    human_note: asString(record.human_note) ?? asString(record.note),
    transcript: copyOptionalObject(record.transcript),
    routing: copyOptionalObject(record.routing),
    artifact_candidate: copyOptionalObject(record.artifact_candidate),
    reingest_candidate: copyOptionalObject(record.reingest_candidate),
    events: parseEvents(record.events),
    approval: copyOptionalObject(record.approval),
    review: copyOptionalObject(record.review),
    discard: copyOptionalObject(record.discard),
    archive: copyOptionalObject(record.archive),
    request: copyOptionalObject(record.request),
  };

  return item;
}

function parseCompiledLifecycle(content: string): Omit<CaptureLifecycle, "source" | "warning"> {
  const parsed = JSON.parse(content) as unknown;
  const root = asRecord(parsed);
  if (!root) throw new Error("Compiled lifecycle root must be an object.");

  const capturesRaw = Array.isArray(root.captures) ? root.captures : [];
  const captures = capturesRaw.map(parseCompiledCapture).filter((item): item is CaptureLifecycleItem => Boolean(item));

  return {
    generatedAt: asString(root.generated_at) ?? null,
    statusCounts: parseStatusCounts(root.status_counts, captures),
    captures,
  };
}

function fromRawEvent(event: CaptureEvent): CaptureLifecycleItem {
  return {
    event_id: event.event_id,
    created_at: event.ts,
    status: asStatus(event.status),
    target: event.target,
    route: event.route,
    audio: parseAudio(event.audio),
    human_note: event.note,
    transcript: event.transcript,
    routing: event.routing,
    artifact_candidate: event.artifact_candidate,
    reingest_candidate: event.reingest_candidate,
    events: ["capture.created"],
  };
}

async function rawFallback(warning: string | null): Promise<CaptureLifecycle> {
  const captures = (await getRecentCaptureEvents(100)).map(fromRawEvent);
  return {
    source: "raw_fallback",
    generatedAt: null,
    warning,
    statusCounts: countStatuses(captures),
    captures,
  };
}

export async function getCaptureLifecycle(): Promise<CaptureLifecycle> {
  const artifact = await readArtifactText(["latest", "capture_lifecycle.json"], 5_000_000);
  if (!artifact.exists) {
    return rawFallback("Compiled capture lifecycle not found; showing raw capture inbox.");
  }

  try {
    const compiled = parseCompiledLifecycle(artifact.content);
    return {
      source: "compiled",
      warning: null,
      ...compiled,
    };
  } catch {
    return rawFallback("Compiled lifecycle failed to parse; showing raw capture inbox.");
  }
}
