import { isRegion, type Region } from "./regions";

export function validateRegionParam(
  searchParams: { get: (key: string) => string | null },
): { ok: true; region: Region } | { ok: false; error: string } {
  const region = searchParams.get("region");
  if (region === null || region === undefined || region === "") {
    return { ok: false, error: "Missing 'region' query parameter" };
  }
  if (!isRegion(region)) {
    return { ok: false, error: `Invalid region: ${region}. Must be one of: asia, europe, africa, americas, oceania` };
  }
  return { ok: true, region };
}

export function validateRegionList(
  searchParams: { getAll: (key: string) => string[] },
  key = "region",
): { ok: true; regions: Region[] } | { ok: false; error: string } {
  const raw = searchParams.getAll(key);
  const regions: Region[] = [];
  for (const r of raw) {
    if (!r) continue;
    if (!isRegion(r)) {
      return { ok: false, error: `Invalid region: ${r}. Must be one of: asia, europe, africa, americas, oceania` };
    }
    regions.push(r);
  }
  return { ok: true, regions };
}

export function safeParseInt(value: string | null, fallback = 0): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function safeParseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function sanitizeError(message: string): string {
  return message.replace(/\n\s*\n/g, " ").slice(0, 500);
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(",")[0].trim();
  }
  const raw = req.headers["x-real-ip"];
  return typeof raw === "string" ? raw : "unknown";
}