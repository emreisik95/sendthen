import { and, desc, eq, isNull } from "drizzle-orm";
import { db, apiKeys } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions";
import {
  Card,
  Empty,
  PageHeader,
  btnDanger,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const { token } = await searchParams;
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(isNull(apiKeys.revokedAt), eq(apiKeys.teamId, team.id)))
    .orderBy(desc(apiKeys.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="API Keys" />

      {token && (
        <Card className="mb-6 border-lime/40 p-4">
          <p className="mb-2 text-sm">
            Key created — copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1.5 font-mono text-xs text-lime">
              {token}
            </code>
            <CopyButton value={token} />
          </div>
        </Card>
      )}

      <form action={createApiKeyAction} className="mb-6 flex gap-2">
        <input
          name="name"
          placeholder="key name (e.g. production)"
          className={`${inputCls} max-w-sm`}
        />
        <select
          name="permission"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg"
        >
          <option value="full">full access</option>
          <option value="sending">sending only</option>
        </select>
        <button type="submit" className={btnPrimary}>
          Create key
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>No API keys. Create one to start sending.</Empty>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm">{k.name}</div>
                <div className="font-mono text-xs text-fg-faint">
                  {k.tokenPrefix}… · {k.permission} · last used{" "}
                  {fmtDate(k.lastUsedAt)}
                </div>
              </div>
              <form action={revokeApiKeyAction}>
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className={btnDanger}>
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
