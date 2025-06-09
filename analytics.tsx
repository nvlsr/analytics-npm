"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { VisitorTrackerProps } from "./analytics-provider";
import type { ParsedAnalyticsHeaders } from "./server/header-parser";

// Dynamically import the AnalyticsProvider to prevent SSR issues
const AnalyticsProvider = dynamic(
  () =>
    import("./analytics-provider").then((mod) => ({
      default: mod.AnalyticsProvider,
    })),
  { ssr: false }
);

export interface AnalyticsProps {
  analyticsData: ParsedAnalyticsHeaders;
  route: string;
}

export function Analytics({ analyticsData, route }: AnalyticsProps) {
  // Combine analytics data with route for the provider
  const providerProps: VisitorTrackerProps = {
    ...analyticsData,
    route,
  };

  return <AnalyticsProvider {...providerProps} />;
}
