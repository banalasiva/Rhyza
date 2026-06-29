import Image from "next/image";

// Global route loader — the ThinkThru emblem while any page loads.
export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="garden-bg" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Image
          src="/emblem.png"
          alt="ThinkThru"
          width={72}
          height={72}
          priority
          className="h-[72px] w-[72px] animate-pulse"
        />
        <p className="text-sm text-ink-soft">Loading…</p>
      </div>
    </div>
  );
}
