import { appendCaptureReviewEvent, sanitizeCaptureReviewRequest } from "@/lib/server/captureEvents";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON request body.");
  }

  const review = sanitizeCaptureReviewRequest(body);
  if (!review.ok) return jsonError(review.error);

  try {
    const event = await appendCaptureReviewEvent(review.value);
    return Response.json({ ok: true, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to append capture review.";
    return jsonError(message, 500);
  }
}
