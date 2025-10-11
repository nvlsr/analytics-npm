import type { NextRequest } from 'next/server';
import { extractBotInfo } from './bot-registry';
import type { BotEventData } from './events';
import { getSiteIdWithFallback } from './analytics-host-utils';

function processBotData(website_domain: string, userAgent: string): BotEventData {
  const botInfo = extractBotInfo(userAgent);
  const timestamp = new Date().toISOString();

  return {
    website_domain,
    userAgent,
    bot_name: botInfo.name,
    bot_category: botInfo.category,
    timestamp,
  };
}

export function trackBotVisit(request: NextRequest): void {
  void (async () => {
    try {
      const edgeEndpoint = `https://analytics.jillen.com/api/log/ping`;
      const hostFromHeader = request.headers.get('host') || 'unknown';
      const siteId = getSiteIdWithFallback(hostFromHeader);

      const userAgent = request.headers.get('user-agent') || '';

      const botPayload: BotEventData = processBotData(siteId, userAgent);

      const response = await fetch(edgeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: 'cors',
        body: JSON.stringify(botPayload),
      });

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