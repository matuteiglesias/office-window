# Capture processing architecture

## Decision summary

Preserve this boundary:

> Raw input is not system state. Process produces reviewable events. Apply is a later explicit reingest operation.

`office-window` remains the local capture UI and lifecycle observer. `office-auto-lab` owns server-side processing, OpenAI API usage, routing, candidate generation, and any future explicit apply/reingest tools. This document describes the shared event surfaces that let those repos cooperate without coupling UI capture to Office state mutation.

## Current raw capture event

Raw capture events are append-only records written by `office-window` to:

```text
inbox/human_feedback/YYYY-MM-DD.jsonl
inbox/human_feedback_audio/YYYY-MM-DD/<event_id>.webm
```

Raw events SHOULD keep their original shape and SHOULD NOT be rewritten by processing tools.

Required raw fields:

| Field | Description |
| --- | --- |
| `event_id` | Stable UUID for the raw capture. |
| `event_type` | Optional for current compatibility; future raw records SHOULD use `capture.created`. |
| `ts` | Capture creation timestamp. |
| `source` | `office-window`. |
| `capture_modality` | `audio` for row voice notes. |
| `capture_type` | `row_voice_note` initially. |
| `status` | Initial lifecycle status, normally `pending_transcription`. |
| `route` | UI route that originated capture, such as `/queues`. |
| `target_kind` | Initial target kind, such as `queue_row`. |
| `target` | Row-linked target metadata. |
| `row_snapshot` | Safe display fields copied from the UI row. |
| `audio.rel_path` | Relative audio path under `inbox/human_feedback_audio`. |
| `note` | Optional human text note. |

## Processing event schema

Derived processing events are append-only records. Every derived event MUST include `source_event_id` linking back to the raw `event_id`. Derived events SHOULD have their own `event_id` so they can be audited independently.

Common envelope:

```json
{
  "event_id": "derived-event-uuid",
  "event_type": "capture.transcribed",
  "source_event_id": "raw-capture-uuid",
  "status": "transcribed",
  "ts": "2026-06-22T00:00:00.000Z",
  "producer": "office-auto-lab",
  "schema_version": 1
}
```

### Processing request

Future `office-window` buttons may enqueue only a request; they must not run long model calls in the browser request path.

Lives in `inbox/capture_processing/YYYY-MM-DD.jsonl`:

```json
{
  "event_id": "request-uuid",
  "event_type": "capture.processing_requested",
  "source_event_id": "raw-capture-uuid",
  "requested_by": "office-window",
  "requested_stage": "full_pipeline",
  "status": "queued",
  "ts": "2026-06-22T00:00:00.000Z",
  "schema_version": 1
}
```

### Transcription

Lives in `inbox/capture_processing/YYYY-MM-DD.jsonl`:

```json
{
  "event_id": "transcription-uuid",
  "event_type": "capture.transcribed",
  "source_event_id": "raw-capture-uuid",
  "status": "transcribed",
  "ts": "2026-06-22T00:00:00.000Z",
  "producer": "office-auto-lab",
  "schema_version": 1,
  "transcript": {
    "text": "Reply to recruiter. Do not redesign the CRM.",
    "model": "gpt-4o-mini-transcribe",
    "created_at": "2026-06-22T00:00:00.000Z"
  }
}
```

### Routing

Lives in `inbox/capture_processing/YYYY-MM-DD.jsonl`:

```json
{
  "event_id": "routing-uuid",
  "event_type": "capture.routed",
  "source_event_id": "raw-capture-uuid",
  "status": "routed",
  "ts": "2026-06-22T00:00:00.000Z",
  "producer": "office-auto-lab",
  "schema_version": 1,
  "routing": {
    "capture_mode": "re_entry",
    "lane": "projects_ops",
    "artifact_type": "next_pointer",
    "routing_sentence": "This is Re-entry capture for Projects / Ops; it should become a Next Pointer."
  }
}
```

### Artifact candidate

