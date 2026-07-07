import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getUserReflection, refreshUserReflection, setUserReflection } from "@/lib/services/profile";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["refresh", "save"]),
  text: z.string().max(4000).optional(),
});

export const dynamic = "force-dynamic";

// GET /api/me/reflection — my "how you show up" points (one per line).
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ reflection: await getUserReflection(userId) });
});

// POST /api/me/reflection — edit my own reflection.
//   { action: "refresh" }        regenerate from my latest activity (Claude)
//   { action: "save", text }     store my edited points (empty clears it)
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { action, text } = schema.parse(await req.json());

  if (action === "refresh") return ok({ reflection: await refreshUserReflection(userId) });
  return ok({ reflection: await setUserReflection(userId, text ?? "") });
});
