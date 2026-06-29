import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { getUserInterests, setUserInterests } from "@/lib/services/explore";
import { z } from "zod";

const schema = z.object({ topics: z.array(z.string()).max(20) });

// GET /api/me/interests — the topics this person wants to hear about.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ topics: await getUserInterests(userId) });
});

// PATCH /api/me/interests — replace the set (validated against the taxonomy).
export const PATCH = handle(async (req) => {
  const userId = await requireUserId();
  const { topics } = schema.parse(await req.json());
  const saved = await setUserInterests(userId, topics);
  return ok({ topics: saved });
});
