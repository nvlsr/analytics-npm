// Main package exports
export { JillenAnalytics } from './analytics';
export { setupAnalyticsMiddleware } from './server/middleware-utils';
export { parseAnalyticsHeaders } from './server/header-parser';
export { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

// Re-export specialized modules
export * as client from './client';
export * as server from './server'; 