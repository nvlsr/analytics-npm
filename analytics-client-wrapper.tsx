"use client";

import dynamic from "next/dynamic";

// Dynamic import with ssr: false can only be used in client components
const AnalyticsProvider = dynamic(
  () =>
    import("./analytics-provider").then((mod) => ({
      default: mod.AnalyticsProvider,
    })),
  {
    ssr: false, // Prevent server-side rendering to avoid React bundling issues
    loading: () => null, // No loading spinner needed for analytics
  }
);

interface AnalyticsClientWrapperProps {
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
  cacheStatus?: "HIT" | "MISS" | "BYPASS" | "STALE" | null;
}

/**
 * Client wrapper component that handles dynamic import of analytics
 * This component creates the client boundary needed for ssr: false
 */
export function AnalyticsClientWrapper(props: AnalyticsClientWrapperProps) {
  return <AnalyticsProvider {...props} />;
}
