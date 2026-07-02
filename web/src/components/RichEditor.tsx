"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; image: string | null };

// A unified @-mention item: people insert a structured token; the AIs insert
// plain "@claude" / "@chatgpt" (detected server-side).
type MentionItem = {
  id: string;
  name: string; // lowercase match key
  label: string; // display name
  image: string | null;
  ai: boolean;
  insert: string;
};

// The AIs are always taggable, even before anyone else has joined.
const AI_MENTIONS: MentionItem[] = [
  { id: "ai:claude", name: "claude", label: "Claude", image: null, ai: true, insert: "@claude" },
  { id: "ai:chatgpt", name: "chatgpt gpt openai", label: "ChatGPT", image: null, ai: true, insert: "@chatgpt" },
];

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
  // Touch devices: Enter makes a new line and a Send button submits (like Slack
  // mobile). Desktop keeps Enter-to-send.
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches === true);
  }, []);

  const allItems: MentionItem[] = [
    ...AI_MENTIONS,
    ...people.map((p) => ({
      id: p.id,
      name: p.name.toLowerCase(),
      label: p.name,
      image: p.image,
      ai: false,
      // Insert the readable "@Display Name" — the id-bearing token is built at
      // submit time (serializeMentions), so the editor never shows a raw UUID.
      insert: `@${p.name}`,
    })),
  ];
  const matches = menu
    ? allItems.filter((it) => it.name.includes(menu.query.toLowerCase())).slice(0, 6)
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
    if (m) {
      // Always offer the menu — the AIs are taggable even with no people listed.
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

  function pick(item: MentionItem) {
    const el = ref.current;
    if (!el || !menu) return;
    const caret = el.selectionStart ?? value.length;
    const next = value.slice(0, menu.at) + item.insert + " " + value.slice(caret);
    const newCaret = menu.at + item.insert.length + 1;
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
    // Desktop: Enter sends, Shift+Enter newline. Touch: Enter always newlines
    // (the Send button submits), so typing multi-line on a phone isn't painful.
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && onSubmit && !isTouch) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <div className="mb-2 flex gap-1">
        {/* No bold/italic/code buttons — kept plain and simple for everyone.
            (⌘B/I/E still work for anyone who wants them.) */}
        {toolbarExtra}
        {/* Submission is owned by the parent's single "Contribute" button, so
            the editor shows no Send of its own — just a desktop keyboard hint. */}
        {!isTouch && (
          <div className="ml-auto flex items-center gap-2 self-center">
            <span className="pr-1 text-[10px] text-ink-soft">
              Enter to send · Shift+Enter for a new line
            </span>
          </div>
        )}
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
          {matches.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                i === active ? "bg-[rgba(76,175,80,0.18)] text-ink" : "text-ink-mid hover:text-ink"
              }`}
            >
              {it.ai ? (
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[rgba(76,175,80,0.18)] text-[12px] text-accent">
                  ✦
                </span>
              ) : (
                <Avatar name={it.label} image={it.image} size={22} />
              )}
              <span>{it.label}</span>
              {it.ai && (
                <span className="ml-auto rounded-full bg-[rgba(76,175,80,0.12)] px-1.5 py-0.5 text-[11px] text-accent">
                  AI
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
