import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getViewer } from "@/lib/session";
import { getInviteByToken, inviteMemberDestination } from "@/lib/services/invites";
import { getPublicSeedForGuest, getInvitedSeedConversation } from "@/lib/services/seeds";
import { Avatar } from "@/components/Avatar";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";

const BEATS = [
  { emoji: "💬", label: "Discuss" },
  { emoji: "⚖️", label: "Decide" },
  { emoji: "🌸", label: "Bloom" },
];

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const [viewer, invite] = await Promise.all([
    getViewer(),
    getInviteByToken(params.token),
  ]);
  const emailEnabled = !!process.env.RESEND_API_KEY;

  // Already in? Don't show an invite (or worse, an "expired" wall) — just take
  // them where they're going.
  if (viewer) {
    const dest = await inviteMemberDestination(viewer.userId, params.token);
    if (dest) redirect(dest);
  }

  // A link is only dead if it was turned off or has run out — being "used"
  // before doesn't kill it (invites are reusable, shareable links).
  const invalid = !invite || invite.status === "revoked" || invite.expired;

  if (invalid || !invite) {
    return (
      <Shell>
        <div className="mb-1 text-3xl">🥀</div>
        <h1 className="serif-lg mb-2">Invite unavailable</h1>
        <p className="text-sm text-ink-mid">
          {invite?.expired
            ? "This invite link has expired — ask whoever sent it for a fresh one."
            : invite?.status === "revoked"
              ? "This invite was turned off. Ask whoever sent it for a new link."
              : "We couldn’t find this invite. Double-check the link, or ask for a new one."}
        </p>
      </Shell>
    );
  }

  // Let the receiver FEEL the real discussion right here — before any login.
  // Content is the hook, not the button. For an OPEN link the token authorizes
  // viewing the invited seed whatever its visibility ("anyone with the link");
  // an email-scoped invite only peeks world-shared seeds pre-login (the intended
  // person sees the rest once they're in).
  const peek = invite.seed?.id
    ? await (invite.openLink
        ? getInvitedSeedConversation(invite.seed.id)
        : getPublicSeedForGuest(invite.seed.id)
      ).catch(() => null)
    : null;
  const peekMessages = (peek?.contributions ?? [])
    .filter((c) => c.text.trim().length > 0)
    .slice(0, 3);

  const inviterFirst = (invite.inviterName || "Someone").split(" ")[0];
  const place = invite.garden
    ? `${invite.garden.emoji} ${invite.garden.name}`
    : invite.orgName;

  return (
    <Shell>
      <Image
        src="/emblem.png"
        alt=""
        width={48}
        height={48}
        priority
        className="mx-auto mb-3 h-12 w-12"
      />
      <p className="eyebrow mb-1">{inviterFirst} invited you</p>

      {invite.seed ? (
        // Seed invite: lead with the actual question — that's the hook.
        <>
          <p className="mb-3 text-sm text-ink-mid">
            {inviterFirst} wants your take on a decision in{" "}
            <strong className="text-ink">{place}</strong>:
          </p>
          <div className="mb-5 rounded-xl border border-[rgba(76,175,80,0.2)] bg-[rgba(7,13,7,0.45)] p-4 text-left">
            <p className="mb-1 flex items-start gap-2 font-serif text-lg leading-snug text-ink">
              <span aria-hidden>🌱</span>
              <span>{invite.seed.title}</span>
            </p>
            {invite.seed.snippet && (
              <p className="text-sm leading-relaxed text-ink-soft">{invite.seed.snippet}</p>
            )}
          </div>

          {/* Real peek — a few actual messages, so the receiver feels how it's
              being thought through before they're asked to sign in. Only shows
              for a world-shared seed (guest-readable); private seeds skip it. */}
          {peekMessages.length > 0 && (
            <div className="mb-5 text-left">
              <p className="eyebrow mb-2">💬 A peek at the conversation</p>
              <ul className="space-y-2">
                {peekMessages.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(7,13,7,0.4)] p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Avatar name={c.author.name} image={c.author.image} size={22} />
                      <span className="text-xs font-medium text-ink">{c.author.name}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-mid">{c.text}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-soft">
                Join to read it all and add your voice ↓
              </p>
            </div>
          )}
        </>
      ) : (
        // Garden / org invite: name the space and what it's for.
        <>
          <h1 className="serif-lg mb-2">{place}</h1>
          <p className="mb-5 text-sm text-ink-mid">
            {inviterFirst} invited you to join{" "}
            {invite.garden ? "this space" : <strong className="text-ink">{invite.orgName}</strong>} — where a
            group thinks real decisions through together.
          </p>
        </>
      )}

      {/* What ThinkThru is, in three beats — for anyone who's never seen it. */}
      <div className="mb-6 flex items-center justify-center gap-2 text-xs text-ink-soft">
        {BEATS.map((b, i) => (
          <span key={b.label} className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span aria-hidden>{b.emoji}</span>
              {b.label}
            </span>
            {i < BEATS.length - 1 && <span aria-hidden className="text-ink-soft/50">→</span>}
          </span>
        ))}
      </div>

      {viewer ? (
        <AcceptInviteButton token={invite.token} seed={!!invite.seed} />
      ) : (
        <>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: `/invite/${params.token}` });
            }}
          >
            <button type="submit" className="btn-primary w-full">
              {invite.seed ? "Continue with Google" : "Sign in to accept"}
            </button>
          </form>

          {/* Email fallback — crucial for this flow. If Google picks the wrong
              account (or they'd rather use a specific address), a magic link
              brings them right back to THIS invite, so the invite is never lost. */}
          {emailEnabled && (
            <>
              <div className="my-3 flex items-center gap-3 text-[11px] text-ink-soft">
                <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
                or use your email
                <span className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
              </div>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const email = String(formData.get("email") || "").trim();
                  if (!email) return;
                  await signIn("resend", { email, redirectTo: `/invite/${params.token}` });
                }}
                className="space-y-2"
              >
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button type="submit" className="btn-ghost w-full">
                  Email me a sign-in link
                </button>
              </form>
            </>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            By continuing you agree to the Code of Conduct.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative flex min-h-screen items-center justify-center px-6">
      <div className="garden-bg" />
      <div className="card relative z-10 w-full max-w-sm p-8 text-center">{children}</div>
    </main>
  );
}
