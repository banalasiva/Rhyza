import { handle, ok, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import {
  quorumWeighInSchema,
  quorumHardcodeSchema,
  quorumPhaseSchema,
} from "@/lib/validation";
import {
  getQuorumView,
  saveWeighIn,
  setHardcode,
  clearHardcode,
  setPhase,
} from "@/lib/services/quorum";

// GET /api/seeds/:id/quorum — the board for the viewer (roster, your ballots,
// progress, and — once revealed — pies/weights/tensions + your private gap).
export const GET = handle(async (_req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  return ok(await getQuorumView(userId, ctx.params.id));
});

// PUT /api/seeds/:id/quorum — save (or submit) your weigh-in across dimensions.
export const PUT = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const { ballots, submit } = quorumWeighInSchema.parse(await req.json());
  return ok(await saveWeighIn(userId, ctx.params.id, ballots, submit));
});

// POST /api/seeds/:id/quorum — manager actions: hardcode a measurable dimension
// (or clear it), or advance the phase. Body is one or the other.
export const POST = handle(async (req, ctx: { params: { id: string } }) => {
  const userId = await requireUserId();
  const body = await req.json();
  if (body && typeof body === "object" && "phase" in body) {
    const { phase } = quorumPhaseSchema.parse(body);
    return ok(await setPhase(userId, ctx.params.id, phase));
  }
  if (body && typeof body === "object" && "dimension" in body) {
    const { dimension, shares, clear } = quorumHardcodeSchema.parse(body);
    if (clear) return ok(await clearHardcode(userId, ctx.params.id, dimension));
    return ok(await setHardcode(userId, ctx.params.id, dimension, shares ?? {}));
  }
  throw new ApiError("BAD_REQUEST", "Nothing to do.");
});
