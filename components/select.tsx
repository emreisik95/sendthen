"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronUpDown } from "@/components/nav-icons";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Brand-styled replacement for native <select>. Form-compatible via a
 * hidden input; optionally submits the surrounding form on change
 * (for GET filter forms).
 */
export function Select({
  name,
  options,
  defaultValue,
  placeholder = "Select…",
  submitOnChange = false,
  onValueChange,
  className = "",
  ariaLabel,
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  submitOnChange?: boolean;
  onValueChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (v: string) => {
    setValue(v);
    setOpen(false);
    onValueChange?.(v);
    if (submitOnChange) {
      // let the hidden input update before submitting
      requestAnimationFrame(() => inputRef.current?.form?.requestSubmit());
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(options[active].value);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input ref={inputRef} type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
      >
        <span className={selected ? "" : "text-fg-faint"}>
          {selected?.label ?? placeholder}
        </span>
        <IconChevronUpDown className="shrink-0 text-fg-faint" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 min-w-40 overflow-y-auto rounded-lg border border-line bg-surface-3 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  i === active ? "bg-surface-2" : ""
                } ${isSelected ? "text-lime" : "text-fg-muted hover:text-fg"}`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && (
                  <span className="font-mono text-[10px] text-fg-faint">
                    {o.hint}
                  </span>
                )}
                {isSelected && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
