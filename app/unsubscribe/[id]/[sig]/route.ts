import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, contacts } from "@/lib/db";
import { trackVerify } from "@/lib/tracking";

async function unsubscribe(id: string, sig: string): Promise<boolean> {
  if (!/^con_[0-9a-z]+$/.test(id) || !trackVerify(id, "", sig)) return false;
  const updated = await db
    .update(contacts)
    .set({ unsubscribed: true })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return updated.length > 0;
}

const PAGE = (ok: boolean) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ok ? "Unsubscribed" : "Invalid link"} — sendthen</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#08090A;color:#F4F5F6;font:16px/1.6 system-ui,sans-serif}
  .card{max-width:420px;padding:40px;border:1px solid #222629;border-radius:14px;
    background:#0E0F11;text-align:center}
  .lime{color:#C6FF00}
  p{color:#9BA1A6;font-size:14px}
</style></head>
<body><div class="card">
  <div style="font-family:monospace;font-size:20px;margin-bottom:16px">send<span class="lime">then</span></div>
  ${
    ok
      ? `<h1 style="font-size:22px;margin:0 0 8px">You're unsubscribed.</h1>
         <p>You won't receive any more emails from this sender.</p>`
      : `<h1 style="font-size:22px;margin:0 0 8px">Invalid link</h1>
         <p>This unsubscribe link is malformed or expired.</p>`
  }
</div></body></html>`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sig: string }> },
) {
  const { id, sig } = await params;
  const ok = await unsubscribe(id, sig);
  return new NextResponse(PAGE(ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// RFC 8058 one-click unsubscribe
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; sig: string }> },
) {
  const { id, sig } = await params;
  const ok = await unsubscribe(id, sig);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
