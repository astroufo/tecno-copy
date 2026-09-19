import {
  TINYFISH_KEY_ENV_NAMES,
  readConfiguredKeys,
} from "./http";
import { getCache, setCache } from "./cache";
import type { Region } from "./regions";

export interface TinyFishKeyState {
  keyIndex: number;
  available: boolean;
  rateLimited: boolean;
  rateLimitRemaining: number | null;
  rateLimitResetAt: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

interface TinyFishSearchResponse {
  results: SearchResult[];
  total: number;
  keyIndex: number;
}

interface ScrapedContent {
  url: string;
  title: string;
  text: string;
  keyIndex: number;
}

export class TinyFishRouter {
  private keyStates: TinyFishKeyState[] = [];
  private initialized: boolean = false;

  async refreshTinyfishStatus(force: boolean = false): Promise<void> {
    if (!force && this.initialized && this.keyStates.length > 0) return;

    const keys = readConfiguredKeys(TINYFISH_KEY_ENV_NAMES);
    this.keyStates = keys.map((_key, index) => ({
      keyIndex: index,
      available: false, // Will be verified on first use
      rateLimited: false,
      rateLimitRemaining: null,
      rateLimitResetAt: null,
      lastCheckedAt: null,
      lastSuccessAt: null,
    }));

    // Try to verify each key with a lightweight request
    for (const keyState of this.keyStates) {
      try {
        const testKey = process.env[TINYFISH_KEY_ENV_NAMES[keyState.keyIndex]];
        if (!testKey) continue;

        const response = await fetch("https://api.tinyfish.ai/api/search", {
          headers: {
            Authorization: `Bearer ${testKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "test",
            limit: 1,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          keyState.available = true;
          keyState.lastCheckedAt = new Date().toISOString();
          keyState.lastSuccessAt = keyState.lastCheckedAt;
          const remaining = response.headers.get("x-ratelimit-remaining");
          if (remaining) {
            const parsed = Number(remaining);
            if (Number.isFinite(parsed)) keyState.rateLimitRemaining = parsed;
          }
        } else if (response.status === 401 || response.status === 403) {
          keyState.available = false;
          keyState.lastCheckedAt = new Date().toISOString();
        } else if (response.status === 429) {
          keyState.rateLimited = true;
          keyState.lastCheckedAt = new Date().toISOString();
          this.parseRateLimitHeaders(keyState, response);
        }
      } catch {
        keyState.available = false;
        keyState.lastCheckedAt = new Date().toISOString();
      }
    }

    this.initialized = true;
  }

  private parseRateLimitHeaders(
    keyState: TinyFishKeyState,
    response: Response
  ): void {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) {
        keyState.rateLimitResetAt = new Date(Date.now() + seconds * 1000).toISOString();
      }
    }
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining) {
      const parsed = Number(remaining);
      if (Number.isFinite(parsed)) keyState.rateLimitRemaining = parsed;
    }
  }

  private selectKey(): TinyFishKeyState | null {
    const available = this.keyStates.filter(
      k => k.available && !k.rateLimited
    );

    if (available.length === 0) return null;

    // Prefer key with highest remaining quota, then round-robin
    const maxRemaining = Math.max(
      ...available.map(k => k.rateLimitRemaining ?? 0)
    );
    const topQuota = available.filter(
      k => (k.rateLimitRemaining ?? 0) === maxRemaining
    );

    return topQuota[0];
  }

  private rotateKey(failedKey: TinyFishKeyState): TinyFishKeyState | null {
    failedKey.rateLimited = true;
    failedKey.lastCheckedAt = new Date().toISOString();
    return this.selectKey();
  }

  async tinyfishSearch(
    query: string,
    options: { limit?: number; region?: Region } = {}
  ): Promise<TinyFishSearchResponse> {
    if (!this.initialized) {
      await this.refreshTinyfishStatus(true);
    }

    const cacheKey = `tinyfish:search:${query}:${options.region ?? "global"}`;
    const cached = getCache<TinyFishSearchResponse>(cacheKey, 10 * 60 * 1000);
    if (cached) return cached;

    let keyState = this.selectKey();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (!keyState) {
        // All keys exhausted, wait and retry
        await this.backoff(attempt);
        keyState = this.selectKey();
        if (!keyState) break;
      }

      try {
        const testKey = process.env[TINYFISH_KEY_ENV_NAMES[keyState.keyIndex]];
        if (!testKey) {
          keyState = this.rotateKey(keyState);
          continue;
        }

        const region = options.region ?? "global";
        const regionPrefix = region !== "global" ? `[${region}] ` : "";

        const response = await fetch("https://api.tinyfish.ai/api/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${testKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `${regionPrefix}${query}`,
            limit: options.limit ?? 10,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const status = response.status;

        if (status === 200) {
          const data = await response.json();
          const result: TinyFishSearchResponse = {
            results: Array.isArray(data.results)
              ? data.results.map((r: any) => ({
                  title: r.title ?? "",
                  url: r.url ?? "",
                  snippet: r.snippet ?? "",
                  publishedAt: r.published_at,
                }))
              : [],
            total: data.total ?? 0,
            keyIndex: keyState.keyIndex,
          };

          keyState.lastCheckedAt = new Date().toISOString();
          keyState.lastSuccessAt = keyState.lastCheckedAt;
          const remaining = response.headers.get("x-ratelimit-remaining");
          if (remaining) {
            const parsed = Number(remaining);
            if (Number.isFinite(parsed)) keyState.rateLimitRemaining = parsed;
          }

          setCache(cacheKey, result, 10 * 60 * 1000);
          return result;
        }

        if (status === 401 || status === 403) {
          keyState.available = false;
          keyState.lastCheckedAt = new Date().toISOString();
          keyState = this.rotateKey(keyState);
          continue;
        }

        if (status === 429) {
          this.parseRateLimitHeaders(keyState, response);
          keyState = this.rotateKey(keyState);
          lastError = new Error("Rate limited");
          continue;
        }

        lastError = new Error(`TinyFish search failed with status ${status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      keyState = this.selectKey();
    }

    // Fallback to cached if available
    const cachedFallback = getCache<TinyFishSearchResponse>(
      cacheKey,
      60 * 60 * 1000
    );
    if (cachedFallback) return cachedFallback;

    // Return empty sanitized result
    console.error("TinyFish search failed:", lastError?.message);
    return { results: [], total: 0, keyIndex: -1 };
  }

  async tinyfishScrape(url: string): Promise<ScrapedContent | null> {
    if (!this.initialized) {
      await this.refreshTinyfishStatus(true);
    }

    const safeUrl = url; // URL validation should happen before calling
    const cacheKey = `tinyfish:scrape:${safeUrl}`;
    const cached = getCache<ScrapedContent>(cacheKey, 10 * 60 * 1000);
    if (cached) return cached;

    let keyState = this.selectKey();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (!keyState) {
        await this.backoff(attempt);
        keyState = this.selectKey();
        if (!keyState) break;
      }

      try {
        const testKey = process.env[TINYFISH_KEY_ENV_NAMES[keyState.keyIndex]];
        if (!testKey) {
          keyState = this.rotateKey(keyState);
          continue;
        }

        const response = await fetch("https://api.tinyfish.ai/api/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${testKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: safeUrl,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const status = response.status;

        if (status === 200) {
          const data = await response.json();
          const result: ScrapedContent = {
            url: safeUrl,
            title: data.title ?? "",
            text: typeof data.text === "string" ? data.text.slice(0, 10000) : "",
            keyIndex: keyState.keyIndex,
          };

          keyState.lastCheckedAt = new Date().toISOString();
          keyState.lastSuccessAt = keyState.lastCheckedAt;

          setCache(cacheKey, result, 10 * 60 * 1000);
          return result;
        }

        if (status === 401 || status === 403) {
          keyState.available = false;
          keyState.lastCheckedAt = new Date().toISOString();
          keyState = this.rotateKey(keyState);
          continue;
        }

        if (status === 429) {
          this.parseRateLimitHeaders(keyState, response);
          keyState = this.rotateKey(keyState);
          lastError = new Error("Rate limited");
          continue;
        }

        lastError = new Error(`TinyFish scrape failed with status ${status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      keyState = this.selectKey();
    }

    console.error("TinyFish scrape failed:", lastError?.message);
    return null;
  }

  async getTinyfishStatus(): Promise<{
    available: boolean;
    configuredKeys: number;
    usableKeys: number;
    rateLimitedKeys: number[];
  }> {
    if (!this.initialized) {
      await this.refreshTinyfishStatus(true);
    }

    return {
      available: this.keyStates.some(k => k.available && !k.rateLimited),
      configuredKeys: this.keyStates.length,
      usableKeys: this.keyStates.filter(k => k.available && !k.rateLimited).length,
      rateLimitedKeys: this.keyStates
        .map((k, i) => (k.rateLimited ? i : -1))
        .filter(i => i >= 0),
    };
  }

  private async backoff(attempt: number): Promise<void> {
    const delays = [1000, 2000, 4000];
    const delay = delays[Math.min(attempt, delays.length - 1)] ?? 4000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export const tinyfishRouter = new TinyFishRouter();
