/**
 * Centralized resource classification utilities
 * Single source of truth for resource type mapping and classification logic
 */

// Performance API initiator types to semantic categories mapping
export const RESOURCE_TYPE_MAPPING = {
  // Static assets (initial rendering)
  script: 'JavaScript',
  link: 'CSS Stylesheets', // CSS files and preloaded resources
  css: 'Web Fonts', // Fonts loaded via CSS
  img: 'Images',
  navigation: 'Navigation',

  // Dynamic resources (post-load)
  fetch: 'API Calls',
  xmlhttprequest: 'API Calls',

  // Fallback
  other: 'Other Resources'
} as const;

// Category names to Performance API types (for filtering)
export const CATEGORY_TO_TYPE_MAPPING = {
  'CSS Stylesheets': 'link',        // CSS files appear as 'link' type in Performance API
  'Sync JavaScript': 'script',      // JavaScript files appear as 'script'
  'Web Fonts': 'css',               // Web fonts appear as 'css' type when loaded via CSS
  'Critical Images': 'img',         // Images appear as 'img'
  'Navigation': 'navigation',       // Main document appears as 'navigation'
  'API Calls': 'fetch',             // API calls appear as 'fetch'
  'JavaScript': 'script',           // Dynamic table label
  'Stylesheets': 'link',            // Dynamic table label
  'Images': 'img',                  // Dynamic table label
  'Other Resources': 'other'        // Dynamic table label
} as const;

/**
 * Check if a resource is a static asset based on URL patterns
 */
export function isStaticAsset(url: string): boolean {
  // Static file extensions
  const staticExtensions = [
    '.js', '.css', '.woff2', '.woff', '.ttf',
    '.png', '.jpg', '.jpeg', '.svg', '.webp',
    '.ico', '.gif', '.bmp'
  ];
  
  // Static asset patterns
  const staticPatterns = [
    '/_next/static/',
    '/static/',
    '/assets/',
    '/public/'
  ];
  
  // Check file extensions
  if (staticExtensions.some(ext => url.endsWith(ext))) {
    return true;
  }
  
  // Check URL patterns
  if (staticPatterns.some(pattern => url.includes(pattern))) {
    return true;
  }
  
  return false;
}

/**
 * Check if a URL represents a dynamic endpoint (API, analytics, auth, etc.)
 */
export function isDynamicEndpoint(url: string): boolean {
  // Static assets are never dynamic endpoints
  if (isStaticAsset(url)) {
    return false;
  }
  
  // Dynamic endpoint patterns
  const dynamicPatterns = [
    '/api/',
    '/v1/',
    '/log/',
    '/analytics/',
    '/auth/',
    '/sign'
  ];
  
  // Dashboard/admin endpoints (excluding static files)
  if (url.includes('/dashboard') && !isStaticAsset(url)) {
    return true;
  }
  
  return dynamicPatterns.some(pattern => url.includes(pattern));
}

export type ResourceKind =
  | 'api'
  | 'script'
  | 'stylesheet'
  | 'font'
  | 'image'
  | 'navigation'
  | 'other';

export type ResourceConfidence = 'high' | 'medium' | 'low';

export interface ResourceTypeClassification {
  kind: ResourceKind;
  confidence: ResourceConfidence;
  source?: string;
}

const scriptExtensions = /\.(js|mjs|cjs|jsx|ts|tsx)(\?|$)/i;
const styleExtensions = /\.(css|scss|sass|less)(\?|$)/i;
const fontExtensions = /\.(woff2?|ttf|eot|otf)(\?|$)/i;
const imageExtensions = /\.(jpg|jpeg|png|gif|svg|webp|avif|bmp|ico)(\?|$)/i;

function classifyFromInitiatorType(type: string | undefined): ResourceKind | undefined {
  if (!type) return undefined;
  const normalized = type.toLowerCase();

  if (normalized === 'fetch' || normalized === 'xmlhttprequest') return 'api';
  if (normalized === 'script') return 'script';
  if (normalized === 'img' || normalized === 'image') return 'image';
  if (normalized === 'navigation') return 'navigation';
  if (normalized === 'stylesheet') return 'stylesheet';
  if (normalized === 'css') return 'font'; // Fonts often surface as CSS
  if (normalized === 'link') return undefined; // Needs further inspection

  return undefined;
}

