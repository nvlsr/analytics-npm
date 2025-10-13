import { onLCP, onCLS, onINP, Metric } from 'web-vitals';
import { classifyResourcePhase as centralClassifyResourcePhase } from './resource-classification';

export interface FlattenedPageMetrics {
  page: string;
  dns_lookup?: number;
  tcp_connect?: number;
  ttfb?: number;
  html_response?: number;
  frontend_render?: number;
  total_page_load?: number;
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
  timestamp: string;
}

const globalWebVitals: { lcp?: number; cls?: number; inp?: number } = {};
let webVitalsInitialized = false;

function roundCLS(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sendMetricsToAnalytics(metric: Metric) {
  if (metric.name === 'LCP') globalWebVitals.lcp = Math.round(metric.value);
  if (metric.name === 'CLS') globalWebVitals.cls = roundCLS(metric.value);
  if (metric.name === 'INP') globalWebVitals.inp = Math.round(metric.value);
}

function initializeWebVitals() {
  if (webVitalsInitialized || typeof window === 'undefined') return;
  webVitalsInitialized = true;

  onLCP(sendMetricsToAnalytics, { reportAllChanges: true });
  onCLS(sendMetricsToAnalytics, { reportAllChanges: true });
  onINP(sendMetricsToAnalytics, { reportAllChanges: true });
}

if (typeof window !== 'undefined') {
  initializeWebVitals();
}

function calculatePerformanceGrade(m: {
  total_page_load?: number;
  lcp?: number;
  cls?: number;
  inp?: number;
}): 'good' | 'needs work' | 'poor' {
  let score = 0;
  let maxScore = 3;

  if (m.total_page_load !== undefined && m.total_page_load <= 2500) score++;
  if (m.lcp !== undefined && m.lcp <= 2500) score++;
  if (m.cls !== undefined && m.cls <= 0.1) score++;

  if (m.inp !== undefined) {
    maxScore++;
    if (m.inp <= 200) score++;
  }

  if (score / maxScore >= 0.75) return 'good';
  if (score / maxScore >= 0.5) return 'needs work';
  return 'poor';
}

function calculateAsyncWindow(resources: PerformanceResourceTiming[], loadEventEnd: number) {
  if (resources.length === 0) {
    return { start: undefined, end: undefined, duration: undefined, window: undefined };
  }
  
  const start = Math.round(resources[0].startTime - loadEventEnd);
  const end = Math.round(Math.max(...resources.map(r => r.responseEnd)) - loadEventEnd);
  const window = end - start;
  
  return { start, end, duration: end, window };
}

function getWebVitalsFromPerformanceAPI() {
  const perf = window.performance;
  const result: { lcp?: number; cls?: number; inp?: number } = {};

  const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0)
    result.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);

  let clsValue = 0;
  const layoutShiftEntries = perf.getEntriesByType('layout-shift') as PerformanceEntry[];
  layoutShiftEntries.forEach((entry) => {
    const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
    if (!layoutEntry.hadRecentInput && layoutEntry.value)
      clsValue += layoutEntry.value;
  });
  if (clsValue > 0) result.cls = roundCLS(clsValue);

  if (globalWebVitals.inp) result.inp = globalWebVitals.inp;
  return result;
}

interface EnhancedResourceData {
  name: string;
  initiator_type: string;
  total_duration: number;
  initial_requests: number;
  dynamic_requests: number;
  transfer_size: number;
  decoded_body_size: number;
  domain: string;
  first_start_time: number;
  last_start_time: number;
  time_since_load: number;
  primary_phase: 'initial' | 'dynamic';
  spans_both_phases: boolean;
}

function classifyResourcePhase(resource: EnhancedResourceData): 'initial' | 'dynamic' {
  const totalRequests = resource.initial_requests + resource.dynamic_requests;
  
  // Use centralized classification logic
  const phase = centralClassifyResourcePhase({
    initiator_type: resource.initiator_type,
    name: resource.name,
    duplicate_count: totalRequests > 1 ? totalRequests : undefined,
    initial_requests: resource.initial_requests,
    dynamic_requests: resource.dynamic_requests
  });
  
  return phase;
}

