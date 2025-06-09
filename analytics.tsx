import dynamic from "next/dynamic";
import { parseAnalyticsHeaders } from "./server/header-parser";

// Dynamically import the client component with SSR disabled
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

  return <AnalyticsProvider {...analyticsData} route={route} />;
}
