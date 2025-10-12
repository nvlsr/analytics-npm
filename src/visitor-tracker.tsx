"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import { getSiteIdWithFallback } from "./analytics-host-utils";
import type { BaseHumanEvent, PerformanceEvent } from "./event-types";
import { AnalyticsStorage, AnalyticsSessionStorage } from "./storage-utils";
import { collectPerfMetrics } from "./performance-collector";
import { sendHumanEvent, sendPerformanceEvent } from "./send";

interface SessionData {
  session_id: string;
  last_activity: number;
}

function generateVisitorId(username?: string | null): string {
  // For authenticated users, use username-based ID
  if (username && username.trim() !== "") {
    const cleanUsername =
      username
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50) || "unknown-user";

    // Store the username-based ID
    AnalyticsStorage.setItem("visitor_id", cleanUsername);
    return cleanUsername;
  }

  // For anonymous users, check if we have a stored fingerprint-based ID
  const stored = AnalyticsStorage.getItem<string>("visitor_id");
  if (stored && !stored.includes("@") && stored !== "unknown-user") {
    return stored;
  }

  // Generate new fingerprint-based ID for anonymous users
  const fingerprint = [
    navigator.userAgent || "unknown",
    navigator.language || "unknown",
    screen.width + "x" + screen.height,
    (navigator as Navigator & { hardwareConcurrency?: number })
      .hardwareConcurrency || "unknown",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
  ].join("|");

  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const visitorId = Math.abs(hash).toString(36);
  AnalyticsStorage.setItem("visitor_id", visitorId);
  return visitorId;
}

function generateSessionId(): { sessionId: string; isNewSession: boolean } {
  if (typeof window !== "undefined") {
    const sessionData =
      AnalyticsSessionStorage.getItem<SessionData>("session_data");

    if (sessionData?.session_id) {
      const now = Date.now();
      const timeSinceActivity = now - sessionData.last_activity;
      const SESSION_TIMEOUT = 30 * 60 * 1000;

      if (timeSinceActivity < SESSION_TIMEOUT) {
        return { sessionId: sessionData.session_id, isNewSession: false };
      }

      AnalyticsSessionStorage.removeItem("session_data");
    }
  }

  const generateLightweightId = (): string => {
    try {
      const array = new Uint8Array(4);
      crypto.getRandomValues(array);

      const timestamp = Date.now().toString(36).slice(-4);
      const randomPart = Array.from(array)
        .map((byte) => byte.toString(36))
        .join("")
        .slice(0, 4);

      return `${timestamp}${randomPart}`.substring(0, 8);
    } catch {
      const timestamp = Date.now().toString(36).slice(-4);
      const randomPart = Math.random().toString(36).substring(2, 6);
      return `${timestamp}${randomPart}`.substring(0, 8);
    }
  };

  const newSessionId = generateLightweightId();
  const now = Date.now();

  // Store new session in sessionStorage
  if (typeof window !== "undefined") {
    AnalyticsSessionStorage.setItem("session_data", {
      session_id: newSessionId,
      last_activity: now,
    });
  }

  return { sessionId: newSessionId, isNewSession: true };
}

