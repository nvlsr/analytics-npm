/**
 * Server-side utility to parse analytics data from Next.js headers
 */

export interface ParsedAnalyticsHeaders {
  ip: string;
  country: string | null;
  city: string | null;
  region: string | null;
  continent: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string | null;
  postalCode: string | null;
  host: string | null;
  protocol: "http" | "https" | null;
  deploymentUrl: string | null;
  userAgent: string;
  edgeRegion: string | null;
  cacheStatus: "HIT" | "MISS" | "BYPASS" | "STALE" | null;
  username: string | null;
}

export function parseAnalyticsHeaders(headers: Headers): ParsedAnalyticsHeaders {
  const ip = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown";
  const country = headers.get("x-vercel-ip-country") || null;
  const userAgent = headers.get("user-agent") || "";
  const city = headers.get("x-vercel-ip-city") || null;
  const region = headers.get("x-vercel-ip-country-region") || null;
  const continent = headers.get("x-vercel-ip-continent") || null;
  const latitude = headers.get("x-vercel-ip-latitude") || null;
  const longitude = headers.get("x-vercel-ip-longitude") || null;
  const timezone = headers.get("x-vercel-ip-timezone") || null;
  const postalCode = headers.get("x-vercel-ip-postal-code") || null;
  const host = headers.get("host") || null;
  const protocol = headers.get("x-forwarded-proto") as "http" | "https" | null;
  const deploymentUrl = headers.get("x-vercel-deployment-url") || null;
  const vercelId = headers.get("x-vercel-id") || null;

  // Extract edge region from x-vercel-id
  const edgeRegion = vercelId ? vercelId.split("::")[0] : null;
  const cacheStatus = null; // This would need to be determined differently

  return {
    ip,
    country,
    city,
    region,
    continent,
    latitude,
    longitude,
    timezone,
    postalCode,
    host,
    protocol,
    deploymentUrl,
    userAgent,
    edgeRegion,
    cacheStatus,
    username: null, 
  };
} 