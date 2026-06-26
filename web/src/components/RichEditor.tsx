"use client";

import { useRef } from "react";

// A lightweight "block" editor: a textarea with a formatting toolbar that wraps
// the current selection in markdown markers (**bold**, *italic*, `code`).
// Output is plain markdown text, rendered safely by <InlineText/>.
export function RichEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || "text";
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    onChange(next);
    // restore a sensible selection after React updates
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length + selected.length);
    });
  }

  return (
    <div>
      <div className="mb-2 flex gap-1">
        <ToolbarButton label="Bold" onClick={() => wrap("**")} disabled={disabled}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => wrap("*")} disabled={disabled}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Code" onClick={() => wrap("`")} disabled={disabled}>
          <span className="font-mono text-xs">{"</>"}</span>
        </ToolbarButton>
      </div>
      <textarea
        ref={ref}
        className="input min-h-[90px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={5000}
        disabled={disabled}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-8 rounded-md border text-sm text-ink-mid transition hover:text-ink disabled:opacity-40"
      style={{ borderColor: "rgba(76,175,80,0.2)" }}
    >
      {children}
    </button>
  );
}
