import { signIn } from "@/auth";
import { getViewer } from "@/lib/session";
import { getInviteByToken } from "@/lib/services/invites";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const [viewer, invite] = await Promise.all([
    getViewer(),
    getInviteByToken(params.token),
  ]);

  const invalid =
    !invite || invite.status !== "pending" || invite.expired;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div className="garden-bg" />
      <div className="card relative z-10 w-full max-w-sm p-8 text-center">
        <div className="mb-1 text-3xl">🌱</div>

        {invalid || !invite ? (
          <>
            <h1 className="serif-lg mb-2">Invite unavailable</h1>
            <p className="text-sm text-ink-mid">
              {invite?.expired
                ? "This invite has expired."
                : invite?.status === "accepted"
                  ? "This invite has already been used."
                  : "We couldn't find this invite."}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow mb-2">You&apos;re invited</p>
            <h1 className="serif-lg mb-2">
              {invite.garden
                ? `${invite.garden.emoji} ${invite.garden.name}`
                : invite.orgName}
            </h1>
            <p className="mb-6 text-sm text-ink-mid">
              {invite.inviterName} invited you to join{" "}
              {invite.garden ? `the ${invite.garden.name} garden in ` : ""}
              <strong className="text-ink">{invite.orgName}</strong>.
            </p>

            {viewer ? (
              <AcceptInviteButton token={invite.token} />
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: `/invite/${params.token}` });
                }}
              >
                <button type="submit" className="btn-primary w-full">
                  Sign in to accept
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
