"use client";

import { useState } from "react";
import { InviteForm } from "@/components/InviteForm";

// "Invite to this seed" affordance on the seed screen. Invites are scoped to the
// seed's garden — accepting grants org + garden membership, which is what lets
// someone actually open the seed (sharing the URL alone is not enough).
export function SeedInvite({ gardenId, gardenName }: { gardenId: string; gardenName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="inline-block">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
        {open ? "✕ Close" : "🔗 Invite"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 px-6 sm:left-auto sm:right-auto sm:px-0">
          <div className="card max-w-md p-4">
            <p className="mb-1 text-sm font-medium text-ink">Invite someone to join</p>
            <p className="mb-3 text-xs text-ink-soft">
              They&apos;ll join <strong className="text-ink-mid">{gardenName}</strong> and can open
              this seed. Sharing just the link won&apos;t give access — they need an invite.
            </p>
            <InviteForm gardenId={gardenId} />
          </div>
        </div>
      )}
    </div>
  );
}
