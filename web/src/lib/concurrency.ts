// Run an async fn over many items with a bounded number in flight at once —
// fast without stampeding the DB / push service / an upstream API. Preserves
// input order in the result. A rejected item propagates (callers that want
// best-effort should catch inside `fn`).
//
// This is the safe middle ground between a serial `for await` loop (too slow at
// scale) and `Promise.all` over everything (opens N connections/requests at
// once). For true fan-out at 100k+ recipients, move to a queue — see SCALING.md.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const n = items.length;
  const width = Math.max(1, Math.min(limit, n));
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: width }, () => worker()));
  return results;
}
