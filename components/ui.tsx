import type { ReactNode } from "react";

const STATUS_COLORS: Record<string, string> = {
  delivered: "text-ok bg-ok/14",
  verified: "text-ok bg-ok/14",
  success: "text-ok bg-ok/14",
  sent: "text-info bg-info/14",
  queued: "text-info bg-info/14",
  sending: "text-info bg-info/14",
  pending: "text-warn bg-warn/14",
  canceled: "text-fg-muted bg-fg-muted/14",
  bounced: "text-danger bg-danger/14",
  failed: "text-danger bg-danger/14",
};

const STATUS_ICONS: Record<string, string> = {
  delivered: "✓",
  verified: "✓",
  success: "✓",
  sent: "→",
  queued: "…",
  sending: "…",
  pending: "○",
  canceled: "—",
  bounced: "✕",
  failed: "✕",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs ${
        STATUS_COLORS[status] ?? "text-fg-muted bg-surface-3"
      }`}
    >
      <span aria-hidden>{STATUS_ICONS[status] ?? "•"}</span>
      {status}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[10px] border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center text-sm text-fg-muted">
      {children}
    </Card>
  );
}

/** Rich empty state: icon, what this page is for, and a next step. */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="px-6 py-16 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-faint">
          {icon}
        </div>
      )}
      <p className="mb-2 text-sm font-medium text-fg">{title}</p>
      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-fg-muted">
        {description}
      </p>
      {children && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      )}
    </Card>
  );
}

export const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus-visible:border-lime";

export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-on-lime transition-colors hover:bg-lime-hover active:bg-lime-dim";

export const btnSecondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-fg transition-colors hover:bg-surface-2";

export const btnDanger =
  "inline-flex min-h-10 items-center gap-2 rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10";

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}
