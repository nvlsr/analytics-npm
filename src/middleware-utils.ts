import type { NextRequest } from 'next/server';
import { isbot } from 'isbot';
import { trackBotVisit } from './analytics-bot-utils';

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
  
  // Track bot visits if this is a bot
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelBot = /vercel/i.test(userAgent);
  if (isbot(userAgent) && !isVercelBot) {
    trackBotVisit(request, pathname);
  }
  
  return {
    headers,
    pathname
  };
} 