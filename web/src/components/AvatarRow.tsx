"use client";

import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string | null; image?: string | null };

// A WhatsApp-style stacked row of member faces. Shows the first few overlapping
// avatars and a "+N" pill for the rest, so at a glance you know who's in the
// room — the way a group chat header shows its members. Tapping anywhere calls
// `onClick` (open the members sheet). `max` caps how many faces render.
export function AvatarRow({
  people,
  size = 26,
  max = 5,
  onClick,
  label,
}: {
  people: Person[];
  size?: number;
  max?: number;
  onClick?: () => void;
  label?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const ring = "rounded-full ring-2 ring-[#0B120B]";

  const content = (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.id} className={ring} title={p.name || undefined}>
            <Avatar name={p.name} image={p.image} size={size} />
          </span>
        ))}
        {extra > 0 && (
          <span
            className={`${ring} flex items-center justify-center bg-[rgba(76,175,80,0.18)] font-medium text-ink-mid`}
            style={{ width: size, height: size, fontSize: size * 0.4 }}
          >
            +{extra}
          </span>
        )}
      </span>
      {label && <span className="text-xs text-ink-soft">{label}</span>}
    </span>
  );

  if (!onClick) return content;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="See who's here"
      className="flex items-center rounded-full transition hover:opacity-90 active:scale-[0.98]"
    >
      {content}
    </button>
  );
}
