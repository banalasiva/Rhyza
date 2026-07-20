"use client";

import { useState } from "react";

// Two-step self-service account deletion: reveal → type DELETE → confirm. The
// actual delete + sign-out is the server action passed in.
export function DeleteAccountButton({ action }: { action: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[rgba(229,115,115,0.4)] px-3 py-2 text-sm text-[#e57373] transition hover:bg-[rgba(229,115,115,0.08)]"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(229,115,115,0.4)] bg-[rgba(229,115,115,0.05)] p-4">
      <p className="mb-3 text-sm text-ink-mid">
        This permanently removes your personal data and your ability to sign in. Messages you wrote
        in group threads stay, shown as <span className="text-ink">“Deleted user,”</span> so
        others&apos; conversations aren&apos;t broken. <span className="text-ink">This can&apos;t be undone.</span>
      </p>
      <label className="mb-1 block text-[11px] text-ink-soft">
        Type <span className="font-semibold text-ink">DELETE</span> to confirm
      </label>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="DELETE"
        className="mb-3 w-full rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(7,13,7,0.5)] px-3 py-2 text-sm text-ink outline-none focus:border-[#e57373]"
      />
      <div className="flex items-center gap-2">
        <form action={action}>
          <button
            type="submit"
            disabled={text !== "DELETE"}
            className="rounded-lg bg-[#e57373] px-3 py-2 text-sm font-medium text-[#2a0d0d] transition disabled:opacity-40"
          >
            Permanently delete
          </button>
        </form>
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="btn-ghost text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
