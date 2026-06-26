// Turn a display name into a URL-safe slug.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

// Append a short random suffix to keep slugs unique without a DB lookup loop.
export function uniqueSlug(input: string): string {
  const suffix = Math.abs(hashString(input + ":" + Date.now())).toString(36).slice(0, 4);
  return `${slugify(input)}-${suffix}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
