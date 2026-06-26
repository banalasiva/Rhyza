import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { CreateOrgForm } from "@/components/CreateOrgForm";

// First-run: a signed-in user with no organization creates one here.
export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.orgId) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="garden-bg" />
      <div className="card relative z-10 w-full max-w-md p-8">
        <p className="eyebrow mb-2">Welcome, {viewer.name || "friend"}</p>
        <h1 className="serif-lg mb-2">Name your organization</h1>
        <p className="mb-6 text-sm text-ink-mid">
          An organization is the soil your gardens grow in. You can invite
          teammates once it&apos;s created.
        </p>
        <CreateOrgForm />
      </div>
    </main>
  );
}
