import { getRegionalAnalytics, clearAnalyticsCache } from "./_shared/deterministicAnalytics";
import { ANALYTICS_CACHE_MS } from "./_shared/http";
import { isRegion, type Region } from "./_shared/regions";

export default function handler(req: Request): Response {
  try {
    const url = new URL(req.url);
    const regionParam = url.searchParams.get("region");
    if (!regionParam || !isRegion(regionParam)) {
      return Response.json({ error: "Missing or invalid 'region' query parameter. Must be one of: asia, europe, africa, americas, oceania" }, { status: 400 });
    }
    const region = regionParam as Region;
    const forceRefresh = url.searchParams.get("force") === "true";
    if (forceRefresh) {
      clearAnalyticsCache();
    }
    const analytics = getRegionalAnalytics(region);
    return Response.json({ ...analytics, cacheKey: `analytics:regional:${region}`, cacheExpiresAt: Date.now() + ANALYTICS_CACHE_MS }, { status: 200 });
  } catch (error) {
    console.error("Regional analytics error:", error);
    return Response.json({ error: "Regional analytics temporarily unavailable" }, { status: 503 });
  }
}
