import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { primaryOrgId } from "@/lib/authz";
import { ensureUserOrg } from "@/lib/services/onboarding";

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  orgId: string | null;
};

// Resolve the current viewer for server components, or null if signed out.
// Wrapped in React cache() so multiple calls in one request hit the DB once.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user, orgId] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true },
    }),
    primaryOrgId(session.user.id),
  ]);
  if (!user) return null;
  return {
    userId: session.user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.image,
    orgId,
  };
});

// Require a signed-in viewer. Redirects to /login if signed out. New users are
// auto-provisioned an org (by email domain, or a personal workspace) so sign-in
// never stops to ask for an organization name.
export async function requireViewer(): Promise<Viewer & { orgId: string }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.orgId) {
    const orgId = await ensureUserOrg(viewer.userId, viewer.email, viewer.name);
    return { ...viewer, orgId };
  }
  return viewer as Viewer & { orgId: string };
}
