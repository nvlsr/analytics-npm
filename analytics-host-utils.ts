/**
 * Analytics Host Utilities
 * 
 * Utilities for extracting hostname from request headers
 */

/**
 * Get site ID from host header with fallback
 * Priority: host header → 'unknown'
 */
export function getSiteIdWithFallback(host: string | null): string {
  // If host is available and not 'unknown', use it
  if (host && host !== 'unknown') {
    return host;
  }
  
  // Fallback to 'unknown' if host is not available
  return 'unknown';
} 