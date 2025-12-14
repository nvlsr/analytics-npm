import type { NextRequest } from "next/server";
import type { BaseHumanEvent, BotEvent, PerformanceEvent } from "./event-types";
import { getSiteIdWithFallback } from "./analytics-host-utils";
import { extractBotInfo } from "./bot-registry";
import { sdk_version } from "./version";

/**
 * Send analytics event using standard fetch with timeout
 */
export async function sendHumanEvent(payload: BaseHumanEvent): Promise<void> {
  const endpoint = "https://analytics.jillen.com/api/human";
  const payloadWithVersion: BaseHumanEvent = {
    ...payload,
    sdk_version,
  };
  const data = JSON.stringify(payloadWithVersion);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      body: data,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[Analytics] Server endpoint error: ${response.status} ${response.statusText} - human event failed`
      );
      return;
    }
  } catch (error) {
    if (error instanceof TypeError) {
      if (error.message.includes("fetch failed") || error.message.includes("network")) {
        console.error("[Analytics] Network connectivity error in human event:", error.message);
      } else {
        console.error("[Analytics] Request configuration error in human event:", error.message);
      }
    } else if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[Analytics] Human event request timeout after 30 seconds");
    } else if (error instanceof Error) {
      console.error("[Analytics] Human event error:", error.name, error.message);
    } else {
      console.error("[Analytics] Unknown error in human event:", error);
    }
    // Silent fail - never break the application
    return;
  }
}

/**
 * Send performance metrics using standard fetch with timeout
 */
export async function sendPerformanceEvent(payload: PerformanceEvent): Promise<void> {
  const endpoint = "https://analytics.jillen.com/api/perf";
  const payloadWithVersion: PerformanceEvent = {
    ...payload,
    sdk_version,
  };
  const data = JSON.stringify(payloadWithVersion);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      body: data,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[Performance] Server endpoint error: ${response.status} ${response.statusText} - performance event failed`
      );
      return;
    }
  } catch (error) {
    if (error instanceof TypeError) {
      if (error.message.includes("fetch failed") || error.message.includes("network")) {
        console.error(
          "[Performance] Network connectivity error in performance event:",
          error.message
        );
      } else {
        console.error(
          "[Performance] Request configuration error in performance event:",
          error.message
        );
      }
    } else if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[Performance] Performance event request timeout after 30 seconds");
    } else if (error instanceof Error) {
      console.error("[Performance] Performance event error:", error.name, error.message);
    } else {
      console.error("[Performance] Unknown error in performance event:", error);
    }
    // Silent fail - never break the application
    return;
  }
}

/**
 * Send bot tracking event - truly fire-and-forget
 *
 * Bot tracking is non-critical analytics data. We don't need to:
 * - Wait for the response (data is saved regardless)
 * - Log timeout errors (they're noise, data still gets saved)
 * - Block the middleware
 *
 * This runs in Edge Runtime (middleware) where:
 * - Fire-and-forget async might not complete reliably
 * - Network latency varies by edge location
 * - We confirmed server responds in ~100ms but edge fetch can timeout
 */
export function sendBotVisit(request: NextRequest): void {
  // Extract data synchronously before any async operations
  const hostFromHeader = request.headers.get("host") || "unknown-hostname";
  const website_domain = getSiteIdWithFallback(hostFromHeader);
  const userAgent = request.headers.get("user-agent") || "";
  const botInfo = extractBotInfo(userAgent);

  const payload: BotEvent = {
    website_domain,
    user_agent: userAgent,
    bot_name: botInfo.name,
    bot_category: botInfo.category,
    timestamp: new Date().toISOString(),
    sdk_version,
  };

  // Fire and completely forget - no await, no timeout, silent failures
  // The server saves data successfully even if the client times out
  fetch("https://analytics.jillen.com/api/bot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Jillen-Analytics-SDK/1.0",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silent fail - bot tracking is non-critical analytics
    // Data is typically saved server-side even when fetch "fails" client-side
  });
}
