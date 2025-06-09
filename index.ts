// Main package exports - Client Components
export { AnalyticsProvider } from './analytics-provider';
export type { VisitorTrackerProps } from './analytics-provider';

// Utility exports for header parsing and configuration
export { parseAnalyticsHeaders } from './server/header-parser';
export { setupAnalyticsMiddleware } from './server/middleware-utils';
export { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

// Re-export specialized modules
export * as client from './client';
export * as server from './server';

export { trackBotVisit } from './analytics-bot-utils';
export { type ParsedAnalyticsHeaders } from './server/header-parser';

// Utility type for client analytics props
import type { ParsedAnalyticsHeaders } from './server/header-parser';
export interface ClientAnalyticsProps {
  analyticsData: ParsedAnalyticsHeaders & { route: string };
  route: string;
} 