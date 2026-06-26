import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// Reaction types are product configuration that changes rarely (it's seeded, and
// extended by inserting rows). Cache it across requests so the seed page doesn't
// hit the database for it on every view. Revalidates hourly; bump the tag if you
// add reactions and want them live immediately.
export const getReactionTypes = unstable_cache(
  async () =>
    db.reactionType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, emoji: true, label: true },
    }),
  ["reaction-types"],
  { revalidate: 3600, tags: ["reaction-types"] },
);
