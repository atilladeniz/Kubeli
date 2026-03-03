/** Max concurrent per-namespace API requests */
export const MAX_CONCURRENT_NS_REQUESTS = 5;

/** Debounce delay for watch restart on namespace change (ms) */
export const NAMESPACE_CHANGE_DEBOUNCE_MS = 300;

/**
 * Run async tasks with a concurrency limit, returning settled results.
 * Preserves order: results[i] corresponds to tasks[i].
 */
export async function pSettledWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        const value = await tasks[index]();
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
  return results;
}
