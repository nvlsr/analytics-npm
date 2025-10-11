// Main package exports - Public API
export { VisitorTracker } from './visitor-tracker';
export type { VisitorTrackerProps } from './visitor-tracker';

// Server-side utilities for user integration
export { setupAnalyticsMiddleware } from './middleware-utils';

// Event types for user implementation
export type { 
  BaseEventData, 
  HumanEventData, 
  PerformanceEventData, 
  BotEventData,
  ServerEnrichedFields 
} from './events'; 