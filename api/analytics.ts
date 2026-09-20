import { getGlobalAnalytics, clearAnalyticsCache } from "./_shared/deterministicAnalytics.js";
import { ANALYTICS_CACHE_MS } from "./_shared/http.js";

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url, "http://localhost");
    const forceRefresh = url.searchParams.get("force") === "true";

    if (forceRefresh) {
      await clearAnalyticsCache();
    }

    const analytics = await getGlobalAnalytics();

    return Response.json({
      ...analytics,
      cacheKey: "analytics:global",
      cacheExpiresAt: Date.now() + ANALYTICS_CACHE_MS,
    });
  } catch (error) {
    return Response.json({ error: "Analytics temporarily unavailable" }, { status: 503 });
  }
}