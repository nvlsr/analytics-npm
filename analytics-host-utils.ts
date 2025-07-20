/**
 * Analytics Host Utilities
 * 
 * Utilities for extracting hostname from environment variables and request headers
 */

/**
 * Extract hostname from NEXT_PUBLIC_SERVER_URL environment variable
 * Falls back to 'unknown' if the URL is invalid or missing
 */
export function extractHostnameFromEnv(): string {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!serverUrl) return 'unknown';
  
  try {
    const url = new URL(serverUrl);
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Get site ID with fallback to environment variable
 * Priority: host header → environment variable → 'unknown'
 */
export function getSiteIdWithFallback(host: string | null): string {
  // If host is available and not 'unknown', use it
  if (host && host !== 'unknown') {
    return host;
  }
  
  // Fallback to environment variable
  return extractHostnameFromEnv();
} 