Small structured candidates live in `inbox/capture_processing/YYYY-MM-DD.jsonl`. Longer markdown artifacts live in `inbox/capture_artifacts/YYYY-MM-DD/*.md`, with the processing event pointing to the markdown path.

```json
{
  "event_id": "candidate-uuid",
  "event_type": "capture.artifact_candidate.created",
  "source_event_id": "raw-capture-uuid",
  "status": "artifact_candidate",
  "ts": "2026-06-22T00:00:00.000Z",
  "producer": "office-auto-lab",
  "schema_version": 1,
  "artifact_candidate": {
    "type": "work_block_candidate_stub",
    "text": "Prepare a reply to the recruiter without redesigning the CRM.",
    "confidence": "medium",
    "artifact_path": "2026-06-22/raw-capture-uuid.work_block_candidate_stub.md"
  }
}
```

### Reingest candidate

Lives in `inbox/reingest_candidates/YYYY-MM-DD.jsonl` when the proposal is specifically meant for future review/reingest. A summary event MAY also be mirrored to `inbox/capture_processing/YYYY-MM-DD.jsonl` for a single lifecycle timeline.

```json
{
  "event_id": "reingest-uuid",
  "event_type": "capture.reingest_candidate.created",
  "source_event_id": "raw-capture-uuid",
  "status": "pending_reingest",
  "ts": "2026-06-22T00:00:00.000Z",
  "producer": "office-auto-lab",
  "schema_version": 1,
  "reingest_candidate": {
    "target_surface": "carry_state",
    "target_id": "52.3",
    "proposed_delta": {
      "next": "Reply to recruiter",
      "needs": "Execution only"
    },
    "requires_human_approval": true
  }
}
```

### Approval, archive, and future apply

Approval and archive events are still review events and may live under `inbox/capture_processing/YYYY-MM-DD.jsonl`:

- `capture.approved` with `status: "approved"` records human approval for later apply/reingest.
- `capture.archived` with `status: "archived"` records that no further processing is expected.
- `capture.discarded` with `status: "discarded"` records an explicit no-op decision.

`capture.applied` MUST be emitted only by a later explicit apply/reingest tool after canonical Office state has been mutated. It is intentionally out of scope for the current Process-only layer.

## File layout

Proposed `office-auto-lab` surfaces:

```text
inbox/
  human_feedback/YYYY-MM-DD.jsonl                 # raw captures from office-window
  human_feedback_audio/YYYY-MM-DD/<event_id>.webm # raw capture audio from office-window
  capture_processing/YYYY-MM-DD.jsonl             # request, transcription, routing, lifecycle decisions
  capture_artifacts/YYYY-MM-DD/*.md               # reviewable markdown artifacts
  reingest_candidates/YYYY-MM-DD.jsonl            # explicit proposed deltas for later review/apply
```

Audio path resolution must be root-confined:

1. Read `audio.rel_path` only from the raw event.
2. Accept only `YYYY-MM-DD/<uuid>.webm` paths.
3. Resolve against the configured `human_feedback_audio` root.
4. Reject paths that escape the root after normalization.
5. Treat missing audio as processing failure, not as permission to mutate raw records.

Derived event linkage:

- Raw capture identity is `event_id`.
- Derived events link with `source_event_id`.
- Derived events also have their own `event_id` for auditability.
- Long markdown artifacts include front matter with `source_event_id`, `derived_event_id`, `artifact_type`, and `created_at`.

## Merge/read model

The merged lifecycle reader groups records by raw capture `event_id`:

1. Load recent raw captures from `inbox/human_feedback/*.jsonl`.
2. Load derived processing events from `inbox/capture_processing/*.jsonl`.
3. Load reingest candidates from `inbox/reingest_candidates/*.jsonl`.
4. For each raw event, attach derived events where `derived.source_event_id === raw.event_id`.
5. Select the latest lifecycle status using a finite rank, not arbitrary string sorting.
6. Expose the raw event plus optional `transcript`, `routing`, `artifact_candidate`, `reingest_candidate`, `approval`, and `archive` blocks.

