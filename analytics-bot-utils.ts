import type { NextRequest } from 'next/server';
import { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

/**
 * Simplified Bot Tracking Utility
 * 
 * Fire-and-forget bot tracking with minimal data collection.
 * Designed for performance and reliability - no complex calculations.
 */

// Simple hash generation for bot IDs (no complex session windows)
function generateSimpleBotVisitorId(ip: string, userAgent: string): string {
  const normalizedUA = userAgent.toLowerCase().replace(/\s+/g, "");
  const combined = `bot:${ip}:${normalizedUA}`;
  return Buffer.from(combined)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 16);
}

function generateSimpleBotSessionId(ip: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const combined = `bot-session:${ip}:${today}`;
  return Buffer.from(combined)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 16);
}

/**
 * Track bot visit with minimal data collection
 * Fire-and-forget: does not throw errors or block execution
 */
export function trackBotVisit(request: NextRequest, pathname: string): void {
  // Fire-and-forget: run async without awaiting
  void (async () => {
    try {
      // Validate configuration
      if (!validateAnalyticsConfig()) {
        return;
      }

      const serverUrl = ANALYTICS_CONFIG.SERVER_URL;
      const siteId = ANALYTICS_CONFIG.SITE_ID;

      // Extract essential bot data
      const userAgent = request.headers.get('user-agent') || '';
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                request.headers.get('x-real-ip') || 
                'unknown';

      // Generate minimal required IDs
      const visitorId = generateSimpleBotVisitorId(ip, userAgent);
      const sessionId = generateSimpleBotSessionId(ip);

      // Prepare minimal bot payload
      const botPayload = {
        // Required fields (minimal values)
        siteId,
        path: pathname,
        visitorId,
        sessionId,
        eventType: "pageview" as const,
        
        // Essential bot data
        userAgent,
        ipAddress: ip,
        
        // Client-side fields (bots don't have these)
        isNewVisitor: true,
        screenResolution: null,
        viewportSize: null,
        connectionType: null,
        clientTimeZone: null,
        sessionStartTime: new Date().toISOString(),
        
        // Optional server fields (skip expensive lookups)
        referrer: request.headers.get('referer') || null,
        country: null,
        city: null,
        region: null,
        continent: null,
        latitude: null,
        longitude: null,
        timezone: null,
        postalCode: null,
        host: request.headers.get('host') || null,
        protocol: request.headers.get('x-forwarded-proto') as "http" | "https" || null,
        deploymentUrl: null,
        edgeRegion: null,
        language: null,
        doNotTrack: false,
        isMobile: /Mobi|Android/i.test(userAgent),
        cacheStatus: "UNKNOWN" as const,
      };

      // Send to analytics server (fire-and-forget)
      const endpoint = `${serverUrl}/api/log/ingest`;
      
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: 'cors',
        body: JSON.stringify(botPayload),
      });

    } catch {
      // Silent fail - do not log errors or throw exceptions
      // Bot tracking should never break the application
      return;
    }
  })();
} 