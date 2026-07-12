// A person's display name, with a graceful fallback. People who sign up via the
// email magic-link never set a name, so `name` is null — which used to surface
// everywhere as "Someone" with a "?" avatar, and made them impossible to @-tag.
// When there's no name we humanize the email's local part instead
// ("siva.prasad@x.com" → "Siva Prasad"), so they're recognizable and taggable.
export function displayName(u: { name?: string | null; email?: string | null }): string {
  const n = u.name?.trim();
  if (n) return n;
  const email = u.email?.trim();
  if (email && email.includes("@")) {
    const local = email.split("@")[0].replace(/[._+-]+/g, " ").trim();
    if (local) {
      return local
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return "Someone";
}
