import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { submitFeedback } from "@/lib/services/feedback";

export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["bug", "idea", "other"]).optional(),
  message: z.string().min(1).max(4000),
  path: z.string().max(400).optional(),
});

// POST /api/feedback — report a bug or share an idea from inside the app. The
// device string is read from the request header, not trusted from the client.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { kind, message, path } = Body.parse(await req.json());
  const userAgent = req.headers.get("user-agent") ?? undefined;
  return ok(await submitFeedback(userId, { kind, message, path, userAgent }));
});
