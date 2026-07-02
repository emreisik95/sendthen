import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, audiences, contacts } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import {
  addContactAction,
  deleteAudienceAction,
  deleteContactAction,
} from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  StatusPill,
  btnDanger,
  btnPrimary,
  inputCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AudienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.userId, user.id)));
  if (!audience) notFound();

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.audienceId, id))
    .orderBy(desc(contacts.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/audiences"
        className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
      >
        ← Audiences
      </Link>
      <PageHeader title={audience.name}>
        <form action={deleteAudienceAction}>
          <input type="hidden" name="id" value={audience.id} />
          <button type="submit" className={btnDanger}>
            Delete audience
          </button>
        </form>
      </PageHeader>

      <form
        action={addContactAction}
        className="mb-6 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <input type="hidden" name="audienceId" value={audience.id} />
        <input
          name="email"
          type="email"
          placeholder="email@example.com"
          required
          className={`${inputCls} font-mono`}
        />
        <input name="firstName" placeholder="First name" className={inputCls} />
        <input name="lastName" placeholder="Last name" className={inputCls} />
        <button type="submit" className={btnPrimary}>
          Add
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>No contacts in this audience yet.</Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <span className="font-mono text-sm">{c.email}</span>
                {(c.firstName || c.lastName) && (
                  <span className="ml-2 text-xs text-fg-faint">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                  </span>
                )}
              </div>
              {c.unsubscribed && <StatusPill status="canceled" />}
              <form action={deleteContactAction}>
                <input type="hidden" name="audienceId" value={audience.id} />
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className={btnDanger}>
                  Remove
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
