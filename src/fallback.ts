export interface FallbackOptions<T> {
  /**
   * Static value or function returning a value to fallback to on failure.
   */
  fallback: T | ((error: unknown) => T | Promise<T>);

  /**
   * Optional filter predicate. If provided, fallback only activates when this returns true.
   * If false, the original error is re-thrown.
   */
  when?: (error: unknown) => boolean;

  /**
   * Hook called whenever fallback is engaged.
   */
  onFallback?: (error: unknown) => void;
}

/**
 * Wraps an async operation with fallback handling for graceful degradation.
 *
 * @example
 * ```ts
 * const user = await withFallback(
 *   () => fetchUserFromPrimaryDb(id),
 *   {
 *     fallback: () => fetchUserFromCache(id),
 *     when: (err) => isDatabaseUnavailable(err),
 *   }
 * );
 * ```
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (options.when && !options.when(err)) {
      throw err;
    }

    if (options.onFallback) {
      options.onFallback(err);
    }

    if (typeof options.fallback === 'function') {
      return (options.fallback as (error: unknown) => T | Promise<T>)(err);
    }

    return options.fallback;
  }
}
