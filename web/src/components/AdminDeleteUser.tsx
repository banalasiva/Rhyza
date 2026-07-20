"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

// Owner tool: delete (anonymise) a member's account by email. Two-step so a
// stray tap can't erase someone.
export function AdminDeleteUser() {
  const [email, setEmail] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/delete-user", { email: email.trim() });
      setMsg(`✓ Deleted ${email.trim()} (anonymised). A compliance record was written.`);
      setEmail("");
      setArmed(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Couldn't delete that account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(229,115,115,0.25)] p-4">
      <p className="eyebrow mb-1" style={{ color: "#e57373" }}>
        Delete a member&apos;s account
      </p>
      <p className="mb-3 text-xs text-ink-soft">
        Anonymises the account (personal data + sign-in removed; their messages stay as “Deleted
        user”). Logged for compliance. Can&apos;t be undone.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setArmed(false);
          }}
          placeholder="member@email.com"
          className="flex-1 rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2 text-sm text-ink outline-none focus:border-[#e57373]"
        />
        {!armed ? (
          <button
            onClick={() => email.trim() && setArmed(true)}
            disabled={!email.trim()}
            className="shrink-0 rounded-lg border border-[rgba(229,115,115,0.4)] px-3 py-2 text-sm text-[#e57373] transition hover:bg-[rgba(229,115,115,0.08)] disabled:opacity-40"
          >
            Delete…
          </button>
        ) : (
          <button
            onClick={run}
            disabled={busy}
            className="shrink-0 rounded-lg bg-[#e57373] px-3 py-2 text-sm font-medium text-[#2a0d0d] transition disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Confirm delete"}
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-ink-mid">{msg}</p>}
    </div>
  );
}
