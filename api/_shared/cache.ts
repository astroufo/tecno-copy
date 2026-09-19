export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function getCache<T>(key: string, _ttlMs: number): T | null {
  const entry = (globalThis as Record<string, unknown>).__cache as Map<string, CacheEntry<T>> | undefined;
  if (!entry) return null;
  const cached = entry.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    entry.delete(key);
    return null;
  }
  return cached.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  let entry = (globalThis as Record<string, unknown>).__cache as Map<string, CacheEntry<T>> | undefined;
  if (!entry) {
    entry = new Map();
    (globalThis as Record<string, unknown>).__cache = entry;
  }
  entry.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function deleteCache(key: string): void {
  const entry = (globalThis as Record<string, unknown>).__cache as Map<string, CacheEntry<unknown>> | undefined;
  entry?.delete(key);
}

export function clearCache(): void {
  (globalThis as Record<string, unknown>).__cache = new Map();
}

export function getCacheOrSet<T>(
  key: string,
  factory: () => T | Promise<T>,
  ttlMs: number,
): T | Promise<T> {
  const cached = getCache<T>(key, ttlMs);
  if (cached !== null) return cached;
  const result = factory();
  if (result instanceof Promise) {
    return result.then((data) => {
      setCache(key, data, ttlMs);
      return data;
    });
  }
  setCache(key, result, ttlMs);
  return result;
}

export function invalidateCache(key: string): void {
  deleteCache(key);
}