import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const port = 4321;
const baseUrl = `http://127.0.0.1:${port}`;
const inbox = await mkdtemp(path.join(tmpdir(), "office-window-capture-review-"));
const day = new Date().toISOString().slice(0, 10);
const jsonlPath = path.join(inbox, `${day}.jsonl`);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next dev exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/capture`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw lastError ?? new Error("Timed out waiting for Next dev server.");
}

async function postReview(payload) {
  const response = await fetch(`${baseUrl}/api/capture/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function readEvents() {
  const content = await readFile(jsonlPath, "utf8");
  return content.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OFFICE_CAPTURE_PROCESSING_INBOX: inbox,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  },
);

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForServer(child);

  const approve = await postReview({
    source_event_id: "approve-event",
    decision: "approve",
    target_surface: "queue",
    target_id: "52.3",
    approved_delta: { next: "Job Search Management", needs: "Execution only" },
    note: "",
  });
  assert.equal(approve.response.status, 200);
  assert.equal(approve.body.event.event_type, "capture.approved");
  assert.deepEqual(approve.body.event.approval.approved_delta, {
    next: "Job Search Management",
    needs: "Execution only",
  });

  const editApprove = await postReview({
    source_event_id: "edit-approve-event",
    decision: "edit_approve",
    target_surface: "queue",
    target_id: "52.3",
    approved_delta: { next: "Edited next", needs: "Edited needs" },
    note: "edited note",
  });
  assert.equal(editApprove.response.status, 200);
  assert.equal(editApprove.body.event.event_type, "capture.approved");
  assert.deepEqual(editApprove.body.event.approval.approved_delta, {
    next: "Edited next",
    needs: "Edited needs",
  });

  const discard = await postReview({
    source_event_id: "discard-event",
    decision: "discard",
    reason: "test_capture",
    note: "noise",
  });
  assert.equal(discard.response.status, 200);
  assert.equal(discard.body.event.event_type, "capture.discarded");
  assert.equal(discard.body.event.discard.reason, "test_capture");

  const archive = await postReview({
    source_event_id: "archive-event",
    decision: "archive",
    reason: "no_action_needed",
    note: "context only",
  });
  assert.equal(archive.response.status, 200);
  assert.equal(archive.body.event.event_type, "capture.archived");
  assert.equal(archive.body.event.archive.reason, "no_action_needed");

  const reprocess = await postReview({
    source_event_id: "reprocess-event",
    decision: "reprocess",
    stage: "artifactize",
    instruction: "Reprocess as work_block_candidate_stub.",
  });
  assert.equal(reprocess.response.status, 200);
  assert.equal(reprocess.body.event.event_type, "capture.reprocess_requested");
  assert.equal(reprocess.body.event.request.stage, "artifactize");

  const invalidDecision = await postReview({ source_event_id: "invalid-event", decision: "bogus" });
  assert.equal(invalidDecision.response.status, 400);

  const missingSource = await postReview({ decision: "approve" });
  assert.equal(missingSource.response.status, 400);

  const unsafeSource = await postReview({ source_event_id: "../escape", decision: "discard" });
  assert.equal(unsafeSource.response.status, 400);

  const events = await readEvents();
  assert.equal(events.length, 5);
  assert(events.every((event) => event.source === "office-window"));
  assert(path.resolve(jsonlPath).startsWith(path.resolve(inbox) + path.sep));

  console.log(`capture review validation passed; wrote ${events.length} events under ${inbox}`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null) {
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  await rm(inbox, { recursive: true, force: true });
}
