import { db } from "@/lib/db";

// One-click unsubscribe from email — no login required, just the token from the
// email footer. Turns off both instant emails and the daily digest. Push and
// the in-app bell are unaffected; people can re-enable email in settings.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  let ok = false;
  if (token) {
    const res = await db.user.updateMany({
      where: { unsubToken: token },
      data: { emailNotify: false, digestNotify: false },
    });
    ok = res.count > 0;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl">{ok ? "🌿" : "🌱"}</div>
      <h1 className="mt-4 text-xl font-light text-ink">
        {ok ? "You're unsubscribed from emails" : "We couldn't find that link"}
      </h1>
      <p className="mt-3 text-sm text-ink-soft">
        {ok
          ? "You won't get notification or digest emails anymore. You'll still see everything in the app, and you can turn emails back on anytime in your notification settings."
          : "This unsubscribe link looks expired or invalid. You can manage all your notification preferences from your account settings instead."}
      </p>
      <a
        href="/notifications"
        className="mt-6 rounded-full bg-[#4CAF50] px-5 py-2 text-sm font-semibold text-[#070D07] transition hover:bg-[#5cbb60]"
      >
        Notification settings
      </a>
    </main>
  );
}
