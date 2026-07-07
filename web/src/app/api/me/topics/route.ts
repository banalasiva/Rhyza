import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import {
  getUserTopics,
  refreshUserTopics,
  addUserTopic,
  removeUserTopic,
} from "@/lib/services/profile";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["refresh", "add", "remove"]),
  topic: z.string().max(60).optional(),
});

export const dynamic = "force-dynamic";

// GET /api/me/topics — the free-form topics on my profile.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ topics: await getUserTopics(userId) });
});

// POST /api/me/topics — edit my own profile topics.
//   { action: "refresh" }            re-infer from my activity (keeps manual adds)
//   { action: "add", topic }         add a topic by hand
//   { action: "remove", topic }      remove a topic
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { action, topic } = schema.parse(await req.json());

  if (action === "refresh") return ok({ topics: await refreshUserTopics(userId) });
  if (!topic || !topic.trim()) throw new ApiError("BAD_REQUEST", "A topic is required.");
  if (action === "add") return ok({ topics: await addUserTopic(userId, topic) });
  return ok({ topics: await removeUserTopic(userId, topic) });
});
