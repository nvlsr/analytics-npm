"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import { getSiteIdWithFallback } from "./analytics-host-utils";
import { AnalyticsStorage, AnalyticsSessionStorage } from "./storage-utils";

function generateVisitorId(ip: string): string {
  try {
    return Buffer.from(ip)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
  } catch {
    // Fallback for browser environment
    return btoa(ip).replace(/[^a-zA-Z0-9]/g, "");
  }
}

export interface VisitorTrackerProps {
  ip: string;
  country: string | null;
  city: string | null;
  region: string | null;
  continent?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  timezone?: string | null;
  postalCode?: string | null;
  host?: string | null;
  protocol?: "http" | "https" | null;
  deploymentUrl?: string | null;
  route: string;
  userAgent: string;
  // Optional server-side header data
  edgeRegion?: string | null;
  username?: string | null;
}

export function VisitorTracker({
  ip,
  country,
  city,
  region,
  continent,
  latitude,
  longitude,
  timezone,
  postalCode,
  host,
  protocol,
  deploymentUrl,
  route,
  userAgent,
  edgeRegion,
  username,
}: VisitorTrackerProps) {
  const pathname = usePathname();
  const isInitialized = useRef<boolean>(false);
  const lastTrackedPath = useRef<string>(route);

  // Heartbeat state management
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const currentIntervalRef = useRef<number>(15000); // Start at 15s
  const lastActivityRef = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(true);
  const heartbeatEnabledRef = useRef<boolean>(true);

  // Check if this is a bot environment
  const checkIfBot = useCallback(() => {
    // Check server-provided user agent first
    if (isbot(userAgent)) {
      return true;
    }

    // Check client-side navigator user agent
    if (typeof navigator !== "undefined" && isbot(navigator.userAgent)) {
      return true;
    }

    // Additional client-side bot checks
    if (typeof window !== "undefined") {
      // Check for headless browser indicators
      const win = window as Window & {
        navigator?: Navigator & { webdriver?: boolean };
        phantom?: unknown;
        callPhantom?: unknown;
        __nightmare?: unknown;
      };
      if (
        win.navigator?.webdriver ||
        win.phantom ||
        win.callPhantom ||
        win.__nightmare
      ) {
        return true;
      }

      // Check for missing typical browser features that bots might lack
      if (!window.localStorage || !window.sessionStorage) {
        return true;
      }
    }

    return false;
  }, [userAgent]);

  const generateSessionId = useCallback((): string => {
    // Check for existing session ID with 30-minute timeout
    if (typeof window !== "undefined") {
      const existingSessionId =
        AnalyticsSessionStorage.getItem<string>("session_id");
      const sessionTimestamp =
        AnalyticsSessionStorage.getItem<number>("session_timestamp");

      if (existingSessionId && sessionTimestamp) {
        const sessionAge = Date.now() - sessionTimestamp;
        const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

        if (sessionAge < SESSION_TIMEOUT) {
          // Session is still valid, update timestamp and return existing ID
          AnalyticsSessionStorage.setItem("session_timestamp", Date.now());
          return existingSessionId;
        }

        // Session expired, clear it
        AnalyticsSessionStorage.removeItem("session_id");
        AnalyticsSessionStorage.removeItem("session_timestamp");
      }
    }

    // Generate new lightweight session ID
    const generateLightweightId = (): string => {
      try {
        // Use crypto.getRandomValues() for secure randomness
        const array = new Uint8Array(4);
        crypto.getRandomValues(array);

        // Convert to base36 and combine with timestamp
        const timestamp = Date.now().toString(36).slice(-4); // Last 4 chars of timestamp in base36
        const randomPart = Array.from(array)
          .map((byte) => byte.toString(36))
          .join("")
          .slice(0, 4); // Take first 4 chars

        return `${timestamp}${randomPart}`.substring(0, 8);
      } catch {
        // Fallback to Math.random() if crypto is unavailable
        const timestamp = Date.now().toString(36).slice(-4);
        const randomPart = Math.random().toString(36).substring(2, 6);
        return `${timestamp}${randomPart}`.substring(0, 8);
      }
    };

    const newSessionId = generateLightweightId();

    // Store in sessionStorage with timestamp (persists across page loads, expires with browser session)
    if (typeof window !== "undefined") {
      AnalyticsSessionStorage.setItem("session_id", newSessionId);
      AnalyticsSessionStorage.setItem("session_timestamp", Date.now());
    }

    return newSessionId;
  }, []);

  // Get enhanced client-side data
  const getClientData = useCallback(() => {
    // SSR Guard: Return safe defaults if running on server
    if (typeof window === "undefined") {
      return {
        isNewVisitor: true,
        screenResolution: null,
        viewportSize: null,
        connectionType: null,
        clientTimeZone: null,
        sessionStartTime: new Date().toISOString(),
      };
    }

    // Check if this is a new visitor using session-level caching
    const visitorId = generateVisitorId(ip);
    const sessionId = generateSessionId();
    const sessionCacheKey = `isNewVisitor_${sessionId}`;

    // Check if we already determined isNewVisitor for this session
    const cachedIsNewVisitor =
      AnalyticsSessionStorage.getItem<boolean>(sessionCacheKey);
    let isNewVisitor: boolean;

    if (cachedIsNewVisitor === null) {
      // First event in this session - make the determination
      const visitorExists = AnalyticsStorage.hasVisitor(visitorId);
      isNewVisitor = !visitorExists;

      // Cache the decision for this entire session
      AnalyticsSessionStorage.setItem(sessionCacheKey, isNewVisitor);

      // Mark visitor as seen for future sessions (only if they're new)
      if (isNewVisitor) {
        AnalyticsStorage.setVisitor(visitorId);
      }
    } else {
      // Use the cached decision from earlier in this session
      isNewVisitor = cachedIsNewVisitor;
    }

    // Get session start time (persistent for this session)
    // Note: reusing sessionId from above
    let sessionStartTime = AnalyticsStorage.getSessionStart(sessionId);
    if (!sessionStartTime) {
      sessionStartTime = new Date().toISOString();
      AnalyticsStorage.setSessionStart(sessionId, sessionStartTime);
    }

    // Get screen and viewport data (safe now that we're client-side)
    const screenResolution = `${screen.width}x${screen.height}`;
    const viewportSize = `${window.innerWidth}x${window.innerHeight}`;

    // Get connection type (if available)
    const connectionType = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        return (
          nav.connection?.effectiveType || nav.connection?.type || "unknown"
        );
      } catch {
        return "unknown";
      }
    })();

    // Get client timezone
    const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      isNewVisitor,
      screenResolution,
      viewportSize,
      connectionType,
      clientTimeZone,
      sessionStartTime,
    };
  }, [ip, generateSessionId]);

  // Send event to analytics system
  const sendAnalyticsEvent = useCallback(
    async (
      eventType: "pageview" | "session_start" | "heartbeat",
      referrer?: string,
      customPath?: string
    ) => {
      // Skip analytics in development
      if (process.env.NODE_ENV !== "production") {
        return;
      }

      const siteId = getSiteIdWithFallback(host || null);
      const edgeEndpoint = "https://analytics-ingestion.maaakri.workers.dev";

      // Extract standard client-side data with SSR guards
      const language =
        typeof navigator !== "undefined"
          ? navigator.language || navigator.languages?.[0] || undefined
          : undefined;
      const doNotTrack =
        typeof navigator !== "undefined" ? navigator.doNotTrack === "1" : false;
      const isMobile =
        typeof navigator !== "undefined"
          ? /Mobi|Android/i.test(navigator.userAgent)
          : /Mobi|Android/i.test(userAgent); // Fallback to server userAgent

      // Get enhanced client data
      const clientData = getClientData();

      const devCountry = country;
      const devCity = city;
      const devRegion = region;
      const devEdgeRegion = edgeRegion;

      // Prepare event payload
      const eventPayload = {
        siteId,
        path: customPath || route,
        visitorId: generateVisitorId(ip),
        sessionId: generateSessionId(),
        eventType,
        isBot: false,
        // Enhanced client-side fields
        isNewVisitor: clientData.isNewVisitor,
        screenResolution: clientData.screenResolution,
        viewportSize: clientData.viewportSize,
        connectionType: clientData.connectionType,
        clientTimeZone: clientData.clientTimeZone,
        sessionStartTime: clientData.sessionStartTime,
        // Server-side fields
        ipAddress: ip,
        userAgent,
        referrer,
        country: devCountry || undefined,
        city: devCity || undefined,
        region: devRegion || undefined,
        continent: continent || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        timezone: timezone || undefined,
        postalCode: postalCode || undefined,
        host: host || undefined,
        protocol: protocol || undefined,
        deploymentUrl: deploymentUrl || undefined,
        edgeRegion: devEdgeRegion || undefined,
        language,
        doNotTrack,
        isMobile,
        username: username || undefined,
      };

      // Send to Cloudflare worker endpoint (fire-and-forget)
      void (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(edgeEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            mode: "cors",
            body: JSON.stringify(eventPayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check for server endpoint issues
          if (!response.ok) {
            console.error(
              `[Jillen.Analytics] Server endpoint error: ${response.status} ${response.statusText} - visitor tracking failed`
            );
            return;
          }
        } catch (error) {
          // Log specific error types for debugging
          if (error instanceof TypeError) {
            if (
              error.message.includes("fetch failed") ||
              error.message.includes("network")
            ) {
              console.error(
                "[Jillen.Analytics] Network connectivity error in visitor tracking:",
                error.message
              );
            } else {
              console.error(
                "[Jillen.Analytics] Request configuration error in visitor tracking:",
                error.message
              );
            }
          } else if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            console.error(
              "[Jillen.Analytics] Visitor tracking request timeout after 10 seconds"
            );
          } else if (error instanceof Error) {
            console.error(
              "[Jillen.Analytics] Visitor tracking error:",
              error.name,
              error.message
            );
          } else {
            console.error(
              "[Jillen.Analytics] Unknown error in visitor tracking:",
              error
            );
          }
          // Silent error handling - don't block the page
        }
      })();
    },
    [
      ip,
      country,
      city,
      region,
      continent,
      latitude,
      longitude,
      timezone,
      postalCode,
      host,
      protocol,
      deploymentUrl,
      route,
      userAgent,
      edgeRegion,
      username,
      getClientData,
      generateSessionId,
    ]
  );

  // Heartbeat management functions
  const scheduleNextHeartbeat = useCallback(() => {
    if (!heartbeatEnabledRef.current || typeof window === "undefined") return;

    // Clear existing timeout
    if (heartbeatIntervalRef.current) {
      clearTimeout(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setTimeout(() => {
      // Check if user has been inactive for more than current interval
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const inactivityThreshold = 2 * 60 * 1000; // 2 minutes

      if (timeSinceActivity > inactivityThreshold) {
        // User is inactive, pause heartbeats
        isActiveRef.current = false;
        return;
      }

      // Send heartbeat
      if (isActiveRef.current && !document.hidden) {
        sendAnalyticsEvent("heartbeat", undefined, pathname || route);
      }

      // Progressive backoff: increase interval if no recent activity, extended to 30 minutes
      const intervals = [
        15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000,
      ]; // 15s, 30s, 1m, 2m, 5m, 10m, 15m, 30m
      const currentIndex = intervals.indexOf(currentIntervalRef.current);

      // Check session age to implement graceful termination
      const sessionTimestamp =
        typeof window !== "undefined"
          ? AnalyticsSessionStorage.getItem<number>("session_timestamp")
          : null;
      const sessionAge = sessionTimestamp ? Date.now() - sessionTimestamp : 0;
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

      // If session is near expiry (28+ minutes), slow down heartbeats significantly
      if (sessionAge > SESSION_TIMEOUT - 2 * 60 * 1000) {
        // Last 2 minutes of session
        currentIntervalRef.current = 1800000; // 30 minutes
      } else if (
        timeSinceActivity > currentIntervalRef.current &&
        currentIndex < intervals.length - 1
      ) {
        currentIntervalRef.current = intervals[currentIndex + 1];
      }

      // Gracefully terminate heartbeats after 30 minutes
      if (sessionAge >= SESSION_TIMEOUT) {
        heartbeatEnabledRef.current = false;
        return;
      }

      // Schedule next heartbeat
      scheduleNextHeartbeat();
    }, currentIntervalRef.current);
  }, [pathname, route, sendAnalyticsEvent]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    isActiveRef.current = true;

    // Check if session has expired and restart if needed
    const sessionTimestamp =
      typeof window !== "undefined"
        ? AnalyticsSessionStorage.getItem<number>("session_timestamp")
        : null;
    const sessionAge = sessionTimestamp ? now - sessionTimestamp : 0;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (sessionAge > SESSION_TIMEOUT) {
      // Session expired, generate new session and send session_start
      generateSessionId();
      sendAnalyticsEvent("session_start", undefined, pathname || route);

      // Re-enable heartbeats for new session
      heartbeatEnabledRef.current = true;
    }

    // Reset to fastest interval on activity
    currentIntervalRef.current = 15000;

    // Restart heartbeat cycle if user became active
    if (heartbeatEnabledRef.current) {
      scheduleNextHeartbeat();
    }
  }, [
    scheduleNextHeartbeat,
    generateSessionId,
    sendAnalyticsEvent,
    pathname,
    route,
  ]);

  const throttleRef = useRef<{
    timeoutId?: NodeJS.Timeout;
    lastExecTime: number;
  }>({ lastExecTime: 0 });

  const throttledHandleActivity = useCallback(() => {
    const delay = 250;
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

  const handleVisibilityChange = useCallback(() => {
    if (typeof document === "undefined") return;

    if (document.hidden) {
      // Pause heartbeats when tab is hidden
      heartbeatEnabledRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current);
      }
    } else {
      // Resume heartbeats when tab becomes visible
      heartbeatEnabledRef.current = true;
      isActiveRef.current = true;
      lastActivityRef.current = Date.now();
      scheduleNextHeartbeat();
    }
  }, [scheduleNextHeartbeat]);

  // Track session start, pageview and setup session end
  useEffect(() => {
    // SSR Guard: Only run on client
    if (typeof window === "undefined") return;

    // Only track in production environment
    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
      return;
    }

    // Check if this is a bot - if so, skip all client-side tracking
    if (checkIfBot()) {
      return;
    }

    const currentPath = pathname || route;

    // Initial setup on first load
    if (!isInitialized.current) {
      isInitialized.current = true;

      const sessionId = generateSessionId();
      const isSessionActive = AnalyticsStorage.isSessionActive(sessionId);

      // Send session_start if this is a new session
      if (!isSessionActive) {
        sendAnalyticsEvent("session_start", undefined, currentPath);
        AnalyticsStorage.setSessionActive(sessionId);
      }

      // Track initial pageview
      const referrer =
        document.referrer && document.referrer.length > 0
          ? document.referrer
          : undefined;
      sendAnalyticsEvent("pageview", referrer, currentPath);
      lastTrackedPath.current = currentPath;

      // Set up heartbeat system and activity tracking
      if (typeof window !== "undefined") {
        // Add activity event listeners
        const events = [
          "mousemove",
          "mousedown",
          "click",
          "keydown",
          "keyup",
          "scroll",
          "touchstart",
          "touchmove",
        ];
        events.forEach((event) => {
          window.addEventListener(event, throttledHandleActivity, {
            passive: true,
          });
        });

        // Add visibility change listener
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Start heartbeat system
        lastActivityRef.current = Date.now();
        scheduleNextHeartbeat();

        // Cleanup function
        return () => {
          // Remove event listeners
          events.forEach((event) => {
            window.removeEventListener(event, throttledHandleActivity);
          });
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );

          // Clear heartbeat timer
          if (heartbeatIntervalRef.current) {
            clearTimeout(heartbeatIntervalRef.current);
          }
        };
      }
    }
    // Handle route changes (client-side navigation)
    else if (currentPath !== lastTrackedPath.current) {
      // Track pageview for route change
      sendAnalyticsEvent("pageview", undefined, currentPath);
      lastTrackedPath.current = currentPath;
    }

    // Explicit return for when no action is needed
    return;
  }, [
    pathname,
    route,
    ip,
    country,
    city,
    region,
    continent,
    latitude,
    longitude,
    timezone,
    postalCode,
    host,
    protocol,
    deploymentUrl,
    userAgent,
    edgeRegion,
    username,
    sendAnalyticsEvent,
    getClientData,
    checkIfBot,
    generateSessionId,
    scheduleNextHeartbeat,
    throttledHandleActivity,
    handleVisibilityChange,
  ]); // Re-run if pathname or route changes

  return null; // This component renders nothing
}
