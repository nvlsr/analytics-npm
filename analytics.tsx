"use client";

import React from "react";
import {
  AnalyticsProvider,
  type VisitorTrackerProps,
} from "./analytics-provider";
import type { ParsedAnalyticsHeaders } from "./server/header-parser";

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
