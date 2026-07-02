"use client";

import { useState } from "react";

interface ScopeDef {
  value: string;
  label: string;
  group: string;
}

const PRESETS: { key: string; label: string; desc: string }[] = [
  { key: "full", label: "Full access", desc: "Everything this team can do" },
  { key: "sending", label: "Sending only", desc: "Send and read emails, nothing else" },
  { key: "custom", label: "Custom", desc: "Pick exactly what this key may do" },
];

const SENDING_SCOPES = new Set(["emails.send", "emails.read"]);

/** Access selector for new API keys; posts `scopes` fields (none = full). */
export function ScopePicker({ scopes }: { scopes: ScopeDef[] }) {
  const [preset, setPreset] = useState<string>("full");
  const [custom, setCustom] = useState<Set<string>>(
    new Set(["emails.send", "emails.read"]),
  );

  const effective =
    preset === "full"
      ? new Set(scopes.map((s) => s.value))
      : preset === "sending"
        ? SENDING_SCOPES
        : custom;

  const groups = [...new Set(scopes.map((s) => s.group))];

  return (
    <div className="mt-3 rounded-md border border-line bg-surface-2 p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-fg-faint">
        Access
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`rounded-md border px-3 py-2 text-left transition-colors ${
              preset === p.key
                ? "border-lime bg-lime/10"
                : "border-line hover:bg-surface-3"
            }`}
          >
            <span className="block text-sm text-fg">{p.label}</span>
            <span className="block text-xs text-fg-faint">{p.desc}</span>
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1 mt-2 text-xs font-medium uppercase tracking-wider text-fg-faint">
                {group}
              </div>
              {scopes
                .filter((s) => s.group === group)
                .map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-2 py-1 text-sm text-fg-muted hover:text-fg"
                  >
                    <input
                      type="checkbox"
                      checked={custom.has(s.value)}
                      onChange={() =>
                        setCustom((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.value)) next.delete(s.value);
                          else next.add(s.value);
                          return next;
                        })
                      }
                      className="accent-[#C6FF00]"
                    />
                    {s.label}
                    <code className="ml-auto font-mono text-[10px] text-fg-faint">
                      {s.value}
                    </code>
                  </label>
                ))}
            </div>
          ))}
          {custom.size === 0 && (
            <p className="text-xs text-danger sm:col-span-2">
              Pick at least one scope — a key with none selected gets full
              access.
            </p>
          )}
        </div>
      )}

      {/* submitted values */}
      {preset !== "full" &&
        [...effective].map((v) => (
          <input key={v} type="hidden" name="scopes" value={v} />
        ))}
    </div>
  );
}
