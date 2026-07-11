import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listFollows } from "@/lib/services/follows";

export const dynamic = "force-dynamic";

// GET /api/users/:id/follows?kind=followers|following — the browsable list of
// people behind a profile's follower/following counts.
export const GET = handle(async (req, ctx: { params: { id: string } }) => {
  await requireUserId();
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "followers" && kind !== "following") {
    throw new ApiError("BAD_REQUEST", "kind must be 'followers' or 'following'");
  }
  return ok({ people: await listFollows(ctx.params.id, kind) });
});
