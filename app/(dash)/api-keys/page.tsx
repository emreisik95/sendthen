import { and, desc, eq, isNull } from "drizzle-orm";
import { db, apiKeys } from "@/lib/db";
import { requireUser } from "@/lib/auth-user";
import { getActiveTeam } from "@/lib/team";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions";
import { SCOPES, scopesOf } from "@/lib/api-auth";
import { ScopePicker } from "@/components/api-keys/scope-picker";
import {
  Card,
  EmptyState,
  PageHeader,
  btnDanger,
  btnPrimary,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { IconKey } from "@/components/nav-icons";
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

      <form
        action={createApiKeyAction}
        className="mb-6 rounded-[10px] border border-line bg-surface p-4"
      >
        <div className="flex gap-2">
          <input
            name="name"
            placeholder="key name (e.g. production)"
            className={`${inputCls} max-w-sm`}
          />
          <button type="submit" className={btnPrimary}>
            Create key
          </button>
        </div>
        <ScopePicker scopes={[...SCOPES]} />
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconKey />}
          title="No API keys yet."
          description="API keys are bearer tokens your apps use to call the sending API. Scope each key to just what it needs — the full token is shown only once, right after creation. Name your first key above to get started."
        >
          <a
            href="/docs#api-keys"
            className="text-sm text-fg-muted underline hover:text-fg"
          >
            API key docs →
          </a>
        </EmptyState>
      ) : (
        <Card className="divide-y divide-hairline">
          {rows.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm">{k.name}</div>
                <div className="font-mono text-xs text-fg-faint">
                  {k.tokenPrefix}… · last used {fmtDate(k.lastUsedAt)}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {scopesOf(k).length === SCOPES.length ? (
                    <span className="rounded bg-lime/14 px-1.5 py-0.5 font-mono text-[10px] text-lime">
                      full access
                    </span>
                  ) : (
                    scopesOf(k).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                      >
                        {s}
                      </span>
                    ))
                  )}
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
