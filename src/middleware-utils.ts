import type { NextRequest } from 'next/server';
import { isbot } from 'isbot';
import { sendBotVisit } from './send';

/**
 * Combined middleware utility for analytics
 * Handles both pathname header injection and bot tracking
 */
export function setupAnalyticsMiddleware(request: NextRequest) {
  // Extract pathname from URL
  const pathname = request.nextUrl.pathname;
  
  // Clone headers and add pathname
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  
  // Skip bot tracking for API routes to prevent infinite loops
  const isApiRoute = pathname.startsWith('/api/');
  
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelBot = /vercel/i.test(userAgent);
  if (!isApiRoute && isbot(userAgent) && !isVercelBot) {
    sendBotVisit(request);
  }
  
  return {
    headers,
    pathname
  };
} 