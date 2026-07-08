import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { followSeed, setSeedFollow } from "@/lib/services/explore";
import { z } from "zod";

const schema = z.object({
  // New: a specific level. Legacy: a boolean `following`.
  level: z.enum(["all", "highlights", "muted", "off"]).optional(),
  following: z.boolean().optional(),
});

// POST /api/seeds/:id/follow — set how you follow a seed.
//   { level: "all" | "highlights" | "muted" | "off" }   (preferred)
//   { following: true | false }                          (legacy toggle → all/off)
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { level, following } = schema.parse(await req.json());
  if (level) return ok(await setSeedFollow(userId, ctx.params.id, level));
  return ok(await followSeed(userId, ctx.params.id, following ?? true));
});
