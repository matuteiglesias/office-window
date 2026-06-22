export const CAPTURE_EVENT_TYPES = [
  "capture.created",
  "capture.processing_requested",
  "capture.transcribed",
  "capture.routed",
  "capture.artifact_candidate.created",
  "capture.reingest_candidate.created",
  "capture.approved",
  "capture.applied",
  "capture.archived",
  "capture.discarded",
  "capture.reprocess_requested",
] as const;

export type CaptureEventType = (typeof CAPTURE_EVENT_TYPES)[number];

export const CAPTURE_LIFECYCLE_STATUSES = [
  "pending_transcription",
  "queued",
  "transcribed",
  "routed",
  "artifact_candidate",
  "pending_reingest",
  "approved",
  "applied",
  "archived",
  "discarded",
  "failed",
] as const;

export type CaptureLifecycleStatus = (typeof CAPTURE_LIFECYCLE_STATUSES)[number];

export const CAPTURE_MODES = [
  "inbox",
  "re_entry",
  "correction",
  "decision",
  "closure",
  "parking_lot",
  "support_context",
] as const;

export type CaptureMode = (typeof CAPTURE_MODES)[number];

export const CAPTURE_LANES = [
  "projects_ops",
  "front_desk",
  "support_context",
  "runbooks",
  "briefs",
  "archive",
  "unknown",
] as const;

export type CaptureLane = (typeof CAPTURE_LANES)[number];

export const CAPTURE_ARTIFACT_CANDIDATE_TYPES = [
  "next_pointer",
  "closure_memo",
  "decision_note",
  "runbook_patch",
  "checklist_item",
  "correction",
  "park_instruction",
  "support_context_note",
  "work_block_candidate_stub",
] as const;

export type CaptureArtifactCandidateType = (typeof CAPTURE_ARTIFACT_CANDIDATE_TYPES)[number];

export const CAPTURE_REINGEST_TARGET_SURFACES = [
  "carry_state",
  "support_context",
  "front_registry_note",
  "project_next_pointer",
  "block_candidate_stub",
  "runbook_candidate",
  "brief_correction",
  "archive_decision",
] as const;

export type CaptureReingestTargetSurface = (typeof CAPTURE_REINGEST_TARGET_SURFACES)[number];