function classifyFromUrl(url: string): ResourceTypeClassification | undefined {
  if (scriptExtensions.test(url)) return { kind: 'script', confidence: 'medium' };
  if (styleExtensions.test(url)) return { kind: 'stylesheet', confidence: 'medium' };
  if (fontExtensions.test(url)) return { kind: 'font', confidence: 'medium' };
  if (imageExtensions.test(url)) return { kind: 'image', confidence: 'medium' };

  if (url.includes('fonts.googleapis.com')) {
    return { kind: 'font', confidence: 'medium', source: 'Google Fonts' };
  }
  if (url.includes('typekit.net') || url.includes('fonts.com')) {
    return { kind: 'font', confidence: 'medium', source: 'External CDN' };
  }

  return undefined;
}

/**
 * Classify a resource into a semantic type with confidence scoring.
 * Used by both initial rendering and dynamic loading views to stay consistent.
 */
export function classifyResourceType(resource: {
  name: string;
  initiator_type?: string;
}): ResourceTypeClassification {
  const initiatorKind = classifyFromInitiatorType(resource.initiator_type);

  if (initiatorKind) {
    return { kind: initiatorKind, confidence: 'high' };
  }

  // Special handling for link initiators (preloads) and CSS-triggered fonts
  const type = resource.initiator_type?.toLowerCase();
  if (type === 'link') {
    if (styleExtensions.test(resource.name) || resource.name.includes('_next/static/css')) {
      return { kind: 'stylesheet', confidence: 'high' };
    }
    if (scriptExtensions.test(resource.name) || resource.name.includes('_next/static/chunks')) {
      return { kind: 'script', confidence: 'medium', source: 'Link preload script' };
    }
    if (fontExtensions.test(resource.name)) {
      return { kind: 'font', confidence: 'medium', source: 'Link preload font' };
    }
  }

  if (type === 'css') {
    const fromUrl = classifyFromUrl(resource.name);
    if (fromUrl) return fromUrl;

    return { kind: 'font', confidence: 'medium', source: 'CSS-triggered font' };
  }

  const urlClassification = classifyFromUrl(resource.name);
  if (urlClassification) return urlClassification;

  if (isDynamicEndpoint(resource.name)) {
    return { kind: 'api', confidence: 'low', source: 'Dynamic endpoint heuristic' };
  }

  return {
    kind: 'other',
    confidence: 'low',
    source: resource.initiator_type ? `Unknown initiator: ${resource.initiator_type}` : 'Unknown initiator'
  };
}

/**
 * Classify a resource as initial rendering or dynamic loading phase
 */
export function classifyResourcePhase(resource: {
  initiator_type: string;
  name: string;
  duplicate_count?: number;
  initial_requests?: number;
  dynamic_requests?: number;
}): 'initial' | 'dynamic' {
  const totalRequests = (resource.initial_requests || 0) + (resource.dynamic_requests || 0);
  
  // API endpoints with multiple hits are dynamic
  if ((resource.initiator_type === 'fetch' || resource.initiator_type === 'xmlhttprequest')) {
    if (totalRequests > 1 || isDynamicEndpoint(resource.name)) {
      return 'dynamic';
    }
  }
  
  // Resources with more dynamic than initial requests
  if ((resource.dynamic_requests || 0) > (resource.initial_requests || 0)) {
    return 'dynamic';
  }
  
  // Dynamic endpoints regardless of timing
  if (isDynamicEndpoint(resource.name) && (resource.dynamic_requests || 0) > 0) {
    return 'dynamic';
  }
  
  // Default to initial for static assets
  return 'initial';
}

/**
 * Get the semantic category name for a Performance API initiator type
 */
export function getSemanticCategory(initiatorType: string): string {
  return RESOURCE_TYPE_MAPPING[initiatorType as keyof typeof RESOURCE_TYPE_MAPPING] || 'Other Resources';
}

/**
 * Map category name to Performance API type for filtering
 */
export function mapCategoryToFilterType(categoryName: string): string {
  return CATEGORY_TO_TYPE_MAPPING[categoryName as keyof typeof CATEGORY_TO_TYPE_MAPPING] || 'all';
}

/**
 * Get the phase color for UI display
 */
export function getPhaseColor(phase: 'initial' | 'dynamic'): string {
  return phase === 'initial' ? 'text-chart-1' : 'text-chart-4';
}

/**
 * Get the phase text for UI display
 */
export function getPhaseText(phase: 'initial' | 'dynamic'): string {
  return phase === 'initial' ? 'INITIAL' : 'DYNAMIC';
}
