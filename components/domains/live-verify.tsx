"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_S = 30;

/**
 * Pulsing live DNS checker for pending domains. Re-verifies every 30s
 * and refreshes the page when the domain flips to verified.
 */
export function LiveVerify({
  domainId,
  compact = false,
}: {
  domainId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [nextIn, setNextIn] = useState(INTERVAL_S);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const res = await fetch("/api/domains/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: domainId }),
      });
      if (res.ok) {
        const json = (await res.json()) as { verified?: boolean };
        if (json.verified) {
          router.refresh();
          return;
        }
      }
    } catch {
      // transient network error — next tick retries
    } finally {
      busy.current = false;
      setChecking(false);
      setNextIn(INTERVAL_S);
    }
  }, [domainId, router]);

  useEffect(() => {
    const tick = setInterval(() => {
      setNextIn((s) => {
        if (s <= 1) {
          void check();
          return INTERVAL_S;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [check]);

  const dot = (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
    </span>
  );

  if (compact) {
    return (
      <span
        className="flex items-center gap-1.5"
        title={checking ? "Checking DNS…" : `Next DNS check in ${nextIn}s`}
      >
        {dot}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 font-mono text-xs text-fg-muted">
      {dot}
      {checking ? (
        "checking DNS records…"
      ) : (
        <>
          watching DNS · next check in{" "}
          <span className="tabular-nums text-fg">{nextIn}s</span>
          {" · "}
          <button
            type="button"
            onClick={() => void check()}
            className="text-lime hover:underline"
          >
            check now
          </button>
        </>
      )}
    </span>
  );
}
