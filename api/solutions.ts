import { kiloRouter } from "./_shared/kiloRouter.js";
import { tinyfishRouter } from "./_shared/tinyfishRouter.js";
import { REGION_NAMES, type Region } from "./_shared/regions.js";
import { getGlobalAnalytics, getRegionalAnalytics } from "./_shared/deterministicAnalytics.js";
import { FACTORS_CACHE_MS } from "./_shared/http.js";
import { getCache, setCache } from "./_shared/cache.js";
import { safeParseJson } from "./_shared/validation.js";
import type { Factor } from "./_shared/types.js";

interface Solution {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: "High" | "Medium" | "Low";
  category: "Logistics" | "Operations" | "Strategy" | "Finance" | "Risk";
  relatedFactorIds: string[];
  region: Region | "global";
  scope: "global" | Region;
  createdAt: string;
}

const MAX_SOLUTIONS = 3;

const SYSTEM_PROMPT = (regionName: string | null, scope: "global" | Region): string =>
  `You are a Senior Business Strategy and Operations Consultant specializing in energy and water markets. You are provided with the following dynamic market factors that are currently affecting ${regionName ?? "global"} oil, electricity, and water prices.

For each group of related factors, generate ONE actionable business solution that helps business owners, executives, and decision-makers manage their companies better by making improved logistical and business decisions.

Each solution must:
- Be directly derived from and justified by the factors provided
- Be specific and actionable (not generic advice)
- Address real operational, logistical, financial, or strategic business challenges
- Include a clear impact statement explaining HOW this solution helps the business
- Target business owners, executives, procurement managers, or operations directors

Return strict JSON only. Do not return markdown or commentary outside JSON.

The response must contain exactly 3 validated solutions matching the required schema. Each solution must reference the factor IDs it is based on.`;

