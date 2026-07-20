import { requireViewer } from "@/lib/session";
import { NavBar } from "@/components/NavBar";
import { getArtefactData } from "@/lib/services/artefacts";
import { ShareCard } from "@/components/share/ShareCard";
import {
  BloomCard,
  YearCard,
  LessonsCard,
  MirrorCard,
  TreeCard,
} from "@/components/share/cards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share your ThinkThru" };

// The share hub — every artefact the viewer can turn into a PNG. Only cards with
// real data show up, so it's never awkwardly empty.
export default async function SharePage() {
  const viewer = await requireViewer();
  const data = await getArtefactData(viewer.userId, viewer.name);

  type Card = { key: string; file: string; node: React.ReactNode };
  const cards: Card[] = [];

  if (data.latestBloom && (data.latestBloom.lesson || data.latestBloom.outcome || data.latestBloom.sameAgain)) {
    cards.push({
      key: "bloom",
      file: "thinkthru-bloom",
      node: <BloomCard name={data.name} bloom={data.latestBloom} />,
    });
  }
  if (data.seedsPlanted > 0) {
    cards.push({ key: "year", file: "thinkthru-garden", node: <YearCard data={data} /> });
  }
  if (data.lessons.length > 0) {
    cards.push({ key: "lessons", file: "thinkthru-lessons", node: <LessonsCard data={data} /> });
  }
  if (data.summary.reflected > 0) {
    cards.push({ key: "mirror", file: "thinkthru-judgment", node: <MirrorCard data={data} /> });
  }
  if (data.bloomsCount > 0) {
    cards.push({ key: "tree", file: "thinkthru-tree", node: <TreeCard data={data} /> });
  }

  return (
    <div className="relative min-h-screen">
      <div className="garden-bg" />
      <NavBar name={viewer.name} />
      <main id="main" className="relative z-10 mx-auto max-w-md px-4 py-6 sm:py-8">
        <h1 className="serif-xl mb-1">Share your ThinkThru</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Turn your decisions, lessons and judgment into a card you can send. Each one carries a 🌱
          and a link back — so a share is also an invite.
        </p>

        {cards.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            Plant a decision or two and reflect on a bloom — your first shareable card will appear
            here 🌱
          </div>
        ) : (
          <div className="space-y-12">
            {cards.map((c) => (
              <ShareCard key={c.key} filename={c.file}>
                {c.node}
              </ShareCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
