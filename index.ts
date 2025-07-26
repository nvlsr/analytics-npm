// Main package exports - Internal Tracker for User Wrappers
export { VisitorTracker, type VisitorTrackerProps } from './visitor-tracker';

// Utility exports for header parsing and configuration
export { parseAnalyticsHeaders } from './server/header-parser';
export { setupAnalyticsMiddleware } from './server/middleware-utils';

// Re-export specialized modules
export * as client from './client';
export * as server from './server';

export { trackBotVisit } from './analytics-bot-utils';
export { extractHostnameFromEnv, getSiteIdWithFallback } from './analytics-host-utils';
export { AnalyticsStorage, AnalyticsSessionStorage } from './storage-utils';
export { type ParsedAnalyticsHeaders } from './server/header-parser'; 