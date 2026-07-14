import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// Reaction types are product configuration that changes rarely (it's seeded, and
// extended by inserting rows). Cache it across requests so the seed page doesn't
// hit the database for it on every view. Revalidate is kept SHORT (60s) so that
// adding reactions via /admin migrate shows up within a minute without needing a
// redeploy — the query is tiny and rarely runs, so the cost is negligible.
export const getReactionTypes = unstable_cache(
  async () =>
    db.reactionType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, emoji: true, label: true },
    }),
  ["reaction-types"],
  { revalidate: 60, tags: ["reaction-types"] },
);
