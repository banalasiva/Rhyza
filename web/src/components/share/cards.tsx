import type { CSSProperties, ReactNode } from "react";
import type { ArtefactData } from "@/lib/services/artefacts";

// Presentational, inline-styled cards (no CSS vars / utility classes) so
// html-to-image captures them faithfully. Fixed 360px wide — a clean portrait
// share for WhatsApp / Instagram / X. Everything is the sharer's own content.

const SERIF = "Lora, Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const INK = "#e8e4dc";
const INK_MID = "#a9b09a";
const INK_SOFT = "#7f886f";
const GREEN = "#66BB6A";
const GOLD = "#FFB300";
const RED = "#e57373";

const OUTCOME: Record<string, { label: string; color: string }> = {
  better: { label: "Better than I expected", color: GREEN },
  expected: { label: "About as I expected", color: GOLD },
  worse: { label: "Harder than I expected", color: RED },
};
const SAME: Record<string, string> = {
  definitely_yes: "I'd do it again",
  probably_yes: "I'd probably do it again",
  not_sure: "Still not sure",
  probably_no: "I'd probably choose differently",
  definitely_no: "I'd choose differently",
};

function Shell({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: 360,
        borderRadius: 24,
        overflow: "hidden",
        background: "linear-gradient(160deg, #13230f 0%, #070d07 100%)",
        border: "1px solid rgba(76,175,80,0.28)",
        color: INK,
        fontFamily: SANS,
      }}
    >
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 16, color: INK }}>🌱 ThinkThru</div>
          <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: INK_SOFT }}>
            {eyebrow}
          </div>
        </div>
        {children}
        <div
          style={{
            marginTop: 22,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: INK_SOFT,
          }}
        >
          <span>Think decisions through, together.</span>
          <span style={{ color: GREEN }}>thinkthru.app</span>
        </div>
      </div>
    </div>
  );
}

const title: CSSProperties = { fontFamily: SERIF, fontSize: 23, lineHeight: 1.22, color: INK };
const eyebrowRow: CSSProperties = { fontSize: 11, letterSpacing: 1, color: GOLD, marginBottom: 8 };

// 1 · Bloom card — one decision, resolved. Reusable: the hub passes the latest
// bloom, an individual bloom page passes that bloom.
export type BloomCardData = {
  title: string;
  outcome: string | null;
  lesson: string;
  sameAgain: string | null;
};
export function BloomCard({ name, bloom }: { name: string; bloom: BloomCardData }) {
  const b = bloom;
  return (
    <Shell eyebrow={`${name}'s decision`}>
      <div style={eyebrowRow}>🌸 A DECISION, BLOOMED</div>
      <div style={{ ...title, marginBottom: 16 }}>{b.title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {b.outcome && OUTCOME[b.outcome] && (
          <Line
            icon="📈"
            head="How it turned out"
            body={OUTCOME[b.outcome].label}
            bodyColor={OUTCOME[b.outcome].color}
          />
        )}
        {b.lesson && <Line icon="💡" head="What I learned" body={b.lesson} />}
        {b.sameAgain && SAME[b.sameAgain] && (
          <Line icon="🔄" head="Knowing what I know now" body={SAME[b.sameAgain]} />
        )}
      </div>
    </Shell>
  );
}

function Line({
  icon,
  head,
  body,
  bodyColor = INK,
}: {
  icon: string;
  head: string;
  body: string;
  bodyColor?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ fontSize: 18, lineHeight: "20px" }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: INK_SOFT }}>
          {head}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.4, color: bodyColor }}>{body}</div>
      </div>
    </div>
  );
}

// 2 · Year in your garden — the Wrapped-style snapshot.
export function YearCard({ data }: { data: ArtefactData }) {
  const s = data.summary;
  return (
    <Shell eyebrow={`${data.name}'s garden`}>
      <div style={{ ...eyebrowRow, color: GREEN }}>🌱 MY GARDEN SO FAR</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Stat n={data.seedsPlanted} label="thought through" />
        <Stat n={data.bloomsCount} label="bloomed" color={GOLD} />
        <Stat n={s.reflected} label="reflected on" color={GREEN} />
      </div>
      {s.reflected > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Pill label="Better" n={s.outcome.better} color={GREEN} />
          <Pill label="As expected" n={s.outcome.expected} color={GOLD} />
          <Pill label="Harder" n={s.outcome.worse} color={RED} />
        </div>
      )}
      {data.areas[0] && (
        <div style={{ fontSize: 13, color: INK_MID, marginBottom: 6 }}>
          Most-decided area: <b style={{ color: INK }}>{data.areas[0].emoji} {data.areas[0].name}</b>
        </div>
      )}
      {data.judgementInsight && (
        <div style={{ fontSize: 13, lineHeight: 1.45, color: INK_MID, fontStyle: "italic" }}>
          “{data.judgementInsight}”
        </div>
      )}
    </Shell>
  );
}

