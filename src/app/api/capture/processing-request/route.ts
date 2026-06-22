import { NextRequest, NextResponse } from "next/server";
import { appendCaptureProcessingRequest } from "@/lib/server/captureEvents";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const sourceEventId = body && typeof body === "object" ? (body as Record<string, unknown>).source_event_id : null;
    if (typeof sourceEventId !== "string") {
      return NextResponse.json({ error: "source_event_id is required" }, { status: 400 });
    }
    const event = await appendCaptureProcessingRequest(sourceEventId);
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to append processing request" },
      { status: 400 },
    );
  }
}
