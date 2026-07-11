import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { deliver } from "@/lib/services/notify";

// Mutual connections. One person requests, the other accepts. Once accepted,
// they're in each other's circle — which is what makes them addable straight
// into each other's private seeds (see listMyNetwork). This is the "connect"
// primitive: stronger than a one-way follow, and the real bridge for onboarding
// (you find someone, connect, and now you can pull them into your decisions).

export type ConnectionStatus =
  | "none"
  | "pending_outgoing" // I asked them, waiting
  | "pending_incoming" // they asked me, I can accept
  | "connected"
  | "self";

// Where the viewer stands with another person.
export async function getConnectionStatus(
  viewerId: string,
  otherId: string,
): Promise<ConnectionStatus> {
  if (viewerId === otherId) return "self";
  try {
    const rows = (await db.connection.findMany({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: viewerId },
        ],
      },
      select: { requesterId: true, status: true },
    })) as { requesterId: string; status: string }[];
    if (rows.some((r) => r.status === "accepted")) return "connected";
    const pending = rows.find((r) => r.status === "pending");
    if (!pending) return "none";
    return pending.requesterId === viewerId ? "pending_outgoing" : "pending_incoming";
  } catch {
    return "none"; // table not migrated yet
  }
}

async function pingConnection(
  recipientId: string,
  actorId: string,
  type: "connect_request" | "connect_accepted",
  title: string,
  body: string,
) {
  try {
    const note = await db.notification.create({
      data: { recipientId, actorId, type, title, body, entityType: "user", entityId: actorId },
      select: { id: true },
    });
    await deliver([
      { notificationId: note.id, recipientId, type, push: { title, body }, link: `/u/${actorId}` },
    ]);
  } catch (err) {
    console.error("pingConnection failed", err);
  }
}

// Ask to connect. If they already asked you, this accepts (a mutual ask =
// instant connection). Returns the resulting status.
export async function requestConnection(
  fromId: string,
  toId: string,
): Promise<{ status: ConnectionStatus }> {
  if (fromId === toId) throw new ApiError("BAD_REQUEST", "You can't connect with yourself.");
  const target = await db.user.findUnique({
    where: { id: toId },
    select: { name: true, deletedAt: true },
  });
  if (!target || target.deletedAt) throw new ApiError("NOT_FOUND", "Person not found");
  if (target.name === "Claude" || target.name === "ChatGPT") {
    throw new ApiError("BAD_REQUEST", "That's an AI teammate, not a person.");
  }

  const status = await getConnectionStatus(fromId, toId);
  if (status === "connected") return { status: "connected" };

  // They already asked YOU → accept it (mutual).
  if (status === "pending_incoming") {
    return { status: (await respondConnection(fromId, toId, true)).status };
  }
  if (status === "pending_outgoing") return { status: "pending_outgoing" };

  await db.connection.upsert({
    where: { requesterId_addresseeId: { requesterId: fromId, addresseeId: toId } },
    create: { requesterId: fromId, addresseeId: toId, status: "pending" },
    update: { status: "pending" },
  });

  const me = await db.user.findUnique({ where: { id: fromId }, select: { name: true } });
  const who = me?.name || "Someone";
  await pingConnection(toId, fromId, "connect_request", `${who} wants to connect 🤝`, "Tap to accept");

  return { status: "pending_outgoing" };
}

// Respond to an incoming request. accept → connected + tell them; decline →
// remove the request. `viewerId` must be the addressee of a pending request.
export async function respondConnection(
  viewerId: string,
  otherId: string,
  accept: boolean,
): Promise<{ status: ConnectionStatus }> {
  const pending = await db.connection.findUnique({
    where: { requesterId_addresseeId: { requesterId: otherId, addresseeId: viewerId } },
    select: { status: true },
  });
  if (!pending || pending.status !== "pending") {
    // Nothing to accept — maybe already connected.
    const status = await getConnectionStatus(viewerId, otherId);
    return { status };
  }

  if (accept) {
    await db.connection.update({
      where: { requesterId_addresseeId: { requesterId: otherId, addresseeId: viewerId } },
      data: { status: "accepted", respondedAt: new Date() },
    });
    const me = await db.user.findUnique({ where: { id: viewerId }, select: { name: true } });
    const who = me?.name || "Someone";
    await pingConnection(otherId, viewerId, "connect_accepted", `${who} accepted your connection 🤝`, "You're connected");
    return { status: "connected" };
  }

  await db.connection
    .delete({ where: { requesterId_addresseeId: { requesterId: otherId, addresseeId: viewerId } } })
    .catch(() => {});
  return { status: "none" };
}

// Remove an existing connection (either direction).
export async function removeConnection(viewerId: string, otherId: string): Promise<{ status: "none" }> {
  await db.connection
    .deleteMany({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: viewerId },
        ],
      },
    })
    .catch(() => {});
  return { status: "none" };
}

// The ids of everyone the user is connected with — used to fold connections into
// their addable "network".
export async function connectedUserIds(userId: string): Promise<string[]> {
  try {
    const rows = (await db.connection.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    })) as { requesterId: string; addresseeId: string }[];
    return [
      ...new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))),
    ];
  } catch {
    return [];
  }
}

export type ConnectionPerson = { id: string; name: string; image: string | null };

// Incoming connection requests waiting on the viewer — for a "Requests" list.
export async function listIncomingConnectionRequests(userId: string): Promise<ConnectionPerson[]> {
  try {
    const rows = (await db.connection.findMany({
      where: { addresseeId: userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { requesterId: true },
      take: 100,
    })) as { requesterId: string }[];
    if (rows.length === 0) return [];
    const users = (await db.user.findMany({
      where: { id: { in: rows.map((r) => r.requesterId) } },
      select: { id: true, name: true, email: true, image: true },
    })) as { id: string; name: string | null; email: string | null; image: string | null }[];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows
      .map((r) => byId.get(r.requesterId))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => ({ id: u.id, name: u.name || u.email || "Someone", image: u.image }));
  } catch {
    return [];
  }
}
