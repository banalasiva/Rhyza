// One shared "share this" helper for the whole app. On phones it opens the
// native share sheet (WhatsApp, Gmail, Slack, Messages…) via the Web Share API;
// on desktop (no navigator.share) it copies the link to the clipboard instead.
// `path` is app-relative (e.g. "/seeds/abc") — we prepend the current origin so
// the shared URL is always the live domain.
export async function shareOrCopy(opts: {
  path: string;
  title: string;
  text?: string;
}): Promise<"shared" | "copied" | "cancelled"> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${opts.path}`;
  const data = { title: opts.title, text: opts.text ?? opts.title, url };

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch {
      // User dismissed the sheet (or it failed) — don't fall through to a
      // surprise clipboard write; just treat it as cancelled.
      return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(`${opts.text ? `${opts.text} ` : ""}${url}`);
    return "copied";
  } catch {
    return "cancelled";
  }
}