function selectRepresentativeResources(resourceMap: Record<string, EnhancedResourceData>): Array<{
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
}> {
  const allResources = Object.values(resourceMap);
  
  // Classify each resource's primary phase
  for (const resource of allResources) {
    resource.primary_phase = classifyResourcePhase(resource);
    resource.spans_both_phases = resource.initial_requests > 0 && resource.dynamic_requests > 0;
  }
  
  // Group by initiator type and phase
  type ResourceData = EnhancedResourceData;
  const byTypeAndPhase: Record<string, { initial: ResourceData[], dynamic: ResourceData[] }> = {};
  
  for (const resource of allResources) {
    const type = resource.initiator_type;
    if (!byTypeAndPhase[type]) {
      byTypeAndPhase[type] = { initial: [], dynamic: [] };
    }
    
    if (resource.primary_phase === 'dynamic') {
      byTypeAndPhase[type].dynamic.push(resource);
    } else {
      byTypeAndPhase[type].initial.push(resource);
    }
  }
  
  // Sort each group by duration (slowest first)
  for (const type in byTypeAndPhase) {
    byTypeAndPhase[type].initial.sort((a, b) => b.total_duration - a.total_duration);
    byTypeAndPhase[type].dynamic.sort((a, b) => b.total_duration - a.total_duration);
  }
  
  const selected: ResourceData[] = [];
  
  // Define resource type importance and sampling limits
  const resourceTypeConfig: Record<string, { initial: number, dynamic: number }> = {
    // Usual suspects - often slow, capture more
    'fetch': { initial: 2, dynamic: 5 },           // API calls
    'xmlhttprequest': { initial: 2, dynamic: 5 },  // API calls
    'script': { initial: 3, dynamic: 3 },          // JavaScript
    'img': { initial: 2, dynamic: 2 },             // Images
    
    // Critical but often fast - ensure representation
    'stylesheet': { initial: 2, dynamic: 1 },      // CSS files
    'link': { initial: 2, dynamic: 1 },            // Fonts, preloads
    'font': { initial: 2, dynamic: 1 },            // Web fonts
    
    // Less common but important to track
    'navigation': { initial: 1, dynamic: 0 },      // Main document
    'other': { initial: 1, dynamic: 1 },           // Miscellaneous
  };
  
  // Sample resources according to strategy
  for (const [type, limits] of Object.entries(resourceTypeConfig)) {
    const groups = byTypeAndPhase[type];
    if (!groups) continue;
    
    // Take initial rendering resources
    if (groups.initial.length > 0) {
      const count = Math.min(limits.initial, groups.initial.length);
      selected.push(...groups.initial.slice(0, count));
    }
    
    // Take dynamic resources
    if (groups.dynamic.length > 0) {
      const count = Math.min(limits.dynamic, groups.dynamic.length);
      selected.push(...groups.dynamic.slice(0, count));
    }
  }
  
  // Handle any unknown resource types (capture at least 1)
  for (const [type, groups] of Object.entries(byTypeAndPhase)) {
    if (!resourceTypeConfig[type]) {
      // Unknown type - take 1 from each phase if available
      if (groups.initial.length > 0) selected.push(groups.initial[0]);
      if (groups.dynamic.length > 0) selected.push(groups.dynamic[0]);
    }
  }
  
  // Ensure we include zero-duration resources if we haven't hit type diversity targets
  // This handles heavily cached pages where CSS/fonts have 0ms duration
  if (selected.length < 15) { // If we don't have enough diversity
    const missingTypes = ['stylesheet', 'navigation', 'img', 'font'];
    
    for (const missingType of missingTypes) {
      const hasType = selected.some(r => r.initiator_type === missingType);
      if (!hasType && byTypeAndPhase[missingType]) {
        // Add the fastest (possibly 0ms) resource of this missing type
        const initialResources = byTypeAndPhase[missingType].initial;
        const dynamicResources = byTypeAndPhase[missingType].dynamic;
        
        if (initialResources.length > 0) {
          selected.push(initialResources[initialResources.length - 1]); // Take slowest of fast ones
        } else if (dynamicResources.length > 0) {
          selected.push(dynamicResources[dynamicResources.length - 1]);
        }
      }
    }
  }

  // Sort final selection by total duration and apply reasonable limit
  return selected
    .sort((a, b) => b.total_duration - a.total_duration)
    .slice(0, 35) // Increased from 10 to 35 for better coverage
    .map(r => {
      const totalRequests = r.initial_requests + r.dynamic_requests;
      const result: {
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
      } = {
        name: r.name,
        initiator_type: r.initiator_type,
        duration: Math.round(r.total_duration / totalRequests),
        transfer_size: Math.round(r.transfer_size / totalRequests),
        decoded_body_size: Math.round(r.decoded_body_size / totalRequests),
        domain: r.domain,
        time_since_load: r.time_since_load,
        is_async: r.primary_phase === 'dynamic'
      };
      
      // Add duplicate tracking for resources with multiple hits
      if (totalRequests > 1) {
        result.duplicate_count = totalRequests;
        result.initial_hits = r.initial_requests;
        result.dynamic_hits = r.dynamic_requests;
      }
      
      return result;
    });
}

