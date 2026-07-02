import Link from "next/link";

export function EmailTabs({
  active,
  unread = 0,
}: {
  active: "sending" | "receiving";
  unread?: number;
}) {
  const base = "inline-flex items-center gap-2 border-b-2 px-1 pb-2 text-sm";
  const on = "border-lime font-medium text-fg";
  const off =
    "border-transparent text-fg-muted transition-colors hover:text-fg";
  return (
    <div className="mb-6 flex items-center gap-6 border-b border-hairline">
      <Link
        href="/emails"
        className={`${base} ${active === "sending" ? on : off}`}
      >
        Sending
      </Link>
      <Link
        href="/emails/inbound"
        className={`${base} ${active === "receiving" ? on : off}`}
      >
        Receiving
        {unread > 0 && (
          <span className="rounded-full bg-lime px-1.5 py-0.5 font-mono text-[10px] leading-none text-on-lime">
            {unread}
          </span>
        )}
      </Link>
    </div>
  );
}
