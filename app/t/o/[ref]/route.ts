import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { recordEvent } from "@/lib/events";

// 1x1 transparent GIF
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  const emailId = ref.replace(/\.gif$/, "");

  if (/^em_[0-9a-z]+$/.test(emailId)) {
    const [email] = await db
      .select({ id: emails.id })
      .from(emails)
      .where(eq(emails.id, emailId));
    if (email) {
      // fire-and-forget; the pixel must return fast
      void recordEvent(emailId, "email.opened").catch(() => {});
    }
  }

  return new NextResponse(GIF, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, max-age=0",
    },
  });
}
