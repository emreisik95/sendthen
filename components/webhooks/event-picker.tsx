"use client";

import { useState } from "react";
import { IconChevronUpDown } from "@/components/nav-icons";

const GROUPS: {
  label: string;
  hint: string;
  events: { value: string; label: string; desc: string }[];
}[] = [
  {
    label: "Delivery",
    hint: "the happy path of every send",
    events: [
      { value: "email.queued", label: "Queued", desc: "Accepted by the API" },
      { value: "email.sent", label: "Sent", desc: "Handed to the mail transport" },
      { value: "email.delivered", label: "Delivered", desc: "Delivery confirmed" },
    ],
  },
  {
    label: "Problems",
    hint: "when a message doesn't make it",
    events: [
      { value: "email.bounced", label: "Bounced", desc: "Recipient server rejected it" },
      { value: "email.complained", label: "Complained", desc: "Marked as spam by the recipient" },
      { value: "email.failed", label: "Failed", desc: "All send attempts exhausted" },
      { value: "email.canceled", label: "Canceled", desc: "Canceled while still queued" },
    ],
  },
  {
    label: "Engagement",
    hint: "requires open/click tracking",
    events: [
      { value: "email.opened", label: "Opened", desc: "Tracking pixel loaded" },
      { value: "email.clicked", label: "Clicked", desc: "Tracked link followed" },
    ],
  },
];

const DEFAULT_SELECTED = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
];

/** Grouped event selector; renders hidden-checkbox state as `events` fields. */
export function EventPicker() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(DEFAULT_SELECTED),
  );
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const toggleGroup = (events: { value: string }[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = events.every((e) => next.has(e.value));
      for (const e of events) {
        if (allOn) next.delete(e.value);
        else next.add(e.value);
      }
      return next;
    });

  const summary =
    selected.size === 0
      ? "No events selected"
      : selected.size === 9
        ? "All events"
        : `${selected.size} event${selected.size === 1 ? "" : "s"} selected`;

  return (
    <div className="relative">
      {/* the actual submitted values */}
      {[...selected].map((v) => (
        <input key={v} type="hidden" name="events" value={v} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
      >
        <span className={selected.size === 0 ? "text-danger" : ""}>
          {summary}
        </span>
        <IconChevronUpDown className="shrink-0 text-fg-faint" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {GROUPS.map((group) => {
            const allOn = group.events.every((e) => selected.has(e.value));
            const someOn = group.events.some((e) => selected.has(e.value));
            return (
              <div key={group.label} className="border-b border-hairline py-1 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.events)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-xs font-medium uppercase tracking-wider text-fg-faint">
                    {group.label}
                    <span className="ml-2 normal-case tracking-normal text-fg-faint/70">
                      {group.hint}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-[10px] ${
                      allOn ? "text-lime" : someOn ? "text-fg-muted" : "text-fg-faint"
                    }`}
                  >
                    {allOn ? "all on" : someOn ? "some" : "off"}
                  </span>
                </button>
                {group.events.map((ev) => {
                  const on = selected.has(ev.value);
                  return (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() => toggle(ev.value)}
                      className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                          on
                            ? "border-lime bg-lime text-on-lime"
                            : "border-line text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm text-fg">{ev.label}</span>
                        <span className="block text-xs text-fg-faint">
                          {ev.desc}
                        </span>
                      </span>
                      <code className="font-mono text-[10px] text-fg-faint">
                        {ev.value}
                      </code>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