export function collectPerfMetrics(): FlattenedPageMetrics | null {
  if (typeof window === "undefined" || !window.performance) return null;

  const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!navigation) return null;

  const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const totalSizeBytes = resources.reduce(
    (sum, r) => sum + (r.transferSize || r.encodedBodySize || r.decodedBodySize || 0), 0
  );

  const webVitals = Object.keys(globalWebVitals).length > 0
    ? globalWebVitals
    : getWebVitalsFromPerformanceAPI();

  const dnsLookup = navigation.domainLookupEnd > 0 && navigation.domainLookupStart > 0
    ? Math.round(navigation.domainLookupEnd - navigation.domainLookupStart) : undefined;
  const tcpConnect = navigation.connectEnd > 0 && navigation.connectStart > 0
    ? Math.round(navigation.connectEnd - navigation.connectStart) : undefined;
  
  // Calculate timing values, only include them if valid
  const rawTtfb = navigation.responseStart - navigation.requestStart;
  const rawHtmlResponse = navigation.responseEnd - navigation.responseStart;
  const rawTotalPageLoad = navigation.loadEventEnd - navigation.fetchStart;
  const rawFrontendRender = navigation.loadEventEnd - navigation.responseStart;
  
  // Only include timing values if they're valid (positive)
  const ttfb = rawTtfb >= 0 ? Math.round(rawTtfb) : undefined;
  const htmlResponse = rawHtmlResponse >= 0 ? Math.round(rawHtmlResponse) : undefined;
  const totalPageLoad = rawTotalPageLoad >= 0 ? Math.round(rawTotalPageLoad) : undefined;
  
  let frontendRender: number | undefined;
  if (rawFrontendRender >= 0) {
    frontendRender = Math.round(rawFrontendRender);
    // Validate frontend render against other timing values if available
    if (ttfb !== undefined && htmlResponse !== undefined && totalPageLoad !== undefined) {
      const maxFrontendRender = totalPageLoad - ttfb - htmlResponse;
      if (frontendRender > maxFrontendRender) {
        frontendRender = Math.max(0, maxFrontendRender);
      }
    }
  }
  

  const asyncResources = resources.filter(r => r.startTime > navigation.loadEventEnd);

  // Calculate async timeline using utility function
  const asyncTiming = calculateAsyncWindow(asyncResources, navigation.loadEventEnd);
  const asyncTimelineStart = asyncTiming.start;
  const asyncTimelineEnd = asyncTiming.end;
  const asyncTimelineWindow = asyncTiming.window;

  // Build enhanced resource map with separate initial/dynamic tracking
  const resourceMap: Record<string, EnhancedResourceData> = {};

  // Separate API calls from other async resources
  const asyncApiResources = asyncResources.filter(r => 
    r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest'
  );
  const asyncNonApiResources = asyncResources.filter(r => 
    r.initiatorType !== 'fetch' && r.initiatorType !== 'xmlhttprequest'
  );

  // Compute async API details
  const asyncApiDomains: Record<string, { count: number; totalDuration: number }> = {};
  const asyncApiEndpointsMap: Record<string, { duration: number; count: number }> = {};
  let asyncApiSlowest: { url: string; duration: number; domain: string } | undefined;

  for (const r of asyncApiResources) {
    const duration = Math.round(r.responseEnd - r.startTime);
    const url = r.name.split('?')[0];
    const domain = new URL(r.name).hostname;

    // Track domains
    if (!asyncApiDomains[domain]) {
      asyncApiDomains[domain] = { count: 0, totalDuration: 0 };
    }
    asyncApiDomains[domain].count += 1;
    asyncApiDomains[domain].totalDuration += duration;

    // Track endpoints
    if (!asyncApiEndpointsMap[url]) {
      asyncApiEndpointsMap[url] = { duration: 0, count: 0 };
    }
    asyncApiEndpointsMap[url].duration += duration;
    asyncApiEndpointsMap[url].count += 1;

    // Track slowest
    if (!asyncApiSlowest || duration > asyncApiSlowest.duration) {
      asyncApiSlowest = { url, duration, domain };
    }
  }

  const asyncApiCount = asyncApiResources.length;
  const apiTiming = calculateAsyncWindow(asyncApiResources, navigation.loadEventEnd);
  const asyncApiEnd = apiTiming.duration;

  // Calculate API parallelism efficiency
  let asyncApiParallelism: number | undefined;
  if (asyncApiCount > 0 && asyncApiEnd && asyncApiEnd > 0) {
    const medianApiTime = asyncApiResources.length > 0
      ? asyncApiResources
          .map(r => r.responseEnd - r.startTime)
          .sort((a, b) => a - b)[Math.floor(asyncApiResources.length / 2)]
      : 0;
    if (medianApiTime > 0) {
      asyncApiParallelism = Math.round((asyncApiCount / (asyncApiEnd / medianApiTime)) * 100) / 100;
    }
  }

  const asyncApiSlowestEndpoints = Object.entries(asyncApiEndpointsMap)
    .map(([url, data]) => ({
      url,
      duration: Math.round(data.duration / data.count),
      count: data.count
    }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  // Compute async asset details (non-API async loads)
  const asyncAssetByType: Record<string, { count: number; totalDuration: number }> = {};
  let asyncAssetDuration = 0;

  for (const r of asyncNonApiResources) {
    const duration = Math.round(r.responseEnd - r.startTime);
    const type = r.initiatorType || 'other';
    
    if (!asyncAssetByType[type]) {
      asyncAssetByType[type] = { count: 0, totalDuration: 0 };
    }
    asyncAssetByType[type].count += 1;
    asyncAssetByType[type].totalDuration += duration;
    asyncAssetDuration += duration;
  }

  const asyncAssetCount = asyncNonApiResources.length;
  const asyncAssetSlowest = asyncNonApiResources
    .sort((a, b) => (b.responseEnd - b.startTime) - (a.responseEnd - a.startTime))
    .slice(0, 5)
    .map(r => ({
      name: r.name.split('?')[0],
      initiator_type: r.initiatorType,
      duration: Math.round(r.responseEnd - r.startTime)
    }));
  
  for (const r of resources) {
    const url = r.name.split('?')[0];
    const domain = new URL(r.name).hostname;
    const duration = Math.round(r.responseEnd - r.startTime);
    const timeSinceLoad = Math.round(r.startTime - navigation.loadEventEnd);
    const key = url;
    
    // Determine if this specific request is during initial load or dynamic
    const isInitialRequest = r.startTime <= navigation.loadEventEnd + 1000; // 1s buffer for initial phase

    if (!resourceMap[key]) {
      resourceMap[key] = {
        name: url,
        initiator_type: r.initiatorType,
        total_duration: 0,
        initial_requests: 0,
        dynamic_requests: 0,
        transfer_size: 0,
        decoded_body_size: 0,
        domain,
        first_start_time: r.startTime,
        last_start_time: r.startTime,
        time_since_load: timeSinceLoad,
        primary_phase: 'initial', // Will be determined later
        spans_both_phases: false,
      };
    }

    const rec = resourceMap[key];
    
    // Track separate counters for initial vs dynamic requests
    if (isInitialRequest) {
      rec.initial_requests += 1;
    } else {
      rec.dynamic_requests += 1;
    }
    
    // Update timing information
    rec.first_start_time = Math.min(rec.first_start_time, r.startTime);
    rec.last_start_time = Math.max(rec.last_start_time, r.startTime);
    
    // Accumulate duration and size data
    rec.total_duration += duration;
    rec.transfer_size += r.transferSize || 0;
    rec.decoded_body_size += r.decodedBodySize || 0;
  }

  // Smart resource selection to ensure type diversity
  const selectedResources = selectRepresentativeResources(resourceMap);
  
  // selectedResources already contains the properly formatted data with enhanced tracking
  const topResources = selectedResources;

  return {
    page: window.location.pathname,
    dns_lookup: dnsLookup,
    tcp_connect: tcpConnect,
    ttfb,
    html_response: htmlResponse,
    frontend_render: frontendRender,
    total_page_load: totalPageLoad,
    lcp: webVitals.lcp,
    cls: webVitals.cls,
    inp: webVitals.inp,
    num_requests: resources.length,
    total_size_kb: Math.round((totalSizeBytes / 1024) * 10) / 10,
    performance_grade: calculatePerformanceGrade({
      total_page_load: totalPageLoad,
      lcp: webVitals.lcp,
      cls: webVitals.cls,
      inp: webVitals.inp
    }),
    top_resources: topResources,
    // Timeline positioning (relative to page load completion)
    async_timeline_start: asyncTimelineStart,
    async_timeline_end: asyncTimelineEnd,
    async_timeline_window: asyncTimelineWindow,
    // API timeline and analysis
    async_api_end: asyncApiEnd,
    async_api_count: asyncApiCount > 0 ? asyncApiCount : undefined,
    async_api_parallelism: asyncApiParallelism,
    async_api_domains: asyncApiCount > 0 ? asyncApiDomains : undefined,
    async_api_slowest_endpoints: asyncApiSlowestEndpoints.length > 0 ? asyncApiSlowestEndpoints : undefined,
    async_api_slowest: asyncApiSlowest,
    // Asset analysis (non-API resources)
    async_asset_duration: asyncAssetCount > 0 ? asyncAssetDuration : undefined,
    async_asset_count: asyncAssetCount > 0 ? asyncAssetCount : undefined,
    async_asset_by_type: asyncAssetCount > 0 ? asyncAssetByType : undefined,
    async_asset_slowest: asyncAssetSlowest.length > 0 ? asyncAssetSlowest : undefined,
    timestamp: new Date().toISOString(),
  };
}

