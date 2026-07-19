import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { requireSeedAccess } from "@/lib/authz";
import { displayName } from "@/lib/display-name";
import { OUTCOMES, SAME_AGAIN } from "@/lib/services/reflections";

// Calibration — reality's outside voice on a decision. The person a decision
// actually landed on (your wife, a teammate) opens a shared bloom and says how
// it turned out FROM THEIR SEAT, so you can calibrate your own (biased) read.
// A per-bloom token grants a scoped view of just that one bloom — never seed
// access. Everything best-effort against standalone tables.

// Owner (or any member who can see the bloom) mints/returns its share token.
export async function getOrCreateShareToken(userId: string, bloomId: string): Promise<string | null> {
  const bloom = await db.bloom.findUnique({ where: { id: bloomId }, select: { seedId: true } });
  if (!bloom) return null;
  await requireSeedAccess(userId, bloom.seedId); // only people who can see it may share it

  const existing = await db.bloomShareToken
    .findUnique({ where: { bloomId }, select: { token: true } })
    .catch(() => null);
  if (existing) return existing.token;

  const token = randomUUID().replace(/-/g, "");
  await db.bloomShareToken
    .upsert({ where: { bloomId }, update: {}, create: { bloomId, token } })
    .catch(() => {});
  const row = await db.bloomShareToken
    .findUnique({ where: { bloomId }, select: { token: true } })
    .catch(() => null);
  return row?.token ?? token;
}

export type CalibrationTarget = {
  bloomId: string;
  title: string;
  summary: string;
  ownerName: string;
  gardenName: string;
};

// Resolve a token to the single bloom it unlocks — title + summary only, no
// discussion, no seed access. Null if the token is unknown.
export async function getBloomForCalibration(token: string): Promise<CalibrationTarget | null> {
  const share = await db.bloomShareToken
    .findUnique({ where: { token }, select: { bloomId: true } })
    .catch(() => null);
  if (!share) return null;
  const bloom = await db.bloom
    .findUnique({
      where: { id: share.bloomId },
      select: {
        id: true,
        title: true,
        summary: true,
        garden: { select: { name: true } },
        seed: { select: { createdBy: { select: { name: true, email: true } } } },
      },
    })
    .catch(() => null);
  if (!bloom) return null;
  return {
    bloomId: bloom.id,
    title: bloom.title,
    summary: bloom.summary,
    ownerName: displayName(bloom.seed?.createdBy ?? {}),
    gardenName: bloom.garden?.name ?? "",
  };
}

// A signed-in person records how the decision landed for them. Tying it to a
// user keeps it honest (one calibration per person) and — for a newcomer who
// opened the link — quietly converts them into a member of ThinkThru.
export async function submitCalibration(
  userId: string,
  token: string,
  input: { outcome?: string | null; sameAgain?: string | null; note?: string | null },
): Promise<{ ok: boolean }> {
  const share = await db.bloomShareToken
    .findUnique({ where: { token }, select: { bloomId: true } })
    .catch(() => null);
  if (!share) return { ok: false };

  const me = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const outcome = OUTCOMES.includes(input.outcome as never) ? input.outcome! : null;
  const sameAgain = SAME_AGAIN.includes(input.sameAgain as never) ? input.sameAgain! : null;
  const note = (input.note ?? "").trim().slice(0, 2000) || null;

  await db.bloomCalibration
    .upsert({
      where: { bloomId_responderId: { bloomId: share.bloomId, responderId: userId } },
      update: { outcome, sameAgain, note, responderName: displayName(me ?? {}) },
      create: {
        bloomId: share.bloomId,
        responderId: userId,
        responderName: displayName(me ?? {}),
        outcome,
        sameAgain,
        note,
      },
    })
    .catch(() => {});
  return { ok: true };
}

export type Calibration = {
  name: string;
  outcome: string | null;
  sameAgain: string | null;
  note: string | null;
  mine: boolean;
};

// Everyone's calibration of a bloom (excluding the AI). Shown to whoever can see
// the bloom, so the decider can hold their self-read against reality's.
export async function getCalibrations(bloomId: string, viewerId: string): Promise<Calibration[]> {
  const rows = await db.bloomCalibration
    .findMany({ where: { bloomId }, orderBy: { updatedAt: "desc" } })
    .catch(() => [] as Awaited<ReturnType<typeof db.bloomCalibration.findMany>>);
  return rows.map((r) => ({
    name: r.responderId === viewerId ? "You" : r.responderName || "Someone",
    outcome: r.outcome,
    sameAgain: r.sameAgain,
    note: r.note,
    mine: r.responderId === viewerId,
  }));
}
