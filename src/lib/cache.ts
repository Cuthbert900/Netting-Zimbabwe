import logger from '@/lib/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Retrieves an item from the cache.
 * @param key The cache key.
 * @returns The cached data, or null if the item is not found or has expired.
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    logger.debug({ key }, 'Cache hit');
    return entry.data as T;
  }
  logger.debug({ key }, 'Cache miss');
  return null;
}

/**
 * Adds an item to the cache.
 * @param key The cache key.
 * @param data The data to cache.
 */
export function setInCache<T>(key: string, data: T): void {
  logger.debug({ key }, 'Setting cache entry');
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}
