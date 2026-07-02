import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, emails } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { trackVerify } from "@/lib/tracking";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("u") ?? "";
  const sig = url.searchParams.get("s") ?? "";

  if (
    !/^em_[0-9a-z]+$/.test(id) ||
    !/^https?:\/\//i.test(target) ||
    !trackVerify(id, target, sig)
  ) {
    return NextResponse.json({ error: "bad link" }, { status: 400 });
  }

  const [email] = await db
    .select({ id: emails.id })
    .from(emails)
    .where(eq(emails.id, id));
  if (email) {
    void recordEvent(id, "email.clicked", { url: target }).catch(() => {});
  }

  return NextResponse.redirect(target, 302);
}
