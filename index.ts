// Main package exports - Client Components
export { AnalyticsProvider } from './analytics-provider';

// Utility exports for header parsing and configuration
export { parseAnalyticsHeaders } from './server/header-parser';
export { setupAnalyticsMiddleware } from './server/middleware-utils';
export { ANALYTICS_CONFIG, validateAnalyticsConfig } from './analytics-constants';

// Re-export specialized modules
export * as client from './client';
export * as server from './server'; 