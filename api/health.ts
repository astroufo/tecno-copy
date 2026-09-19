import { REGION_NAMES, type Region } from "./_shared/regions.js";
import { getGlobalAnalytics, getRegionalAnalytics } from "./_shared/deterministicAnalytics.js";
import { kiloRouter } from "./_shared/kiloRouter.js";
import { tinyfishRouter } from "./_shared/tinyfishRouter.js";

interface HealthResponse {
  kiloGateway: {
    available: boolean;
    zeroCostModels: string[];
    defaultModel: string;
    activeModel: string | null;
    configuredKeys: number;
    usableKeys: number;
    rateLimitedKeys: number[];
    rateLimitedModels: string[];
    globalRateLimited: boolean;
    catalogLastRefresh: string | null;
  };
  tinyfish: {
    available: boolean;
    configuredKeys: number;
    usableKeys: number;
    rateLimitedKeys: number[];
  };
  onlineModelConnected: boolean;
  analytics: {
    global: {
      lastFetch: string | null;
      success: boolean;
    };
    regional: Record<
      Region,
      {
        lastFetch: string | null;
        success: boolean;
      }
    >;
  };
  dynamicFactors: {
    global: {
      lastRun: string | null;
      nextRun: string | null;
      aiCurated: boolean;
      pollIntervalMs: number;
    };
    regional: Record<
      Region,
      {
        lastRun: string | null;
        nextRun: string | null;
        aiCurated: boolean;
        pollIntervalMs: number;
      }
    >;
  };
}

export default async function handler(_req: any, res: any): Promise<void> {
  try {
    const kiloStatus = await kiloRouter.getKiloStatus();
    const tinyfishStatus = await tinyfishRouter.getTinyfishStatus();

    // Check analytics availability (deterministic, always available)
    const globalAnalytics = getGlobalAnalytics();
    const regionalAnalytics: Record<Region, { lastFetch: string | null; success: boolean }> = {} as Record<
      Region,
      { lastFetch: string | null; success: boolean }
    >;

    for (const region of Object.keys(REGION_NAMES) as Region[]) {
      try {
        getRegionalAnalytics(region);
        regionalAnalytics[region] = {
          lastFetch: new Date().toISOString(),
          success: true,
        };
      } catch {
        regionalAnalytics[region] = {
          lastFetch: null,
          success: false,
        };
      }
    }

    const onlineModelConnected =
      process.env.AI_FORECAST_ENABLED === "true" &&
      kiloStatus.available &&
      kiloStatus.usableKeys > 0 &&
      kiloStatus.zeroCostModels.length > 0 &&
      tinyfishStatus.available &&
      tinyfishStatus.usableKeys > 0;

    const response: HealthResponse = {
      kiloGateway: {
        available: kiloStatus.available,
        zeroCostModels: kiloStatus.zeroCostModels,
        defaultModel: kiloStatus.defaultModel,
        activeModel: kiloStatus.activeModel,
        configuredKeys: kiloStatus.configuredKeys,
        usableKeys: kiloStatus.usableKeys,
        rateLimitedKeys: kiloStatus.rateLimitedKeys,
        rateLimitedModels: kiloStatus.rateLimitedModels,
        globalRateLimited: kiloStatus.globalRateLimited,
        catalogLastRefresh: kiloStatus.catalogLastRefresh,
      },
      tinyfish: {
        available: tinyfishStatus.available,
        configuredKeys: tinyfishStatus.configuredKeys,
        usableKeys: tinyfishStatus.usableKeys,
        rateLimitedKeys: tinyfishStatus.rateLimitedKeys,
      },
      onlineModelConnected,
      analytics: {
        global: {
          lastFetch: globalAnalytics.timestamp,
          success: true,
        },
        regional: regionalAnalytics,
      },
      dynamicFactors: {
        global: {
          lastRun: null,
          nextRun: null,
          aiCurated: false,
          pollIntervalMs: 120000,
        },
        regional: Object.fromEntries(
          (Object.keys(REGION_NAMES) as Region[]).map((region) => [
            region,
            {
              lastRun: null,
              nextRun: null,
              aiCurated: false,
              pollIntervalMs: 120000,
            },
          ])
        ) as Record<
          Region,
          {
            lastRun: string | null;
            nextRun: string | null;
            aiCurated: boolean;
            pollIntervalMs: number;
          }
        >,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    // Never expose raw errors to the client
    console.error("Health check failed:", error);
    res.status(503).json({
      error: "Health check temporarily unavailable",
      onlineModelConnected: false,
    });
  }
}