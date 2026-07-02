import { NextResponse } from "next/server";
import { ingestAuthorized, parseAndStoreInbound } from "@/lib/inbound";

const MAX_SIZE = 15 * 1024 * 1024;

/**
 * Raw MIME ingest. POST the message body as-is; optional ?to= query
 * carries comma-separated envelope recipients.
 */
export async function POST(req: Request) {
  if (!ingestAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // reject declared-oversized bodies before buffering them into memory
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_SIZE) {
    return NextResponse.json({ error: "message too large" }, { status: 413 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "message too large" }, { status: 413 });
  }
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  const toParam = new URL(req.url).searchParams.get("to");
  const envelopeTo = toParam
    ? toParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const { stored } = await parseAndStoreInbound(Buffer.from(body), envelopeTo);
  return NextResponse.json({ stored });
}
