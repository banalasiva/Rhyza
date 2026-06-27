"use client";

import { useRef, useState } from "react";
import { mentionToken } from "@/lib/mentions";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null };

// A lightweight "block" editor: a textarea with a formatting toolbar that wraps
// the current selection in markdown markers (**bold**, *italic*, `code`), plus
// an @-mention autocomplete that inserts a structured @[Name](id) token.
// Output is plain markdown text, rendered safely by <InlineText/>.
export function RichEditor({
  value,
  onChange,
  placeholder,
  disabled,
  people = [],
  onSubmit,
  toolbarExtra,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  people?: Person[];
  onSubmit?: () => void;
  toolbarExtra?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{ at: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  const matches = menu
    ? people
        .filter((p) => p.name.toLowerCase().includes(menu.query.toLowerCase()))
        .slice(0, 6)
    : [];
  const showMenu = menu !== null && matches.length > 0;

  function wrap(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || "text";
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length + selected.length);
    });
  }

  // Detect an in-progress @mention (an "@" at line start or after whitespace,
  // followed by up to 40 non-space chars) ending at the caret.
  function syncMenu(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]{0,40})$/);
    if (m && people.length > 0) {
      setMenu({ at: caret - m[2].length - 1, query: m[2] });
      setActive(0);
    } else {
      setMenu(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    syncMenu(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function pick(person: Person) {
    const el = ref.current;
    if (!el || !menu) return;
    const caret = el.selectionStart ?? value.length;
    const token = mentionToken(person.name, person.id);
    const next = value.slice(0, menu.at) + token + " " + value.slice(caret);
    const newCaret = menu.at + token.length + 1;
    onChange(next);
    setMenu(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // While the @-mention menu is open, the keys drive it.
    if (showMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % matches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[active]);
      } else if (e.key === "Escape") {
        setMenu(null);
      }
      return;
    }
    // Formatting shortcuts: ⌘/Ctrl + B / I / E.
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();
      if (k === "b") return (e.preventDefault(), wrap("**"));
      if (k === "i") return (e.preventDefault(), wrap("*"));
      if (k === "e") return (e.preventDefault(), wrap("`"));
    }
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <div className="mb-2 flex gap-1">
        <ToolbarButton label="Bold (⌘B)" onClick={() => wrap("**")} disabled={disabled}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic (⌘I)" onClick={() => wrap("*")} disabled={disabled}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Code (⌘E)" onClick={() => wrap("`")} disabled={disabled}>
          <span className="font-mono text-xs">{"</>"}</span>
        </ToolbarButton>
        {toolbarExtra}
        <span className="ml-auto self-center pr-1 text-[10px] text-ink-soft">
          Enter to send · Shift+Enter for a new line
        </span>
      </div>
      <textarea
        ref={ref}
        className="input min-h-[150px] text-[15px] leading-relaxed"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => syncMenu(value, e.currentTarget.selectionStart ?? 0)}
        maxLength={5000}
        disabled={disabled}
      />
      {showMenu && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-xl border border-[rgba(76,175,80,0.25)] bg-[rgba(10,16,10,0.98)] p-1 shadow-xl backdrop-blur">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                i === active ? "bg-[rgba(76,175,80,0.18)] text-ink" : "text-ink-mid hover:text-ink"
              }`}
            >
              <Avatar name={p.name} image={p.image} size={22} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
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
