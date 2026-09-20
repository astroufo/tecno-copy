let redisClient: { get: (key: string) => Promise<string | null>, set: (key: string, value: string, ttlSeconds?: number) => Promise<void>, del: (key: string) => Promise<void> } | null = null;

async function getRedis() {
  if (redisClient !== null) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  const auth = `Basic ${btoa(`${token}:`)}`;

  redisClient = {
    async get(key: string): Promise<string | null> {
      try {
        const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
          method: "GET",
          headers: { Authorization: auth },
        });
        if (!response.ok) return null;
        const data: { result?: string } = await response.json();
        return data.result ?? null;
      } catch {
        return null;
      }
    },

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
      try {
        const ex = Math.max(1, Math.floor(ttlSeconds ?? 0));
        const response = await fetch(`${url}/set?ex=${ex}`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "text/plain" },
          body: value,
        });
        if (!response.ok) {
          // Silently ignore
        }
      } catch {
        // Silently ignore
      }
    },

    async del(key: string): Promise<void> {
      try {
        await fetch(`${url}/${encodeURIComponent(key)}`, {
          method: "DELETE",
          headers: { Authorization: auth },
        });
      } catch {
        // Silently ignore
      }
    },
  };

  return redisClient;
}

export { getRedis };