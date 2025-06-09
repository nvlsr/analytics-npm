"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import {
  ANALYTICS_CONFIG,
  validateAnalyticsConfig,
} from "./analytics-constants";

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
  cacheStatus?: "HIT" | "MISS" | "BYPASS" | "STALE" | null;
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
  cacheStatus,
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

  // Generate consistent visitor and session IDs
  const generateVisitorId = (ip: string, userAgent: string): string => {
    const normalizedUA = userAgent.toLowerCase().replace(/\s+/g, "");
    const combined = `${ip}:${normalizedUA}`;
    return btoa(combined)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 16);
  };

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

    // Check if this is a new visitor
    const visitorId = generateVisitorId(ip, userAgent);
    const isReturning = localStorage.getItem(`analytics_visitor_${visitorId}`);
    const isNewVisitor = !isReturning;

    // Mark as returning visitor for future visits
    if (isNewVisitor) {
      localStorage.setItem(
        `analytics_visitor_${visitorId}`,
        Date.now().toString()
      );
    }

    // Get session start time (persistent for this session)
    const sessionId = generateSessionId();
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
  }, [ip, userAgent]);

  // Send event to analytics system
  const sendAnalyticsEvent = useCallback(
    async (
      eventType: "pageview" | "session_start" | "session_end",
      referrer?: string,
      customPath?: string
    ) => {
      // Only run in production (temporarily disabled for debugging)
      if (process.env.NODE_ENV !== "production" && false) {
        return;
      }

      // Validate configuration
      if (!validateAnalyticsConfig()) {
        return;
      }

      const serverUrl = ANALYTICS_CONFIG.SERVER_URL;
      const siteId = ANALYTICS_CONFIG.SITE_ID;

      const endpoint = `${serverUrl}/api/log/ingest`;

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

      // Simulate development data when running locally
      const isDev = process.env.NODE_ENV === "development";
      const devCountry = isDev && !country ? "US" : country;
      const devCity = isDev && !city ? "San Francisco" : city;
      const devRegion = isDev && !region ? "CA" : region;
      const devEdgeRegion = isDev && !edgeRegion ? "sfo1" : edgeRegion;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          mode: "cors",
          body: JSON.stringify({
            siteId,
            path: customPath || route,
            visitorId: generateVisitorId(ip, userAgent),
            sessionId: generateSessionId(),
            eventType,
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
            cacheStatus: cacheStatus || "UNKNOWN",
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("[Analytics] Failed to track event:", error);
        }
      } catch (error) {
        // Silent error handling - don't block the page
        console.error("[Analytics] Tracking failed:", error);
      }
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
      cacheStatus,
      getClientData,
    ]
  );

  // Track session start, pageview and setup session end
  useEffect(() => {
    // SSR Guard: Only run on client
    if (typeof window === "undefined") return;

    // Only track in production environment
    const isProduction =
      process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
      (process.env.NODE_ENV === "production" &&
        !process.env.NEXT_PUBLIC_VERCEL_ENV);

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

      // Setup session_end on page unload
      const handleBeforeUnload = () => {
        // Use sendBeacon for reliable delivery during page unload
        const serverUrl = ANALYTICS_CONFIG.SERVER_URL;
        const siteId = ANALYTICS_CONFIG.SITE_ID;

        if (serverUrl && siteId) {
          const clientData = getClientData();
          const eventData = {
            siteId,
            path: currentPath,
            visitorId: generateVisitorId(ip, userAgent),
            sessionId: generateSessionId(),
            eventType: "session_end",
            isNewVisitor: clientData.isNewVisitor,
            screenResolution: clientData.screenResolution,
            viewportSize: clientData.viewportSize,
            connectionType: clientData.connectionType,
            clientTimeZone: clientData.clientTimeZone,
            sessionStartTime: clientData.sessionStartTime,
            ipAddress: ip,
            userAgent,
          };

          // Use sendBeacon if available, otherwise skip (already on client due to window check)
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            navigator.sendBeacon(
              `${serverUrl}/api/log/ingest`,
              JSON.stringify({
                headers: {
                  "Content-Type": "application/json",
                },
                ...eventData,
              })
            );
          }

          // Clear session storage
          const sessionId = generateSessionId();
          const sessionKey = `analytics_session_active_${sessionId}`;
          localStorage.removeItem(sessionKey);
        }
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      // Cleanup on unmount
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }

    // Handle route changes (client-side navigation)
    if (currentPath !== lastTrackedPath.current) {
      // Track pageview for route change
      sendAnalyticsEvent("pageview", undefined, currentPath);
      lastTrackedPath.current = currentPath;
    }

    // Return undefined for useEffect when no cleanup is needed
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
    cacheStatus,
    sendAnalyticsEvent,
    getClientData,
    checkIfBot,
  ]); // Re-run if pathname or route changes

  return null; // This component renders nothing
}
