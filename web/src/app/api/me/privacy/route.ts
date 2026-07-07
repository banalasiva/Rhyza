import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import {
  getSectionVisibility,
  setSectionVisibility,
  PROFILE_SECTIONS,
} from "@/lib/services/profile";
import { z } from "zod";

const schema = z.object({
  section: z.enum(PROFILE_SECTIONS),
  public: z.boolean(),
});

export const dynamic = "force-dynamic";

// GET /api/me/privacy — my per-section profile visibility.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ visibility: await getSectionVisibility(userId) });
});

// POST /api/me/privacy — make one profile section public or private.
export const POST = handle(async (req) => {
  const userId = await requireUserId();
  const { section, public: isPublic } = schema.parse(await req.json());
  return ok({ visibility: await setSectionVisibility(userId, section, isPublic) });
});