function getClientData(username?: string | null) {
  if (typeof window === "undefined") {
    return {
      isNewVisitor: true,
      screenResolution: null,
      viewportSize: null,
      connectionType: null,
      clientTimeZone: null,
      sessionStartTime: new Date().toISOString(),
      isNewSession: true,
    };
  }

  const visitorId = generateVisitorId(username);
  const { sessionId, isNewSession } = generateSessionId();
  let isNewVisitor: boolean;

  if (username && username.trim() !== "") {
    isNewVisitor = false;
  } else {
    const visitorCacheKey = `isNewVisitor_${visitorId}`;

    const cachedIsNewVisitor =
      AnalyticsSessionStorage.getItem<boolean>(visitorCacheKey);

    if (cachedIsNewVisitor === null) {
      const visitorExists = AnalyticsStorage.hasVisitor(visitorId);
      isNewVisitor = !visitorExists;

      AnalyticsSessionStorage.setItem(visitorCacheKey, isNewVisitor);

      if (isNewVisitor) {
        AnalyticsStorage.setVisitor(visitorId);
      }
    } else {
      isNewVisitor = cachedIsNewVisitor;
    }
  }

  let sessionStartTime = AnalyticsSessionStorage.getItem<string>(
    `session_start_${sessionId}`
  );
  if (!sessionStartTime) {
    sessionStartTime = new Date().toISOString();
    AnalyticsSessionStorage.setItem(
      `session_start_${sessionId}`,
      sessionStartTime
    );
  }

  const screenResolution = `${screen.width}x${screen.height}`;
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`;

  const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
  const connectionType = isMobile ? "mobile" : "desktop";

  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    isNewVisitor,
    screenResolution,
    viewportSize,
    connectionType,
    clientTimeZone,
    sessionStartTime,
    isNewSession,
  };
}

export interface VisitorTrackerProps {
  username?: string | null;
}

export function VisitorTracker({ username }: VisitorTrackerProps) {
  const pathname = usePathname();
  const isInitialized = useRef<boolean>(false);
  const lastTrackedPath = useRef<string>(pathname);
  const heartbeatInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const heartbeatEnabled = useRef<boolean>(true);
  const currentInterval = useRef<number>(15000); // Start with 15s
  const isActive = useRef<boolean>(true);

  // Track if we've already sent performance event for this page load
  const perfEventSent = useRef<boolean>(false);

  const isBot = useCallback(() => {
    if (typeof navigator !== "undefined" && isbot(navigator.userAgent)) {
      return true;
    }
    return false;
  }, []);

  const updateLastActivity = useCallback(() => {
    if (typeof window !== "undefined") {
      const sessionData =
        AnalyticsSessionStorage.getItem<SessionData>("session_data");
      if (sessionData) {
        sessionData.last_activity = Date.now();
        AnalyticsSessionStorage.setItem("session_data", sessionData);
      }
    }
  }, []);

  const sendPerfEvent = useCallback(async () => {
    // Performance events should only be sent once per page load
    if (perfEventSent.current) {
      return;
    }

    perfEventSent.current = true;

    setTimeout(async () => {
      try {
        const siteId = getSiteIdWithFallback(window.location.hostname);
        const visitorId = generateVisitorId(username);
        const perfMetrics = collectPerfMetrics();

        if (!perfMetrics) return;

        // Skip performance tracking for analytics interface pages on analytics.jillen.com
        if (
          siteId === "analytics.jillen.com" &&
          perfMetrics.page.includes("/performance/")
        ) {
          return;
        }

        const payload: PerformanceEvent = {
          ...perfMetrics,
          website_domain: siteId,
          visitor_id: visitorId,
        };

        await sendPerformanceEvent(payload);
      } catch (error) {
        console.error("[Performance] Error sending perf event:", error);
      }
    }, 1000);
  }, [username]);

  const sendEvent = useCallback(
    async (
      eventType: "pageview" | "session_start" | "heartbeat",
      referrer?: string
    ) => {
      if (process.env.NODE_ENV !== "production") {
        return;
      }

      // Send performance data on pageview events (production only)
      if (eventType === "pageview") {
        sendPerfEvent();
      }

      try {
        const siteId = getSiteIdWithFallback(window.location.hostname);
        const clientData = getClientData(username);
        const visitorId = generateVisitorId(username);
        const { sessionId } = generateSessionId();

        const payload: BaseHumanEvent = {
          website_domain: siteId,
          path: pathname,
          visitor_id: visitorId,
          session_id: sessionId,
          event_type: eventType,
          is_new_visitor: clientData.isNewVisitor,
          screen_resolution: clientData.screenResolution,
          viewport_size: clientData.viewportSize,
          connection_type: clientData.connectionType,
          client_time_zone: clientData.clientTimeZone,
          session_start_time: clientData.sessionStartTime,
          visitor_name: username ?? undefined,
          referrer: referrer,
        };

        await sendHumanEvent(payload);
      } catch (error) {
        console.error("[Analytics] Error sending event:", error);
      }
    },
    [pathname, username, sendPerfEvent]
  );

  const scheduleNextHeartbeat = useCallback(() => {
    if (!heartbeatEnabled.current || typeof window === "undefined") return;

    if (heartbeatInterval.current) {
      return;
    }

    heartbeatInterval.current = setTimeout(() => {
      heartbeatInterval.current = undefined;

      const sessionData =
        AnalyticsSessionStorage.getItem<SessionData>("session_data");
      const timeSinceActivity = sessionData
        ? Date.now() - sessionData.last_activity
        : 0;

      const inactivityThreshold = 2 * 60 * 1000; // 2 minutes
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

      if (timeSinceActivity >= SESSION_TIMEOUT) {
        heartbeatEnabled.current = false;
        return;
      }

      if (timeSinceActivity < inactivityThreshold) {
        sendEvent("heartbeat");
      }

      // Dynamic interval progression: 15s, 60s, 5m, 15m
      const intervals = [15000, 60000, 5 * 60 * 1000, 15 * 60 * 1000];
      const currentIndex = intervals.indexOf(currentInterval.current);

      if (currentIndex !== -1 && currentIndex < intervals.length - 1) {
        currentInterval.current = intervals[currentIndex + 1];
      }

      scheduleNextHeartbeat();
    }, currentInterval.current);
  }, [sendEvent]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    isActive.current = true;

    const sessionData =
      AnalyticsSessionStorage.getItem<SessionData>("session_data");
    const timeSinceActivity = sessionData
      ? now - sessionData.last_activity
      : Infinity;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    // Check if we need to start a new session due to timeout
    if (timeSinceActivity > SESSION_TIMEOUT) {
      const { isNewSession } = generateSessionId(); // This will create and store the new session

      // Only send session_start if this is actually a new session
      if (isNewSession) {
        sendEvent("session_start");
        sendEvent("pageview");
      }

      // Re-enable heartbeats for new session
      heartbeatEnabled.current = true;
    }

    updateLastActivity();

    // Reset to fastest interval on activity
    currentInterval.current = 15000;

    if (heartbeatEnabled.current) {
      scheduleNextHeartbeat();
    }
  }, [scheduleNextHeartbeat, sendEvent, updateLastActivity]);

  const throttleRef = useRef<{
    timeoutId?: NodeJS.Timeout;
    lastExecTime: number;
  }>({ lastExecTime: 0 });

  const throttledHandleActivity = useCallback(() => {
    const delay = 250; // 250ms throttle
    const currentTime = Date.now();

    if (currentTime - throttleRef.current.lastExecTime > delay) {
      handleActivity();
      throttleRef.current.lastExecTime = currentTime;
    } else {
      if (throttleRef.current.timeoutId) {
        clearTimeout(throttleRef.current.timeoutId);
      }
      throttleRef.current.timeoutId = setTimeout(() => {
        handleActivity();
        throttleRef.current.lastExecTime = Date.now();
      }, delay - (currentTime - throttleRef.current.lastExecTime));
    }
  }, [handleActivity]);

  // Track page views and set up activity detection
  useEffect(() => {
    // CRITICAL: Clean up any existing heartbeat when effect re-runs
    if (heartbeatInterval.current) {
      clearTimeout(heartbeatInterval.current);
      heartbeatInterval.current = undefined;
    }

    // Reset performance event flag when pathname changes
    if (lastTrackedPath.current !== pathname) {
      perfEventSent.current = false;
    }

    if (process.env.NODE_ENV !== "production") return;

    if (isBot()) {
      return;
    }

    // Get client data which includes session state
    const clientData = getClientData(username);
    const isNewSession = clientData.isNewSession;

    if (isNewSession && !isInitialized.current) {
      sendEvent("session_start");
      isInitialized.current = true;
    }

    // Always send pageview for new sessions or path changes
    if (isNewSession || lastTrackedPath.current !== pathname) {
      updateLastActivity();

      const referrer =
        typeof window !== "undefined" &&
        document.referrer &&
        document.referrer.length > 0
          ? document.referrer
          : undefined;

      sendEvent("pageview", referrer);
      lastTrackedPath.current = pathname;
    }

    // Set up activity event listeners
    if (typeof window !== "undefined") {
      const events = [
        "click",
        "keydown",
        "touchstart",
        "scroll",
        "wheel",
        "play",
        "pause",
        "seeked",
        "volumechange",
        "input",
        "change",
        "focus",
        "copy",
        "cut",
        "paste",
      ];

      events.forEach((event) => {
        window.addEventListener(event, throttledHandleActivity, {
          passive: true,
        });
      });

      const handleVisibilityChange = () => {
        if (document.hidden) {
          heartbeatEnabled.current = false;
          if (heartbeatInterval.current) {
            clearTimeout(heartbeatInterval.current);
            heartbeatInterval.current = undefined;
          }
        } else {
          heartbeatEnabled.current = true;
          isActive.current = true;
          scheduleNextHeartbeat();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Start the dynamic heartbeat system
      scheduleNextHeartbeat();

      return () => {
        events.forEach((event) => {
          window.removeEventListener(event, throttledHandleActivity);
        });
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );

        if (heartbeatInterval.current) {
          clearTimeout(heartbeatInterval.current);
        }
      };
    }

    // Return undefined when window is not available (SSR)
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pathname, // Only re-run when path changes
    username, // Only re-run when user changes
  ]);

  return null;
}
