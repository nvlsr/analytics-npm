// Main package exports - Pre-made Client Component
export { Analytics, type AnalyticsProps } from './analytics';

// Utility exports for header parsing and configuration
export { parseAnalyticsHeaders } from './server/header-parser';
export { setupAnalyticsMiddleware } from './server/middleware-utils';
export { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

// Re-export specialized modules
export * as client from './client';
export * as server from './server';

export { trackBotVisit } from './analytics-bot-utils';
export { type ParsedAnalyticsHeaders } from './server/header-parser';
export { type VisitorTrackerProps } from './analytics-provider'; 