"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

const TABS = [
  {
    label: "TypeScript",
    file: "send.ts",
    code: `import { SendThen } from 'sendthen';

const st = new SendThen('st_xxxxxxxx');

await st.emails.send({
  from: 'you <hello@yourdomain.com>',
  to: 'user@example.com',
  subject: 'Welcome aboard',
  html: '<strong>It just sends.</strong>',
});`,
  },
  {
    label: "curl",
    file: "send.sh",
    code: `curl -X POST https://send.yourdomain.com/api/v1/emails \\
  -H "Authorization: Bearer st_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "you <hello@yourdomain.com>",
    "to": "user@example.com",
    "subject": "Welcome aboard",
    "html": "<strong>It just sends.</strong>"
  }'`,
  },
];

export function CodeTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[14px] border border-line bg-surface-3">
      <div className="flex items-center justify-between border-b border-line px-2 pr-3">
        <div className="flex" role="tablist" aria-label="Code examples">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`border-b-2 px-4 py-2.5 font-mono text-xs transition-colors ${
                i === active
                  ? "border-lime text-fg"
                  : "border-transparent text-fg-faint hover:text-fg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-lime">
            POST /api/v1/emails
          </span>
          <CopyButton value={tab.code} />
        </div>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-fg-muted">
        {tab.code}
      </pre>
    </div>
  );
}
