// Main package exports - Public API
export { VisitorTracker, type VisitorTrackerProps } from './visitor-tracker';

// Server-side utilities for user integration
export { parseAnalyticsHeaders } from './header-parser';
export { setupAnalyticsMiddleware } from './middleware-utils';

// TypeScript types for user implementation
export { type ParsedAnalyticsHeaders } from './header-parser'; 