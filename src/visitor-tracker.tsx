"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { isbot } from "isbot";
import { getSiteIdWithFallback } from "./analytics-host-utils";
import { AnalyticsStorage, AnalyticsSessionStorage } from "./storage-utils";

interface SessionData {
  session_id: string;
  last_activity: number;
}

function generateVisitorId(ip: string, username?: string | null): string {
  if (username && username.trim() !== "") {
    return (
      username
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50) || "unknown-user"
    );
  }

  const cleanIp = ip
    .replace(/[.:]/g, "-")
    .replace(/[^0-9a-f-]/gi, "")
    .toLowerCase()
    .substring(0, 50);

  return `ip-${cleanIp}` || "ip-unknown";
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

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const currentIntervalRef = useRef<number>(5000);
  const isActiveRef = useRef<boolean>(true);
  const heartbeatEnabledRef = useRef<boolean>(true);

  const checkIfBot = useCallback(() => {
    if (isbot(userAgent)) {
      return true;
    }

    if (typeof navigator !== "undefined" && isbot(navigator.userAgent)) {
      return true;
    }

    if (typeof window !== "undefined") {
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

  const getClientData = useCallback(() => {
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

    const visitorId = generateVisitorId(ip, username);
    const { sessionId } = generateSessionId();
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
    };
  }, [ip, username, generateSessionId]);

  const sendAnalyticsEvent = useCallback(
    async (
      eventType: "pageview" | "session_start" | "heartbeat",
      referrer?: string,
      customPath?: string
    ) => {
      if (process.env.NODE_ENV !== "production") {
        return;
      }

      const siteId = getSiteIdWithFallback(host || null);
      const edgeEndpoint = "https://analytics-ingestion.maaakri.workers.dev";

      const language =
        typeof navigator !== "undefined"
          ? navigator.language || navigator.languages?.[0] || undefined
          : undefined;
      const doNotTrack =
        typeof navigator !== "undefined" ? navigator.doNotTrack === "1" : false;
      const isMobile =
        typeof navigator !== "undefined"
          ? /Mobi|Android/i.test(navigator.userAgent)
          : /Mobi|Android/i.test(userAgent);

      const clientData = getClientData();

      const devCountry = country;
      const devCity = city;
      const devRegion = region;
      const devEdgeRegion = edgeRegion;

      const eventPayload = {
        siteId,
        path: customPath || route,
        visitorId: generateVisitorId(ip, username),
        sessionId: generateSessionId().sessionId,
        eventType,
        isBot: false,
        isNewVisitor: clientData.isNewVisitor,
        screenResolution: clientData.screenResolution,
        viewportSize: clientData.viewportSize,
        connectionType: clientData.connectionType,
        clientTimeZone: clientData.clientTimeZone,
        sessionStartTime: clientData.sessionStartTime,
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

      void (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

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

          if (!response.ok) {
            console.error(
              `[Jillen.Analytics] Server endpoint error: ${response.status} ${response.statusText} - visitor tracking failed`
            );
            return;
          }
        } catch (error) {
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

  const scheduleNextHeartbeat = useCallback(() => {
    if (!heartbeatEnabledRef.current || typeof window === "undefined") return;

    if (heartbeatIntervalRef.current) {
      return;
    }

    heartbeatIntervalRef.current = setTimeout(() => {
      heartbeatIntervalRef.current = undefined;

      const sessionData =
        typeof window !== "undefined"
          ? AnalyticsSessionStorage.getItem<SessionData>("session_data")
          : null;
      const timeSinceActivity = sessionData
        ? Date.now() - sessionData.last_activity
        : 0;

      const inactivityThreshold = 2 * 60 * 1000;
      const SESSION_TIMEOUT = 30 * 60 * 1000;

      if (timeSinceActivity >= SESSION_TIMEOUT) {
        heartbeatEnabledRef.current = false;
        return;
      }

      if (timeSinceActivity > inactivityThreshold) {
        isActiveRef.current = false;
        return;
      }

      if (isActiveRef.current && !document.hidden) {
        sendAnalyticsEvent("heartbeat", undefined, pathname || route);
      }

      const intervals = [5000, 10000, 20000, 60000, 300000, 900000];
      const currentIndex = intervals.indexOf(currentIntervalRef.current);

      if (
        timeSinceActivity > currentIntervalRef.current &&
        currentIndex < intervals.length - 1
      ) {
        currentIntervalRef.current = intervals[currentIndex + 1];
      }

      scheduleNextHeartbeat();
    }, currentIntervalRef.current);
  }, [pathname, route, sendAnalyticsEvent]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    isActiveRef.current = true;

    const sessionData =
      typeof window !== "undefined"
        ? AnalyticsSessionStorage.getItem<SessionData>("session_data")
        : null;
    const timeSinceActivity = sessionData
      ? now - sessionData.last_activity
      : Infinity;
    const SESSION_TIMEOUT = 30 * 60 * 1000;

    if (timeSinceActivity > SESSION_TIMEOUT) {
      const { isNewSession } = generateSessionId();

      if (isNewSession) {
        sendAnalyticsEvent("session_start", undefined, pathname || route);
        sendAnalyticsEvent("pageview", undefined, pathname || route);
      }

      // Re-enable heartbeats for new session
      heartbeatEnabledRef.current = true;
    }

    updateLastActivity();

    currentIntervalRef.current = 5000;

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
      heartbeatEnabledRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearTimeout(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }
    } else {
      heartbeatEnabledRef.current = true;
      isActiveRef.current = true;

      scheduleNextHeartbeat();
    }
  }, [scheduleNextHeartbeat]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
      return;
    }

    if (checkIfBot()) {
      return;
    }

    const currentPath = pathname || route;

    if (!isInitialized.current) {
      isInitialized.current = true;

      AnalyticsStorage.cleanupOldSessionEntries();

      const { isNewSession } = generateSessionId();

      if (isNewSession) {
        sendAnalyticsEvent("session_start", undefined, currentPath);
      }

      updateLastActivity();
      const referrer =
        document.referrer && document.referrer.length > 0
          ? document.referrer
          : undefined;
      sendAnalyticsEvent("pageview", referrer, currentPath);
      lastTrackedPath.current = currentPath;

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

        document.addEventListener("visibilitychange", handleVisibilityChange);

        scheduleNextHeartbeat();

        return () => {
          events.forEach((event) => {
            window.removeEventListener(event, throttledHandleActivity);
          });
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );

          if (heartbeatIntervalRef.current) {
            clearTimeout(heartbeatIntervalRef.current);
          }
        };
      }
    } else if (currentPath !== lastTrackedPath.current) {
      updateLastActivity();
      sendAnalyticsEvent("pageview", undefined, currentPath);
      lastTrackedPath.current = currentPath;
    }

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
  ]);

  return null;
}
