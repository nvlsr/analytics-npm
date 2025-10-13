// Event-related types
// Domain: Analytics event data structures that align with database schema
// This is the single source of truth for event type definitions

/**
 * Event type constants - matches database constraints
 */
export const EVENT_TYPES = {
  PAGEVIEW: 'pageview',
  SESSION_START: 'session_start',
  HEARTBEAT: 'heartbeat'
} as const;

export const BOT_CATEGORIES = {
  SEO: 'SEO',
  SOCIAL: 'SOCIAL',
  AI: 'AI',
  UNKNOWN: 'UNKNOWN'
} as const;

export const PERFORMANCE_GRADES = {
  GOOD: 'good',
  NEEDS_WORK: 'needs work',
  POOR: 'poor'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
export type BotCategory = typeof BOT_CATEGORIES[keyof typeof BOT_CATEGORIES];
export type PerformanceGrade = typeof PERFORMANCE_GRADES[keyof typeof PERFORMANCE_GRADES];

/**
 * Base event fields common to all human events
 * Field names match database schema (snake_case for consistency)
 */
export interface BaseHumanEvent {
  website_domain: string;
  path: string;
  visitor_id: string;
  session_id: string;
  event_type: EventType;
  is_new_visitor: boolean;
  session_start_time: string; // ISO datetime
  
  // Optional fields
  visitor_name?: string;
  referrer?: string;
  sdk_version?: string;
  
  // Client context fields
  screen_resolution: string | null; // Format: "1920x1080"
  viewport_size: string | null;     // Format: "1920x1080"  
  connection_type: string | null;
  client_time_zone: string | null;
}

/**
 * Server-enriched fields added by edge workers
 * These are added to human events during processing
 */
export interface ServerEnrichedFields {
  // Network & location
  ip_address: string;
  user_agent: string;
  country: string | null;
  city: string | null;
  region: string | null;
  continent: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  postal_code: string | null;
  edge_region: string | null;
  
  // Processing metadata
  timestamp: string; // ISO datetime
  language: string | null;
  do_not_track: boolean;
  is_mobile: boolean;
  
  // Parsed user agent data
  browser: string | null;
  os: string | null;
  device_type: string | null;
}

/**
 * Complete human event with server enrichment
 * This matches the structure written to the database
 */
export interface CompleteHumanEvent extends BaseHumanEvent, ServerEnrichedFields {
  // Union of both interfaces
}

/**
 * Bot event structure
 * Simplified structure for bot traffic
 */
export interface BotEvent {
  website_domain: string;
  user_agent: string;
  bot_name: string;
  bot_category: BotCategory;
  timestamp: string; // ISO datetime
  sdk_version?: string;
}

/**
 * Performance event structure
 * Detailed performance metrics from client
 */
export interface PerformanceEvent {
  website_domain: string;
  visitor_id: string;
  page: string;
  timestamp: string; // ISO datetime
  sdk_version?: string;
  
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift (score)
  inp?: number; // Interaction to Next Paint (ms)
  
  // Navigation timing
  dns_lookup?: number;
  tcp_connect?: number;
  ttfb?: number; // Time to First Byte (ms)
  html_response?: number;
  frontend_render?: number;
  total_page_load?: number;
  
  // Resource loading
  num_requests: number;
  total_size_kb: number;
  performance_grade: PerformanceGrade;
  
  // Async resource timeline
  async_timeline_start?: number;
  async_timeline_end?: number;
  async_timeline_window?: number;
  
  // API analysis
  async_api_end?: number;
  async_api_count?: number;
  async_api_parallelism?: number;
  async_api_domains?: Record<string, { count: number; totalDuration: number }>;
  async_api_slowest_endpoints?: Array<{ url: string; duration: number; count: number }>;
  async_api_slowest?: { url: string; duration: number; domain: string };
  
  // Asset analysis
  async_asset_duration?: number;
  async_asset_count?: number;
  async_asset_by_type?: Record<string, { count: number; totalDuration: number }>;
  async_asset_slowest?: Array<{ name: string; initiator_type: string; duration: number }>;
  
  // Top resources breakdown
  top_resources: Array<{
    name: string;
    initiator_type: string;
    duration: number;
    duplicate_count?: number;
    initial_hits?: number;
    dynamic_hits?: number;
    transfer_size?: number;
    decoded_body_size?: number;
    domain?: string;
    time_since_load?: number;
    is_async?: boolean;
  }>;
}

/**
 * Union type for all event types
 */
export type AnalyticsEvent = CompleteHumanEvent | BotEvent | PerformanceEvent;

/**
 * Type guards for runtime type checking
 */
export function isBotEvent(event: unknown): event is BotEvent {
  return typeof event === 'object' && event !== null && 'bot_name' in event;
}

export function isHumanEvent(event: unknown): event is BaseHumanEvent {
  return typeof event === 'object' && event !== null && 
    'event_type' in event && 'session_id' in event;
}

export function isPerformanceEvent(event: unknown): event is PerformanceEvent {
  return typeof event === 'object' && event !== null && 'performance_grade' in event;
}

export function isValidEventType(type: string): type is EventType {
  return Object.values(EVENT_TYPES).includes(type as EventType);
}

export function isValidBotCategory(category: string): category is BotCategory {
  return Object.values(BOT_CATEGORIES).includes(category as BotCategory);
}