export interface BaseEventData {
  website_domain: string;
  path: string;
  visitor_id: string;
  session_id: string;
  event_type: 'pageview' | 'session_start' | 'heartbeat';
  sdkVersion?: string;
}

export interface ServerEnrichedFields {
  ipAddress: string;
  userAgent: string;
  country: string | null;
  city: string | null;
  region: string | null;
  continent: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  postalCode: string | null;
  edgeRegion: string | null;
  timestamp: string;
  language: string | null;
  doNotTrack: boolean;
  isMobile: boolean;
}

export interface BotEventData {
  website_domain: string;
  userAgent: string;
  bot_name: string;
  bot_category: 'SEO' | 'SOCIAL' | 'AI' | 'UNKNOWN';
  timestamp: string;
  sdkVersion?: string;
}

export interface PerformanceEventData {
  website_domain: string;
  visitor_id: string;
  page: string;
  sdkVersion?: string;
  dns_lookup?: number;
  tcp_connect?: number;
  ttfb: number;
  html_response: number;
  frontend_render: number;
  total_page_load: number;
  
  // Timeline positioning (relative to page load completion)
  async_timeline_start?: number;
  async_timeline_end?: number;
  async_timeline_window?: number;
  
  // API timeline and analysis
  async_api_end?: number;
  async_api_count?: number;
  async_api_parallelism?: number;
  async_api_domains?: Record<string, { count: number; totalDuration: number }>;
  async_api_slowest_endpoints?: Array<{ url: string; duration: number; count: number }>;
  async_api_slowest?: { url: string; duration: number; domain: string };
  
  // Asset analysis (non-API resources)
  async_asset_duration?: number;
  async_asset_count?: number;
  async_asset_by_type?: Record<string, { count: number; totalDuration: number }>;
  async_asset_slowest?: Array<{ name: string; initiator_type: string; duration: number }>;
  
  lcp?: number;
  cls?: number;
  inp?: number;
  num_requests: number;
  total_size_kb: number;
  performance_grade: 'good' | 'needs work' | 'poor';
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
  timestamp: string;
}


export interface HumanEventData extends BaseEventData {
  event_type: 'pageview' | 'session_start' | 'heartbeat';
  is_new_visitor: boolean;
  screen_resolution: string | null;
  viewport_size: string | null;
  connection_type: string | null;
  client_time_zone: string | null;
  session_start_time: string;
  visitor_name?: string;
  referrer?: string;
}

export interface CompleteHumanEvent extends HumanEventData, ServerEnrichedFields {}

export type ClientEventData = BotEventData | HumanEventData | PerformanceEventData;
export type CompleteEventData = BotEventData | CompleteHumanEvent | PerformanceEventData;

export function isBotEvent(event: ClientEventData): event is BotEventData {
  return 'bot_name' in event;
}

export function isHumanEvent(event: ClientEventData): event is HumanEventData {
  return 'event_type' in event;
}

export function isPerformanceEvent(event: ClientEventData): event is PerformanceEventData {
  return 'performance_grade' in event;
}

export const VALID_EVENT_TYPES = ['pageview', 'session_start', 'heartbeat'] as const;
export const VALID_BOT_EVENT_TYPES = ['pageview'] as const;

export function isValidEventType(eventType: string): eventType is 'pageview' | 'session_start' | 'heartbeat' {
  return VALID_EVENT_TYPES.includes(eventType as typeof VALID_EVENT_TYPES[number]);
}

export function isValidBotEventType(eventType: string): eventType is 'pageview' {
  return VALID_BOT_EVENT_TYPES.includes(eventType as typeof VALID_BOT_EVENT_TYPES[number]);
}
