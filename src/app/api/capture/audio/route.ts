import {
  MAX_AUDIO_BYTES,
  readCaptureAudio,
  sanitizeCaptureMetadata,
  saveAudioCapture,
} from "@/lib/server/captureEvents";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart/form-data.");
  }

  const audio = form.get("audio");
  const metadataRaw = form.get("metadata");
  const noteRaw = form.get("note");

  if (!(audio instanceof File)) return jsonError("Missing audio file.");
  if (audio.size <= 0) return jsonError("Audio file is empty.");
  if (audio.size > MAX_AUDIO_BYTES) return jsonError("Audio file exceeds the 25 MB limit.", 413);
  if (typeof metadataRaw !== "string") return jsonError("Missing metadata JSON.");

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(metadataRaw);
  } catch {
    return jsonError("Metadata must be valid JSON.");
  }

  const metadata = sanitizeCaptureMetadata(metadataJson);
  if (!metadata) return jsonError("Metadata is missing required queue row fields.");

  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 4000) : undefined;
  const mimeType = audio.type || "audio/webm";
  if (!mimeType.startsWith("audio/") && mimeType !== "video/webm") {
    return jsonError("Unsupported capture MIME type.");
  }

  try {
    const event = await saveAudioCapture({
      audio: Buffer.from(await audio.arrayBuffer()),
      mimeType,
      metadata,
      note,
    });
    return Response.json({ ok: true, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save capture.";
    return jsonError(message, 500);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const relPath = url.searchParams.get("path") || "";

  try {
    const bytes = await readCaptureAudio(relPath);
    return new Response(bytes, {
      headers: {
        "content-type": "audio/webm",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture audio not found.";
    return jsonError(message, 404);
  }
}
