import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";

// Onboarding is no longer a manual step — sign-in auto-provisions an org. If
// anyone lands here, send them straight into the app (which provisions if
// needed). Kept as a route so old links/bookmarks don't 404.
export default async function OnboardingPage() {
  await requireViewer(); // auto-provisions an org if missing
  redirect("/");
}
