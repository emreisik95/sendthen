"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill, btnSecondary, fmtDate } from "@/components/ui";

interface MxCheckResult {
  mx: boolean;
  mxFound: string[];
  expectedHost: string | null;
}

/**
 * "Verify receiving" button + status badge for the MX-record receiving
 * method. Mirrors LiveVerify's fetch-then-refresh pattern: hits the MX
 * check endpoint, updates local state immediately, then refreshes the
 * server component so the persisted value stays in sync on reload.
 */
export function VerifyMx({
  domainId,
  initialVerified,
  initialCheckedAt,
}: {
  domainId: string;
  initialVerified: boolean;
  initialCheckedAt: number | null;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [checkedAt, setCheckedAt] = useState(initialCheckedAt);
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<string[] | null>(null);
  const [expected, setExpected] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    try {
      const res = await fetch("/api/domains/verify-mx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: domainId }),
      });
      if (res.ok) {
        const json = (await res.json()) as MxCheckResult;
        setVerified(json.mx);
        setFound(json.mxFound);
        setExpected(json.expectedHost);
        setCheckedAt(Date.now());
        router.refresh();
      }
    } catch {
      // transient network error — user can retry
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={verified ? "verified" : "pending"} />
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className={btnSecondary}
        >
          {checking ? "Checking…" : "Verify receiving"}
        </button>
        {checkedAt && (
          <span className="font-mono text-[11px] text-fg-faint">
            last checked {fmtDate(new Date(checkedAt))}
          </span>
        )}
      </div>
      {!verified && found && (
        <p className="mt-1.5 font-mono text-xs text-warn">
          {found.length > 0
            ? `found MX: ${found.join(", ")} — expected ${expected ?? "this instance's host"}`
            : "no MX record found yet"}
        </p>
      )}
    </div>
  );
}