Suggested status rank:

```text
pending_transcription < queued < transcribed < routed < artifact_candidate < pending_reingest < approved < applied
```

Terminal decisions `archived`, `discarded`, and `failed` should override non-terminal process statuses when they are the latest decision event.

The first merged reader should live in `office-auto-lab` because that repo owns the processing surfaces and can provide a CLI/debug artifact without adding UI coupling. `office-window` may keep a small compatible reader for display, or later read an exported lifecycle JSON produced by `office-auto-lab`. The UI should continue to tolerate missing optional fields.

## Finite ontology

Use stable machine values in events and render friendly labels in UI.

### Capture modes

- `inbox`
- `re_entry`
- `correction`
- `decision`
- `closure`
- `parking_lot`
- `support_context`

### Lanes

- `projects_ops`
- `front_desk`
- `support_context`
- `runbooks`
- `briefs`
- `archive`
- `unknown`

### Artifact candidate types

- `next_pointer`
- `closure_memo`
- `decision_note`
- `runbook_patch`
- `checklist_item`
- `correction`
- `park_instruction`
- `support_context_note`
- `work_block_candidate_stub`

### Reingest target surfaces

- `carry_state`
- `support_context`
- `front_registry_note`
- `project_next_pointer`
- `block_candidate_stub`
- `runbook_candidate`
- `brief_correction`
- `archive_decision`

### Statuses

- `pending_transcription`
- `queued`
- `transcribed`
- `routed`
- `artifact_candidate`
- `pending_reingest`
- `approved`
- `applied`
- `archived`
- `discarded`
- `failed`

## Low-coupling boundary

`office-window` may:

- Capture local row-linked voice notes.
- Write append-only raw capture records and audio files.
- Append a future `capture.processing_requested` event.
- Read merged lifecycle status for display.
- Render optional transcript, routing, artifact, and reingest fields.

`office-window` must not:

- Call OpenAI from the browser.
- Expose API keys.
- Apply changes to Google Sheets, queues, carry state, front registry, or `artifacts/latest`.
- Treat raw human input as canonical Office state.

`office-auto-lab` owns:

- Processing event schemas and helper libraries.
- Transcription CLI/worker.
- Routing and extraction prompts/schemas.
- Artifact candidate generation.
- Reingest candidate proposal generation.
- Future explicit apply/reingest commands.
- Server-side OpenAI API key usage.

## Future Office backend integration

A row voice note can eventually become a backend-visible `work_block_candidate_stub` without directly mutating tasks:

```text
row voice note
→ transcript
→ routed capture
→ work_block_candidate_stub
→ reingest candidate
→ reviewed
→ visible to Office compile
→ possible block candidate
```

The stub should be a reviewable artifact candidate first. A later reingest candidate can propose placing that stub on a backend-visible surface such as `block_candidate_stub` or `project_next_pointer`. Only after explicit approval should an apply/reingest tool mutate canonical Office state or produce surfaces consumed by compile/staff processing.

This prevents a spoken note from silently becoming a task, preserves auditability, and keeps compile/staff agents consuming curated backend state rather than raw inbox material.

## Recommended minimal next PR

Choose **Option A** first: add this architecture document to `office-auto-lab` and add shared constants/types for event names, statuses, artifact types, and reingest target surfaces.

Why Option A first:

- It locks the boundary before implementation spreads across two repos.
- It gives both repos a finite vocabulary without adding processing behavior.
- It avoids OpenAI calls, background daemons, databases, and Office state mutation.
- It prepares Options B and C with lower ambiguity.

Then follow with:

1. **Option B:** append-only helpers in `office-auto-lab` for `capture_processing`, `capture_artifacts`, and `reingest_candidates`.
2. **Option C:** merged lifecycle reader in `office-auto-lab`, with `office-window` either using its exported JSON or keeping a display-only compatible reader.

