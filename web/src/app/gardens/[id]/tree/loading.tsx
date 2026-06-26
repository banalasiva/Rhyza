export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="garden-bg" />
      <div className="relative z-10 text-center">
        <div className="mb-2 animate-pulse text-4xl">🌳</div>
        <p className="text-sm text-ink-mid">Growing the Sacred Tree…</p>
      </div>
    </div>
  );
}
