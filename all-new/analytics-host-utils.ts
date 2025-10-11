export function getSiteIdWithFallback(host: string | null): string {
  if (host && host !== 'unknown') {
    return host;
  }
  
  return 'unknown';
} 