function normalizeSolution(raw: unknown, scope: "global" | Region, region: Region | null): Solution | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const title = typeof s.title === "string" ? s.title.trim() : "";
  const description = typeof s.description === "string" ? s.description.trim() : "";
  const impact = typeof s.impact === "string" ? s.impact.trim() : "";
  const category = s.category === "Logistics" || s.category === "Operations" || s.category === "Strategy" || s.category === "Finance" || s.category === "Risk" ? s.category : "Strategy";
  const priority = s.priority === "High" || s.priority === "Medium" || s.priority === "Low" ? s.priority : "Medium";
  const relatedFactorIds = Array.isArray(s.relatedFactorIds)
    ? (s.relatedFactorIds as string[]).filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const id = typeof s.id === "string" && s.id.trim() ? s.id.trim() : `solution-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (!title || !description || !impact || relatedFactorIds.length === 0) return null;

  return {
    id: id.slice(0, 80),
    title: title.slice(0, 200),
    description: description.slice(0, 1500),
    impact: impact.slice(0, 500),
    priority,
    category,
    relatedFactorIds: relatedFactorIds.slice(0, 8),
    region: region ?? (scope === "global" ? "global" : region),
    scope,
    createdAt: new Date().toISOString(),
  };
}

function dedupeSolutions(solutions: Solution[]): Solution[] {
  const seen = new Set<string>();
  const out: Solution[] = [];
  for (const s of solutions) {
    const key = s.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function replaceOldestSolutions(existing: Solution[], incoming: Solution[]): Solution[] {
  let next = [...existing, ...incoming];
  next = dedupeSolutions(next);
  if (next.length > MAX_SOLUTIONS) {
    const oldest = next
      .map((s) => ({ s, ts: Date.parse(s.createdAt) || 0 }))
      .sort((a, b) => a.ts - b.ts)
      .slice(0, next.length - MAX_SOLUTIONS);
    const oldestIds = new Set(oldest.map((o) => o.s.id));
    next = next.filter((s) => !oldestIds.has(s.id));
  }
  return next.slice(0, MAX_SOLUTIONS);
}

async function runSolutionsAnalysis(scope: "global" | Region, region: Region | null): Promise<Solution[]> {
  const cacheKey = `dynamic-solutions:${scope}`;
  const cached = await getCache<Solution[]>(cacheKey, FACTORS_CACHE_MS);
  if (cached && cached.length === MAX_SOLUTIONS) return cached;

  const factorsCacheKey = scope === "global" ? "dynamic-factors:global" : `dynamic-factors:${region}`;
  const factors = (await getCache<Factor[]>(factorsCacheKey, FACTORS_CACHE_MS)) ?? [];
  if (factors.length === 0) {
    return buildFallbackSolutions(scope, region);
  }

  const analytics = scope === "global" ? await getGlobalAnalytics() : await getRegionalAnalytics(region!);
  const searchQuery = scope === "global"
    ? "global oil electricity water market business impact 2026"
    : `${REGION_NAMES[region ?? "asia"]} energy market business strategy impact 2026`;
  const search = await tinyfishRouter.tinyfishSearch(`${searchQuery} ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`, {
    limit: 10,
    region: region ?? undefined,
  });
  const candidates = search.results
    .map((r) => ({ ...r, snippet: typeof r.snippet === "string" ? r.snippet : "" }))
    .filter((r) => true)
    .slice(0, 5);

  const excerpts = await Promise.all(
    candidates.map(async (r) => {
      try {
        const scraped = await tinyfishRouter.tinyfishScrape(r.url);
        return scraped ? { ...r, text: scraped.text, title: scraped.title || r.title } : r;
      } catch {
        return r;
      }
    }),
  );

  const prompt = SYSTEM_PROMPT(region ?? null, scope);
  const payload = {
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify({
          analytics,
          factors: factors.slice(0, 20),
          candidates: excerpts.map((c) => ({ title: c.title, source: c.url, snippet: c.snippet?.slice(0, 2500), text: (c as any).text?.slice(0, 8000) })),
          region: region ?? null,
          month: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        }),
      },
    ],
    max_tokens: 4096,
    temperature: 0.3,
  };

  try {
    const response = await kiloRouter.kiloInfer(payload);
    const content = response.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson<{ solutions?: unknown[] }>(content);
    if (!parsed?.solutions) return buildFallbackSolutions(scope, region);

    const normalized = parsed.solutions
      .map((s) => normalizeSolution(s, scope, region))
      .filter((s): s is Solution => s !== null)
      .filter((s) => s.scope === scope || (scope === "global" && s.region === "global"))
      .slice(0, MAX_SOLUTIONS);

    const result = replaceOldestSolutions(cached ?? [], normalized);
    return result;
  } catch {
    return buildFallbackSolutions(scope, region);
  }
}

function buildFallbackSolutions(scope: "global" | Region, region: Region | null): Solution[] {
  const now = new Date().toISOString();
  const regionName = scope === "global" ? "Global" : REGION_NAMES[region ?? "asia"];
  return [
    {
      id: `fallback-solutions-${scope}-1`,
      title: `Diversify ${regionName} Energy Sourcing Strategy`,
      description: `Given current ${regionName} market volatility across oil, electricity, and water, implement a multi-source energy procurement strategy that reduces dependency on single suppliers. Negotiate fixed-price contracts for 40-60% of anticipated consumption while keeping 40-60% variable to capture downward price movements. Establish pre-negotiated emergency purchase agreements with at least 3 alternative suppliers across different geographic zones.`,
      impact: "Reduces energy cost volatility by 25-40% and ensures supply continuity during geopolitical disruptions or supply chain shocks in the region.",
      priority: "High",
      category: "Strategy",
      relatedFactorIds: ["opec", "geopolitics", "storage"],
      region: region ?? "global",
      scope,
      createdAt: now,
    },
    {
      id: `fallback-solutions-${scope}-2`,
      title: `Implement Real-Time Price Monitoring & Automated Procurement Triggers`,
      description: `Deploy automated monitoring systems that track ${regionName} oil, electricity, and water price movements in real time. Configure algorithmic procurement triggers that automatically lock in favorable prices when key commodities drop below threshold levels. Use predictive analytics to forecast optimal purchasing windows based on seasonal patterns, weather forecasts, and geopolitical signals.`,
      impact: "Captures 15-25% in cost savings through strategic timing of procurement decisions and eliminates manual delay in responding to price drops.",
      priority: "High",
      category: "Operations",
      relatedFactorIds: ["weather", "storage", "carbon"],
      region: region ?? "global",
      scope,
      createdAt: now,
    },
    {
      id: `fallback-solutions-${scope}-3`,
      title: `Accelerate On-Site Renewable & Water Recycling Investments`,
      description: `Given the ${regionName} trajectory of rising energy and water costs, accelerate capital deployment into on-site renewable energy (solar, battery storage) and water recycling/reuse infrastructure. Target a 30-50% reduction in grid electricity and municipal water dependency within 3-5 years. Structure the investment as a phased rollout prioritizing highest-consumption facilities first for fastest ROI.`,
      impact: "Long-term cost lock-in at 60-80% below projected grid/municipal rates, ESG compliance, and protection from future carbon pricing and water scarcity regulations.",
      priority: "Medium",
      category: "Finance",
      relatedFactorIds: ["renewables", "scarcity", "desalination"],
      region: region ?? "global",
      scope,
      createdAt: now,
    },
  ] as Solution[];
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const regionParam = url.searchParams.get("region");
    const isGlobal = regionParam === null || regionParam === "";
    const scope = isGlobal ? ("global" as const) : (regionParam as Region);

    if (!isGlobal && !["asia", "europe", "africa", "americas", "oceania"].includes(scope)) {
      return Response.json({ error: "Invalid region. Must be one of: asia, europe, africa, americas, oceania" }, { status: 400 });
    }

    const cacheKey = `dynamic-solutions:${scope}`;
    if (!force) {
      const cached = await getCache<Solution[]>(cacheKey, FACTORS_CACHE_MS);
      if (cached && cached.length > 0) {
        return Response.json({ solutions: cached, scope, count: cached.length, aiCurated: true, cacheKey, updatedAt: new Date().toISOString() }, { status: 200 });
      }
    }

    const solutions = await runSolutionsAnalysis(scope, isGlobal ? null : scope as Region);
    await setCache(cacheKey, solutions, FACTORS_CACHE_MS);
    return Response.json({ solutions, scope, count: solutions.length, aiCurated: true, cacheKey, updatedAt: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    const urlSafeScope = (url: URL): "global" | Region => {
      const region = url.searchParams.get("region");
      return region === null || region === "" ? "global" : (region as Region);
    };
    const scope = urlSafeScope(new URL(req.url));
    const fallback = buildFallbackSolutions(scope, scope === "global" ? null : scope);
    return Response.json({ solutions: fallback, scope, count: fallback.length, aiCurated: false, cacheKey: `dynamic-solutions:${scope}`, updatedAt: new Date().toISOString(), error: "Dynamic solutions temporarily unavailable; static fallbacks returned" }, { status: 200 });
  }
}
