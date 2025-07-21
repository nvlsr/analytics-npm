"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import { getSiteIdWithFallback } from "./analytics-host-utils";

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
}: VisitorTrackerProps) {
  const pathname = usePathname();
  const isInitialized = useRef<boolean>(false);
  const lastTrackedPath = useRef<string>(route);

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

  const generateSessionId = (): string => {
    // Check for existing session ID in sessionStorage
    if (typeof window !== "undefined") {
      const existingSessionId = sessionStorage.getItem("analytics_session_id");
      if (existingSessionId) {
        return existingSessionId;
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

    // Store in sessionStorage (persists across page loads, expires with browser session)
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("analytics_session_id", newSessionId);
      } catch {
        // Continue without storage if sessionStorage is disabled
      }
    }

    return newSessionId;
  };

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
    const cachedIsNewVisitor = sessionStorage.getItem(sessionCacheKey);
    let isNewVisitor: boolean;

    if (cachedIsNewVisitor === null) {
      // First event in this session - make the determination
      const visitorExists = localStorage.getItem(
        `analytics_visitor_${visitorId}`
      );
      isNewVisitor = !visitorExists;

      // Cache the decision for this entire session
      sessionStorage.setItem(sessionCacheKey, isNewVisitor.toString());

      // Mark visitor as seen for future sessions (only if they're new)
      if (isNewVisitor) {
        localStorage.setItem(
          `analytics_visitor_${visitorId}`,
          Date.now().toString()
        );
      }
    } else {
      // Use the cached decision from earlier in this session
      isNewVisitor = cachedIsNewVisitor === "true";
    }

    // Get session start time (persistent for this session)
    // Note: reusing sessionId from above
    let sessionStartTime = localStorage.getItem(
      `analytics_session_start_${sessionId}`
    );
    if (!sessionStartTime) {
      sessionStartTime = new Date().toISOString();
      localStorage.setItem(
        `analytics_session_start_${sessionId}`,
        sessionStartTime
      );
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
  }, [ip]);

  // Send event to analytics system
  const sendAnalyticsEvent = useCallback(
    async (
      eventType: "pageview" | "session_start",
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
      };

      // Send to Cloudflare worker endpoint (fire-and-forget)
      void (async () => {
        try {
          const response = await fetch(edgeEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            mode: "cors",
            body: JSON.stringify(eventPayload),
          });

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
            console.error(
              "[Jillen.Analytics] Configuration error in visitor tracking:",
              error.message
            );
          } else if (error instanceof Error) {
            console.error(
              "[Jillen.Analytics] Network error in visitor tracking:",
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
      getClientData,
    ]
  );

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
      const sessionKey = `analytics_session_active_${sessionId}`;
      const isSessionActive = localStorage.getItem(sessionKey);

      // Send session_start if this is a new session
      if (!isSessionActive) {
        sendAnalyticsEvent("session_start", undefined, currentPath);
        localStorage.setItem(sessionKey, "true");
      }

      // Track initial pageview
      const referrer =
        document.referrer && document.referrer.length > 0
          ? document.referrer
          : undefined;
      sendAnalyticsEvent("pageview", referrer, currentPath);
      lastTrackedPath.current = currentPath;

      // No cleanup needed - sessions end naturally through timeout logic
    }
    // Handle route changes (client-side navigation)
    else if (currentPath !== lastTrackedPath.current) {
      // Track pageview for route change
      sendAnalyticsEvent("pageview", undefined, currentPath);
      lastTrackedPath.current = currentPath;
    }
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
    sendAnalyticsEvent,
    getClientData,
    checkIfBot,
  ]); // Re-run if pathname or route changes

  return null; // This component renders nothing
}
