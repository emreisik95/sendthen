import Link from "next/link";
import { desc, eq, count } from "drizzle-orm";
import { db, audiences, contacts } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { createAudienceAction } from "@/app/actions";
import {
  Card,
  EmptyState,
  PageHeader,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { IconUsers } from "@/components/nav-icons";

export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const rows = await db
    .select({
      audience: audiences,
      contactCount: count(contacts.id),
    })
    .from(audiences)
    .leftJoin(contacts, eq(contacts.audienceId, audiences.id))
    .where(eq(audiences.teamId, team.id))
    .groupBy(audiences.id)
    .orderBy(desc(audiences.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Contacts" />
      <p className="mb-6 text-sm text-fg-muted">
        Contact lists group the people a{" "}
        <Link href="/broadcasts" className="text-lime hover:underline">
          campaign
        </Link>{" "}
        goes to. Contacts can unsubscribe themselves with one click; sendthen
        skips them automatically.
      </p>

      <form action={createAudienceAction} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="contact list name (e.g. newsletter)"
          required
          className={`${inputCls} max-w-sm`}
        />
        <button type="submit" className={btnPrimary}>
          Create contact list
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconUsers />}
          title="No contact lists yet."
          description="Create one above — “newsletter” or “customers” are good first names — then add contacts by hand, or push them from your app with the API. Once a list has people in it, you can write a campaign."
        >
          <Link
            href="/docs#audiences"
            className="rounded-md border border-line px-4 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            How contact lists work →
          </Link>
        </EmptyState>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map(({ audience, contactCount }) => (
            <Link
              key={audience.id}
              href={`/audiences/${audience.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-faint">
                  <IconUsers width={14} height={14} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{audience.name}</span>
                  <span className="block font-mono text-xs text-fg-faint">
                    {audience.id}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-4 font-mono text-xs text-fg-faint">
                <span
                  className={
                    contactCount > 0 ? "text-fg-muted" : "text-fg-faint"
                  }
                >
                  {contactCount} contact{contactCount === 1 ? "" : "s"}
                </span>
                <span>{fmtDate(audience.createdAt)}</span>
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
