"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import { getSiteIdWithFallback } from "./analytics-host-utils";
import { AnalyticsStorage, AnalyticsSessionStorage } from "./storage-utils";

interface SessionData {
  session_id: string;
  last_activity: number; // Last user activity (updated on user actions only)
}

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

  const generateSessionId = useCallback((): {
    sessionId: string;
    isNewSession: boolean;
  } => {
    // Check for existing session ID with 30-minute timeout based on last activity
    if (typeof window !== "undefined") {
      const sessionData =
        AnalyticsSessionStorage.getItem<SessionData>("session_data");

      if (sessionData?.session_id) {
        const now = Date.now();
        const timeSinceActivity = now - sessionData.last_activity;
        const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

        if (timeSinceActivity < SESSION_TIMEOUT) {
          // Session exists and valid - already started, no session_start needed
          return { sessionId: sessionData.session_id, isNewSession: false };
        }

        // Session expired, clear it
        AnalyticsSessionStorage.removeItem("session_data");
      }
    }

    // No valid session exists - create new session
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
    const now = Date.now();

    // Store new session in sessionStorage
    if (typeof window !== "undefined") {
      AnalyticsSessionStorage.setItem("session_data", {
        session_id: newSessionId,
        last_activity: now,
      });
    }

    return { sessionId: newSessionId, isNewSession: true };
  }, []);

  // Update last activity timestamp (only called on real user interactions)
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
    const { sessionId } = generateSessionId();
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
        sessionId: generateSessionId().sessionId,
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
      // Get session data once for all checks
      const sessionData =
        typeof window !== "undefined"
          ? AnalyticsSessionStorage.getItem<SessionData>("session_data")
          : null;
      const timeSinceActivity = sessionData
        ? Date.now() - sessionData.last_activity
        : 0;

      const inactivityThreshold = 2 * 60 * 1000; // 2 minutes
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

      // Hard cutoff: terminate heartbeats after 30 minutes of inactivity
      if (timeSinceActivity >= SESSION_TIMEOUT) {
        heartbeatEnabledRef.current = false;
        return;
      }

      // Check if user has been inactive for more than 2 minutes
      if (timeSinceActivity > inactivityThreshold) {
        // User is inactive, pause heartbeats
        isActiveRef.current = false;
        return;
      }

      // Send heartbeat
      if (isActiveRef.current && !document.hidden) {
        sendAnalyticsEvent("heartbeat", undefined, pathname || route);
      }

      // Progressive engagement tracking: optimized for bounce detection
      const intervals = [15000, 60000, 300000, 900000]; // 15s, 1m, 5m, 15m
      const currentIndex = intervals.indexOf(currentIntervalRef.current);

      // Progressive engagement intervals: advance to next interval based on inactivity
      if (
        timeSinceActivity > currentIntervalRef.current &&
        currentIndex < intervals.length - 1
      ) {
        currentIntervalRef.current = intervals[currentIndex + 1];
      }

      // Schedule next heartbeat
      scheduleNextHeartbeat();
    }, currentIntervalRef.current);
  }, [pathname, route, sendAnalyticsEvent]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    isActiveRef.current = true;

    // Check if session has expired BEFORE updating activity
    const sessionData =
      typeof window !== "undefined"
        ? AnalyticsSessionStorage.getItem<SessionData>("session_data")
        : null;
    const timeSinceActivity = sessionData
      ? now - sessionData.last_activity
      : Infinity;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (timeSinceActivity > SESSION_TIMEOUT) {
      // Session expired, generate new session
      const { isNewSession } = generateSessionId();

      // Send session_start only if this is genuinely a new session
      if (isNewSession) {
        sendAnalyticsEvent("session_start", undefined, pathname || route);
      }

      // Re-enable heartbeats for new session
      heartbeatEnabledRef.current = true;
    }

    // Update last activity timestamp for this user interaction
    updateLastActivity();

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
    updateLastActivity,
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

      // Check if session expired while hidden - don't reset timeout just for visibility
      const sessionData =
        typeof window !== "undefined"
          ? AnalyticsSessionStorage.getItem<SessionData>("session_data")
          : null;
      const timeSinceActivity = sessionData
        ? Date.now() - sessionData.last_activity
        : Infinity;
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

      if (timeSinceActivity > SESSION_TIMEOUT) {
        // Session expired while hidden - create new session
        const { isNewSession } = generateSessionId();

        // Send session_start only if this is genuinely a new session
        if (isNewSession) {
          sendAnalyticsEvent("session_start", undefined, pathname || route);
        }
      }

      // Don't update activity timestamp just for visibility - wait for real user action
      scheduleNextHeartbeat();
    }
  }, [
    scheduleNextHeartbeat,
    generateSessionId,
    sendAnalyticsEvent,
    pathname,
    route,
  ]);

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

      const { sessionId, isNewSession } = generateSessionId();

      // Send session_start only for genuinely new sessions
      if (isNewSession) {
        sendAnalyticsEvent("session_start", undefined, currentPath);
        AnalyticsStorage.setSessionActive(sessionId);
      }

      // Track initial pageview (counts as user activity)
      updateLastActivity();
      const referrer =
        document.referrer && document.referrer.length > 0
          ? document.referrer
          : undefined;
      sendAnalyticsEvent("pageview", referrer, currentPath);
      lastTrackedPath.current = currentPath;

      // Set up heartbeat system and activity tracking
      if (typeof window !== "undefined") {
        // Add activity event listeners (meaningful interactions only)
        const events = ["click", "keydown", "touchstart"];
        events.forEach((event) => {
          window.addEventListener(event, throttledHandleActivity, {
            passive: true,
          });
        });

        // Add visibility change listener
        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Start heartbeat system
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
      // Track pageview for route change (counts as user activity)
      updateLastActivity();
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
    updateLastActivity,
    scheduleNextHeartbeat,
    throttledHandleActivity,
    handleVisibilityChange,
  ]); // Re-run if pathname or route changes

  return null; // This component renders nothing
}
