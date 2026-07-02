"use client";

import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`shrink-0 rounded border border-line px-2 py-1 font-mono text-xs transition-colors hover:bg-surface-2 ${
        copied ? "text-lime" : "text-fg-muted"
      }`}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
