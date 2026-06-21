"use client";

import { useEffect, useRef, useState } from "react";

const SAFE_COLUMNS = [
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

type Props = {
  queueKey: string;
  queueFile: string;
  projectId: string;
  title: string;
  rowSnapshot: Record<string, string>;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function QueueCaptureButton({ queueKey, queueFile, projectId, title, rowSnapshot }: Props) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [previewUrl]);

  async function startRecording() {
    setMessage("");
    setSaveState("idle");
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSaveState("error");
      setMessage("This browser does not support MediaRecorder audio capture.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const nextBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(nextBlob);
        setPreviewUrl(URL.createObjectURL(nextBlob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Unable to start microphone capture.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function openAndRecord() {
    setOpen(true);
    void startRecording();
  }

  async function saveCapture() {
    if (!blob || blob.size === 0) {
      setSaveState("error");
      setMessage("Record audio before saving.");
      return;
    }

    const safeSnapshot = Object.fromEntries(SAFE_COLUMNS.map((col) => [col, rowSnapshot[col] || ""]));
    const form = new FormData();
    form.append("audio", blob, "capture.webm");
    form.append(
      "metadata",
      JSON.stringify({
        route: "/queues",
        target: {
          queue_key: queueKey,
          queue_file: queueFile,
          project_id: projectId,
          title,
        },
        row_snapshot: safeSnapshot,
      }),
    );
    if (note.trim()) form.append("note", note.trim());

    setSaveState("saving");
    setMessage("Saving capture…");
    const response = await fetch("/api/capture/audio", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setSaveState("error");
      setMessage(body?.error || "Unable to save capture.");
      return;
    }
    setSaveState("saved");
    setMessage("Capture saved as a pending transcription event.");
  }

  return (
    <>
      <button className="capture-button" type="button" onClick={openAndRecord}>
        🎙️ Record
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="capture-modal" role="dialog" aria-modal="true" aria-label="Capture row voice note">
            <div className="capture-modal-head">
              <div>
                <div className="eyebrow">Row voice note</div>
                <h3>{title || projectId}</h3>
                <p className="muted">{queueKey} · {projectId}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close capture panel">×</button>
            </div>
            <div className="capture-controls">
              {!recording ? <button type="button" onClick={startRecording}>Record again</button> : null}
              {recording ? <button type="button" className="recording-button" onClick={stopRecording}>Stop recording</button> : null}
              <button type="button" onClick={saveCapture} disabled={!blob || recording || saveState === "saving"}>Send captured packet</button>
            </div>
            {previewUrl ? <audio controls src={previewUrl} className="capture-audio" /> : null}
            <label className="capture-note">
              Optional note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </label>
            {message ? <p className={`capture-message ${saveState}`}>{message}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
