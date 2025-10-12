import type { NextRequest } from 'next/server';
import { extractBotInfo } from './bot-registry';
import type { BotEvent as BotEventData, BaseHumanEvent as HumanEventData, PerformanceEvent as PerformanceEventData } from './event-types';
import { getSiteIdWithFallback } from './analytics-host-utils';
import { sdk_version } from './version';

interface SendOptions {
  useBeacon?: boolean;
  forceFetch?: boolean;
}

/**
 * Send analytics event using Beacon API with fetch fallback
 * Beacon API: Guaranteed delivery, even on page unload
 */
export async function sendHumanEvent(
  payload: HumanEventData, 
  options: SendOptions = {}
): Promise<void> {
  const endpoint = "https://analytics.jillen.com/api/log/data";
  const payloadWithVersion: HumanEventData = {
    ...payload,
    sdk_version,
  };
  const data = JSON.stringify(payloadWithVersion);
  
  // Try Beacon API first (unless explicitly disabled)
  if (!options.forceFetch && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([data], { type: 'application/json' });
      
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch (error) {
      console.debug('[Analytics] Beacon API failed:', error);
    }
  }
  
  // Fallback to fetch with keepalive
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
      keepalive: true, // Attempts to complete even if page unloads
    });

    if (!response.ok) {
      console.error(`[Analytics] Server endpoint error: ${response.status} ${response.statusText} - human event failed`);
      return;
    }
  } catch (error) {
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

/**
 * Send performance metrics using Beacon API with fetch fallback
 */
export async function sendPerformanceEvent(
  payload: PerformanceEventData,
  options: SendOptions = {}
): Promise<void> {
  const endpoint = "https://analytics.jillen.com/api/log/metrics";
  const payloadWithVersion: PerformanceEventData = {
    ...payload,
    sdk_version,
  };
  const data = JSON.stringify(payloadWithVersion);
  
  // Try Beacon API first (unless explicitly disabled)
  if (!options.forceFetch && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([data], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch (error) {
      console.debug('[Performance] Beacon API failed:', error);
    }
  }
  
  // Fallback to fetch with keepalive
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
      keepalive: true,
    });

    if (!response.ok) {
      console.error(`[Performance] Server endpoint error: ${response.status} ${response.statusText} - performance event failed`);
      return;
    }
  } catch (error) {
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

/**
 * Internal function to send bot tracking events
 * Used only by sendBotVisit within this module
 */
async function sendBotEvent(payload: BotEventData): Promise<void> {
  const payloadWithVersion: BotEventData = {
    ...payload,
    sdk_version,
  };
  try {
    const response = await fetch("https://analytics.jillen.com/api/log/ping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: 'cors',
      body: JSON.stringify(payloadWithVersion),
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
        user_agent: userAgent,
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
