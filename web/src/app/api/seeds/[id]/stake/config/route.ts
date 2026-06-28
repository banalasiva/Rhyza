import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { stakeConfigSchema } from "@/lib/validation";
import {
  getStakeBoard,
  setActiveDimensions,
  setOptOut,
  setCross,
  setStakePhase,
} from "@/lib/services/stake";

// PATCH /api/seeds/:id/stake/config — consensus/self actions on the stake board:
//   activeDimensions → rule dimensions in/out (manager)
//   optedOut         → "not required for me" (self)
//   phase            → reveal early / lock for the vote (manager)
export const PATCH = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = stakeConfigSchema.parse(await req.json());
  const seedId = ctx.params.id;

  let board = null;
  if (body.activeDimensions) board = await setActiveDimensions(userId, seedId, body.activeDimensions);
  if (typeof body.optedOut === "boolean") board = await setOptOut(userId, seedId, body.optedOut);
  if (body.cross) board = await setCross(userId, seedId, body.cross.rateeId, body.cross.crossed);
  if (body.phase) board = await setStakePhase(userId, seedId, body.phase);

  return ok(board ?? (await getStakeBoard(userId, seedId)));
});
