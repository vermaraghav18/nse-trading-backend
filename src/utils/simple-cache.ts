type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

/**
 * Returns cached value if still valid.
 */
export function getCacheValue<T>(key: string): T | null {
  const entry = cacheStore.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

/**
 * Saves value in cache for the given TTL.
 */
export function setCacheValue<T>(key: string, value: T, ttlMs: number): void {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Returns cached data if available, otherwise fetches and stores it.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cachedValue = getCacheValue<T>(key);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const freshValue = await fetcher();
  setCacheValue(key, freshValue, ttlMs);
  return freshValue;
}