"use client";

import { useEffect, useState } from "react";

interface TraceLine {
  time: string;
  status: string;
  color: string;
  detail: string;
}

const LINES: TraceLine[] = [
  {
    time: "09:31:04.012",
    status: "queued",
    color: "text-info",
    detail: "accepted via POST /api/v1/emails",
  },
  {
    time: "09:31:04.019",
    status: "signing",
    color: "text-fg-muted",
    detail: "DKIM-Signature: v=1; a=rsa-sha256; d=yourdomain.com; s=stmail",
  },
  {
    time: "09:31:04.031",
    status: "handshake",
    color: "text-fg-muted",
    detail: "MX gmail-smtp-in.l.google.com:25 → 220 ready",
  },
  {
    time: "09:31:04.214",
    status: "sent",
    color: "text-info",
    detail: "250 2.0.0 OK · message-id=<em_4kq0@yourdomain.com>",
  },
  {
    time: "09:31:04.220",
    status: "delivered",
    color: "text-lime",
    detail: "delivery event recorded",
  },
  {
    time: "09:31:04.226",
    status: "webhook",
    color: "text-lime",
    detail: "POST /hooks/email → 200 · webhook-signature: v1,oTn3…",
  },
];

const CMD = "sendthen trace em_4kq0w2xr";

export function DeliveryTrace() {
  // SSR renders the full transcript so content survives no-JS and crawlers;
  // the typing loop only starts client-side when motion is allowed.
  const [typed, setTyped] = useState(CMD.length);
  const [shown, setShown] = useState(LINES.length);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setReduced(false);
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => {
      const t = setTimeout(() => alive && fn(), ms);
      timers.push(t);
    };

    const cycle = () => {
      setTyped(0);
      setShown(0);
      for (let i = 1; i <= CMD.length; i++) at(200 + i * 34, () => setTyped(i));
      const base = 200 + CMD.length * 34 + 350;
      LINES.forEach((_, i) =>
        at(base + i * 420, () => setShown(i + 1)),
      );
      at(base + LINES.length * 420 + 4200, cycle);
    };
    cycle();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-line bg-surface-3 text-left"
      style={{ boxShadow: "0 0 60px rgba(198,255,0,0.06)" }}
      aria-label="Live delivery trace of one email through the sendthen pipeline"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
        </div>
        <span className="font-mono text-xs text-fg-faint">
          delivery trace — live
        </span>
      </div>
      <div className="min-h-[248px] p-5 font-mono text-[13px] leading-[1.9]">
        <div>
          <span className="text-lime">$ </span>
          <span className="text-fg">{CMD.slice(0, typed)}</span>
          {!reduced && typed < CMD.length && <span className="st-cursor" />}
        </div>
        {LINES.slice(0, shown).map((l) => (
          <div key={l.status} className="st-trace-line whitespace-nowrap">
            <span className="text-fg-faint">{l.time}</span>
            <span className={`inline-block w-28 pl-4 ${l.color}`}>
              {l.status}
            </span>
            <span className="text-fg-muted">{l.detail}</span>
          </div>
        ))}
        {!reduced && typed >= CMD.length && shown < LINES.length && (
          <span className="st-cursor" />
        )}
      </div>
    </div>
  );
}
