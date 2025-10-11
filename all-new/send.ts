import type { NextRequest } from 'next/server';
import { extractBotInfo } from './bot-registry';
import type { BotEventData, HumanEventData, PerformanceEventData } from './events';
import { getSiteIdWithFallback } from './analytics-host-utils';

export async function sendHumanEvent(payload: HumanEventData): Promise<void> {
  try {
    const response = await fetch("https://analytics.jillen.com/api/log/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Analytics] Server endpoint error: ${response.status} ${response.statusText} - human event failed`);
      return;
    }
  } catch (error) {
    // Log specific error types for debugging
    if (error instanceof TypeError) {
      console.error("[Analytics] Configuration error in human event:", error.message);
    } else if (error instanceof Error) {
      console.error("[Analytics] Error in human event:", error.message);
    } else {
      console.error("[Analytics] Unknown error in human event:", error);
    }
    // Silent fail - never break the application
    return;
  }
}

export async function sendPerformanceEvent(payload: PerformanceEventData): Promise<void> {
  try {
    const response = await fetch("https://analytics.jillen.com/api/log/metrics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Performance] Server endpoint error: ${response.status} ${response.statusText} - performance event failed`);
      return;
    }
  } catch (error) {
    // Log specific error types for debugging
    if (error instanceof TypeError) {
      console.error("[Performance] Configuration error in performance event:", error.message);
    } else if (error instanceof Error) {
      console.error("[Performance] Error in performance event:", error.message);
    } else {
      console.error("[Performance] Unknown error in performance event:", error);
    }
    // Silent fail - never break the application
    return;
  }
}

export async function sendBotEvent(payload: BotEventData): Promise<void> {
  try {
    const response = await fetch("https://analytics.jillen.com/api/log/ping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payload),
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
      console.error("[Jillen.Analytics] Error in bot tracking:", error.message);
    } else {
      console.error("[Jillen.Analytics] Unknown error in bot tracking:", error);
    }
    // Silent fail - never break the application
    return;
  }
}

export function sendBotVisit(request: NextRequest): void {
  void (async () => {
    try {
      // Extract data from request headers
      const hostFromHeader = request.headers.get('host') || 'unknown';
      const website_domain = getSiteIdWithFallback(hostFromHeader);
      const userAgent = request.headers.get('user-agent') || '';

      // Process bot data and create payload
      const botInfo = extractBotInfo(userAgent);
      const botPayload: BotEventData = {
        website_domain,
        userAgent,
        bot_name: botInfo.name,
        bot_category: botInfo.category,
        timestamp: new Date().toISOString(),
      };

      // Send the event
      await sendBotEvent(botPayload);
    } catch (error) {
      console.error("[Jillen.Analytics] Error in trackBotVisit:", error);
    }
  })();
}