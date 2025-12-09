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
 * Internal function to send bot tracking events using standard fetch with timeout
 * Used only by sendBotVisit within this module
 */
async function sendBotEvent(payload: BotEvent): Promise<void> {
  const payloadWithVersion: BotEvent = {
    ...payload,
    sdk_version,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://analytics.jillen.com/api/bot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Jillen-Analytics-SDK/1.0",
      },
      mode: "cors",
      body: JSON.stringify(payloadWithVersion),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[Jillen.Analytics] Server endpoint error: ${response.status} ${response.statusText} - bot tracking failed`
      );
      return;
    }
  } catch (error) {
    // Log specific error types for debugging
    if (error instanceof TypeError) {
      if (error.message.includes("fetch failed") || error.message.includes("network")) {
        console.error(
          "[Jillen.Analytics] Network connectivity error in bot tracking:",
          error.message
        );
      } else {
        console.error(
          "[Jillen.Analytics] Request configuration error in bot tracking:",
          error.message
        );
      }
    } else if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[Jillen.Analytics] Bot tracking request timeout after 30 seconds");
    } else if (error instanceof Error) {
      console.error("[Jillen.Analytics] Bot tracking error:", error.name, error.message);
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
      const hostFromHeader = request.headers.get("host") || "unknown-hostname";
      const website_domain = getSiteIdWithFallback(hostFromHeader);
      const userAgent = request.headers.get("user-agent") || "";

      // Process bot data and create payload
      const botInfo = extractBotInfo(userAgent);
      const botPayload: BotEvent = {
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
