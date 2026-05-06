import type { BaseHumanEvent, PerformanceEvent } from "./event-types";
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