function Stat({ n, label, color = INK }: { n: number; label: string; color?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1, color }}>{n}</div>
      <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4 }}>{label}</div>
    </div>
  );
}
function Pill({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 12,
        padding: "8px 4px",
        textAlign: "center",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color }}>{n}</div>
      <div style={{ fontSize: 9, color: INK_SOFT }}>{label}</div>
    </div>
  );
}

// 3 · Hard-won lessons.
export function LessonsCard({ data }: { data: ArtefactData }) {
  return (
    <Shell eyebrow={`${data.name}'s lessons`}>
      <div style={eyebrowRow}>💡 HARD-WON LESSONS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {data.lessons.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <span style={{ color: GOLD, fontFamily: SERIF, fontSize: 15 }}>{i + 1}</span>
            <div style={{ fontSize: 14, lineHeight: 1.4, color: INK }}>{l.lesson}</div>
          </div>
        ))}
      </div>
      {data.lessonsInsight && (
        <div style={{ marginTop: 14, fontSize: 12, color: INK_SOFT, fontStyle: "italic" }}>
          {data.lessonsInsight}
        </div>
      )}
    </Shell>
  );
}

// 4 · Judgment mirror.
export function MirrorCard({ data }: { data: ArtefactData }) {
  const s = data.summary;
  const total = Math.max(1, s.outcome.better + s.outcome.expected + s.outcome.worse);
  const bar = (n: number, color: string) => (
    <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ width: `${(n / total) * 100}%`, height: "100%", background: color, borderRadius: 6 }} />
    </div>
  );
  return (
    <Shell eyebrow={`${data.name}'s judgment`}>
      <div style={{ ...eyebrowRow, color: "#B497E8" }}>🪞 MY JUDGMENT MIRROR</div>
      <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 14 }}>
        How my calls actually land — a mirror, not a score.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <MRow label="Better than expected" n={s.outcome.better} bar={bar(s.outcome.better, GREEN)} color={GREEN} />
        <MRow label="About as expected" n={s.outcome.expected} bar={bar(s.outcome.expected, GOLD)} color={GOLD} />
        <MRow label="Harder than expected" n={s.outcome.worse} bar={bar(s.outcome.worse, RED)} color={RED} />
      </div>
      {data.judgementInsight && (
        <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.45, color: INK_MID, fontStyle: "italic" }}>
          “{data.judgementInsight}”
        </div>
      )}
    </Shell>
  );
}
function MRow({ label, n, bar, color }: { label: string; n: number; bar: ReactNode; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: INK_MID }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{n}</span>
      </div>
      {bar}
    </div>
  );
}

// 5 · Sacred Tree snapshot.
export function TreeCard({ data }: { data: ArtefactData }) {
  return (
    <Shell eyebrow={`${data.name}'s Sacred Tree`}>
      <div style={{ ...eyebrowRow, color: GREEN }}>🌳 MY SACRED TREE</div>
      <div style={{ fontFamily: SERIF, fontSize: 20, marginBottom: 4 }}>
        {data.bloomsCount} {data.bloomsCount === 1 ? "decision" : "decisions"} grown
      </div>
      <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 14 }}>
        Every bloom is a call thought through with others, and kept.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {data.tree.slice(0, 14).map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              maxWidth: "100%",
              background: "rgba(76,175,80,0.08)",
              border: "1px solid rgba(76,175,80,0.2)",
              borderRadius: 999,
              padding: "5px 10px",
              fontSize: 12,
              color: INK_MID,
            }}
          >
            <span>{t.emoji}</span>
            <span
              style={{
                maxWidth: 150,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t.title}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
