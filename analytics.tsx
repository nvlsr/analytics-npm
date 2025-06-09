import { AnalyticsClientWrapper } from "./analytics-client-wrapper";
import { parseAnalyticsHeaders } from "./server/header-parser";

interface AnalyticsWrapperProps {
  headers: Headers;
  route: string;
}

/**
 * Server component wrapper that extracts analytics data from headers
 * and passes clean props to the client Analytics component
 */
export async function JillenAnalytics({
  headers,
  route,
}: AnalyticsWrapperProps) {
  // Extract all required analytics data from headers
  const analyticsData = parseAnalyticsHeaders(headers);

  return <AnalyticsClientWrapper {...analyticsData} route={route} />;
}
