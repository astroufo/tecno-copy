import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGlobalAnalytics, clearAnalyticsCache } from "./_shared/deterministicAnalytics";
import { ANALYTICS_CACHE_MS } from "./_shared/http";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const forceRefresh = req.query.force === "true";

    if (forceRefresh) {
      clearAnalyticsCache();
    }

    const analytics = getGlobalAnalytics();

    res.status(200).json({
      ...analytics,
      cacheKey: "analytics:global",
      cacheExpiresAt: Date.now() + ANALYTICS_CACHE_MS,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    
    // Return fallback analytics on error
    res.status(200).json({
      fuelLevy: 0,
      electricityTariffAdjustmentIndex: 0,
      waterScarcityAdjustedPriceIndex: 0,
      dataSource: "Fallback - Analytics unavailable",
      isLive: false,
      timestamp: new Date().toISOString(),
      error: "Analytics temporarily unavailable",
    });
  }
}