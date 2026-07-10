// Auto-file a GitHub issue from in-app feedback, so a bug report flows straight
// into the place fixes actually happen (issue → PR → CI). Entirely opt-in: it's
// a no-op unless BOTH env vars are set, so nothing changes until you turn it on.
//
//   GITHUB_FEEDBACK_TOKEN  — a fine-grained PAT with Issues: Read & write on the
//                            target repo (nothing else). Keep it in Vercel env.
//   GITHUB_FEEDBACK_REPO   — "owner/name", e.g. "banalasiva/rhyza".
//
// Best-effort: any failure returns null and never blocks the feedback itself.

export function githubIssuesConfigured(): boolean {
  return !!process.env.GITHUB_FEEDBACK_TOKEN && !!process.env.GITHUB_FEEDBACK_REPO;
}

export async function createFeedbackIssue(input: {
  kind: string;
  message: string;
  reporter?: string | null;
  path?: string | null;
  userAgent?: string | null;
}): Promise<string | null> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  if (!token || !repo) return null;

  const firstLine = input.message.split("\n")[0].slice(0, 80).trim() || "New feedback";
  const title = `[${input.kind}] ${firstLine}`;
  const body = [
    input.message,
    "",
    "---",
    `**Reporter:** ${input.reporter ?? "unknown"}`,
    input.path ? `**Page:** \`${input.path}\`` : "",
    input.userAgent ? `**Device:** ${input.userAgent}` : "",
    "",
    "_Filed automatically from in-app feedback._",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "ThinkThru-Feedback",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) {
      console.error("[github] issue create failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { html_url?: string };
    return json.html_url ?? null;
  } catch (err) {
    console.error("[github] issue create threw", err);
    return null;
  }
}
