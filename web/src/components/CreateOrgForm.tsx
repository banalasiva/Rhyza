"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/client";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/orgs", { name });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="input"
        placeholder="e.g. Acme Engineering"
        aria-label="Organization name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />
      {error && <p className="text-sm text-[#e57373]">{error}</p>}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={busy || name.trim().length < 2}
      >
        {busy ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
