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

export type ShareSettings = { token: string; access: "anyone" | "restricted"; allowedEmails: string[] };

const normEmail = (e: string) => e.trim().toLowerCase();

// Owner (or any member who can see the bloom) mints/returns its share token +
// current access settings.
export async function getOrCreateShareSettings(
  userId: string,
  bloomId: string,
): Promise<ShareSettings | null> {
  const bloom = await db.bloom.findUnique({ where: { id: bloomId }, select: { seedId: true } });
  if (!bloom) return null;
  await requireSeedAccess(userId, bloom.seedId); // only people who can see it may share it

  let row = await db.bloomShareToken.findUnique({ where: { bloomId } }).catch(() => null);
  if (!row) {
    const token = randomUUID().replace(/-/g, "");
    await db.bloomShareToken
      .upsert({ where: { bloomId }, update: {}, create: { bloomId, token } })
      .catch(() => {});
    row = await db.bloomShareToken.findUnique({ where: { bloomId } }).catch(() => null);
  }
  if (!row) return null;
  return {
    token: row.token,
    access: row.access === "restricted" ? "restricted" : "anyone",
    allowedEmails: row.allowedEmails ?? [],
  };
}

// Owner updates who can open the link: "anyone with the link" or "restricted"
// to a set of emails.
export async function updateShareSettings(
  userId: string,
  bloomId: string,
  input: { access: "anyone" | "restricted"; allowedEmails: string[] },
): Promise<ShareSettings | null> {
  const bloom = await db.bloom.findUnique({ where: { id: bloomId }, select: { seedId: true } });
  if (!bloom) return null;
  await requireSeedAccess(userId, bloom.seedId);

  const access = input.access === "restricted" ? "restricted" : "anyone";
  const allowedEmails = Array.from(
    new Set((input.allowedEmails ?? []).map(normEmail).filter((e) => e.includes("@"))),
  ).slice(0, 50);

  await db.bloomShareToken.update({ where: { bloomId }, data: { access, allowedEmails } }).catch(() => {});
  const row = await db.bloomShareToken.findUnique({ where: { bloomId } }).catch(() => null);
  return row
    ? { token: row.token, access: row.access === "restricted" ? "restricted" : "anyone", allowedEmails: row.allowedEmails ?? [] }
    : null;
}

export type CalibrationTarget = {
  bloomId: string;
  title: string;
  summary: string;
  ownerName: string;
  gardenName: string;
};

// "ok" → show the target; "needs_signin" → restricted, sign in to check access;
// "restricted" → signed in but not on the list; "gone" → bad token.
export type CalibrationAccess =
  | { status: "ok"; target: CalibrationTarget }
  | { status: "needs_signin" }
  | { status: "restricted" }
  | { status: "gone" };

// Resolve a token to the single bloom it unlocks — title + summary only, no
// discussion, no seed access — honouring the link's access mode.
export async function getBloomForCalibration(
  token: string,
  viewerEmail: string | null,
): Promise<CalibrationAccess> {
  const share = await db.bloomShareToken
    .findUnique({ where: { token }, select: { bloomId: true, access: true, allowedEmails: true } })
    .catch(() => null);
  if (!share) return { status: "gone" };

  if (share.access === "restricted") {
    if (!viewerEmail) return { status: "needs_signin" };
    const allowed = (share.allowedEmails ?? []).map(normEmail);
    if (!allowed.includes(normEmail(viewerEmail))) return { status: "restricted" };
  }

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
  if (!bloom) return { status: "gone" };
  return {
    status: "ok",
    target: {
      bloomId: bloom.id,
      title: bloom.title,
      summary: bloom.summary,
      ownerName: displayName(bloom.seed?.createdBy ?? {}),
      gardenName: bloom.garden?.name ?? "",
    },
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
    .findUnique({ where: { token }, select: { bloomId: true, access: true, allowedEmails: true } })
    .catch(() => null);
  if (!share) return { ok: false };

  const me = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  // Enforce a restricted link server-side too — never trust the client.
  if (share.access === "restricted") {
    const allowed = (share.allowedEmails ?? []).map(normEmail);
    if (!me?.email || !allowed.includes(normEmail(me.email))) return { ok: false };
  }
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
