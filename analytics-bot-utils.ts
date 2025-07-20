import type { NextRequest } from 'next/server';
import { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

/**
 * Fire-and-forget bot tracking with minimal data collection.
 * Designed for performance and reliability.
 */

// Simple hash generation for bot IDs
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

      const edgeEndpoint = ANALYTICS_CONFIG.SERVER_URL;
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
        isBot: true, // ← NEW: Identify as bot event
        
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
        latitude: 0,
        longitude: 0,
        timezone: null,
        postalCode: null,
        host: request.headers.get('host') || null,
        protocol: request.headers.get('x-forwarded-proto') as "http" | "https" || null,
        deploymentUrl: null,
        edgeRegion: null,
        language: null,
        doNotTrack: false,
        isMobile: /Mobi|Android/i.test(userAgent),
      };

      // Send to Cloudflare worker endpoint (fire-and-forget)
      const response = await fetch(edgeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: 'cors',
        body: JSON.stringify(botPayload),
      });

      // Check for server endpoint issues
      if (!response.ok) {
        console.error(`[Jillen.Analytics] Server endpoint error: ${response.status} ${response.statusText} - bot tracking failed`);
        return;
      }

    } catch (error) {
      // Log specific error types for debugging
      if (error instanceof TypeError) {
        console.error("[Jillen.Analytics] Configuration error in bot tracking:", error.message);
      } else if (error instanceof Error) {
        console.error("[Jillen.Analytics] Network error in bot tracking:", error.message);
      } else {
        console.error("[Jillen.Analytics] Unknown error in bot tracking:", error);
      }
      // Silent fail - never break the application
      return;
    }
  })();
} 