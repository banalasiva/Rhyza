import { handle, ok, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import {
  listDailyQuotes,
  addDailyQuote,
  updateDailyQuote,
  deleteDailyQuote,
  importDefaultQuotes,
} from "@/lib/services/daily";

export const dynamic = "force-dynamic";

// GET /api/admin/daily — the full editable message library.
export const GET = handle(async () => {
  await requireAdmin();
  return ok({ quotes: await listDailyQuotes() });
});

// POST /api/admin/daily — add a message, or { import: true } to seed the table
// from the built-in 330 (once).
export const POST = handle(async (req) => {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  if (body?.import === true) return ok(await importDefaultQuotes());
  if (typeof body?.text !== "string" || !body.text.trim()) {
    throw new ApiError("BAD_REQUEST", "Message text is required");
  }
  return ok(await addDailyQuote(body.text, body.author), 201);
});

// PATCH /api/admin/daily — edit or activate/deactivate one message.
export const PATCH = handle(async (req) => {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  if (typeof body?.id !== "string") throw new ApiError("BAD_REQUEST", "id is required");
  return ok(
    await updateDailyQuote(body.id, {
      text: typeof body.text === "string" ? body.text : undefined,
      author: body.author === undefined ? undefined : body.author,
      active: typeof body.active === "boolean" ? body.active : undefined,
    }),
  );
});

// DELETE /api/admin/daily?id=… — retire a message for good.
export const DELETE = handle(async (req) => {
  await requireAdmin();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new ApiError("BAD_REQUEST", "id is required");
  return ok(await deleteDailyQuote(id));
});
