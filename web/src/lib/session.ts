import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { primaryOrgId } from "@/lib/authz";

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  orgId: string | null;
};

// Resolve the current viewer for server components, or null if signed out.
export async function getViewer(): Promise<Viewer | null> {
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
}

// Require a signed-in, onboarded viewer. Redirects to /login or /onboarding.
export async function requireViewer(): Promise<Viewer & { orgId: string }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.orgId) redirect("/onboarding");
  return viewer as Viewer & { orgId: string };
}
