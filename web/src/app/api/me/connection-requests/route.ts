import { handle, ok } from "@/lib/api";
import { requireUserId } from "@/lib/authz";
import { listIncomingConnectionRequests } from "@/lib/services/connections";

export const dynamic = "force-dynamic";

// GET /api/me/connection-requests — people waiting for you to accept a connection.
export const GET = handle(async () => {
  const userId = await requireUserId();
  return ok({ people: await listIncomingConnectionRequests(userId) });
});
