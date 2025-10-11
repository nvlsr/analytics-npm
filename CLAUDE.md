# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@jillen/analytics` - an advanced analytics package for Next.js applications with intelligent bot detection, comprehensive visitor tracking, and Web Vitals performance monitoring. The package is designed to be lightweight, privacy-focused, zero-config, and optimized for Next.js 13+ with App Router support.

## Architecture

The codebase follows a modular structure with clear separation between client and server components:

### Core Structure
- **`src/`**: All source files organized in a single directory
- **Main entry**: `src/index.ts` - exports all public APIs

### Key Components

1. **VisitorTracker** (`src/visitor-tracker.tsx`): The main client component that handles:
   - Bot detection using isbot library + custom checks
   - Session management with localStorage/sessionStorage
   - Heartbeat tracking with adaptive intervals
   - Web Vitals performance collection (CLS, LCP, FID/INP, FCP, TTFB)
   - Analytics event collection and transmission

2. **Performance Collector** (`src/performance-collector.ts`): Web Vitals monitoring system:
   - Core Web Vitals collection using web-vitals library
   - Resource performance classification and timing
   - Real user monitoring data aggregation

3. **Bot Registry** (`src/bot-registry.ts`): Comprehensive bot detection:
   - Extensive bot database (search engines, social crawlers, monitoring tools)
   - Bot information extraction and classification

4. **Event System** (`src/events.ts`): TypeScript interfaces for all event types:
   - `HumanEventData`: User analytics events
   - `PerformanceEventData`: Web Vitals and performance metrics
   - `BotEventData`: Bot visit tracking

5. **Sending Layer** (`src/send.ts`): HTTP transmission utilities:
   - Separate endpoints for human events, performance data, and bot visits
   - Error handling and retry logic
   - Fire-and-forget transmission

6. **Server Utilities**:
   - **Middleware** (`src/middleware-utils.ts`): Next.js middleware setup
   - **Bot Utils** (`src/analytics-bot-utils.ts`): Server-side bot tracking
   - **Host Utils** (`src/analytics-host-utils.ts`): Site ID management
   - **Storage Utils** (`src/storage-utils.ts`): Browser storage helpers

### Build System

- **Build tool**: tsup for fast TypeScript bundling
- **Outputs**: Multiple formats (CJS, ESM) with TypeScript declarations
- **Entry points**: 
  - Main: `src/index.ts`

## Development Commands

```bash
# Build the package
npm run build

# Watch mode for development
npm run dev

# Clean build artifacts
npm run clean

# Prepare for publishing
npm run prepublishOnly
```

## Key Development Concepts

### Environment Behavior
- Analytics only activates in production (`NODE_ENV === "production"`)
- Development mode returns early for performance
- Zero configuration required - works out of the box

### Bot Detection Strategy
- Uses `isbot` library as primary detection
- Comprehensive bot registry with 100+ known bots
- Server-side bot tracking via middleware
- Client-side tracking disabled for detected bots
- Separate analytics pipeline for bot visits

### Data Collection Architecture
- **Human Events**: Comprehensive user analytics with session tracking
- **Performance Events**: Web Vitals and resource timing data
- **Bot Events**: Minimal bot visit tracking (fire-and-forget)
- Session management with 30-minute timeouts
- Adaptive heartbeat intervals (15s to 30min)

### Web Vitals Integration
- Automatic collection of Core Web Vitals using `web-vitals` library
- Performance events sent separately from user analytics
- Resource classification for detailed performance insights
- Real user monitoring (RUM) data collection

### Integration Points
1. **Middleware**: `setupAnalyticsMiddleware` handles bot detection and header processing
2. **Layout**: `VisitorTracker` component handles client-side analytics and performance monitoring
3. **User Authentication**: Optional `username` prop for user identification

### Simple Integration Pattern
```ts
// middleware.ts
import { setupAnalyticsMiddleware } from '@jillen/analytics'

export function middleware(request: NextRequest) {
  const { headers } = setupAnalyticsMiddleware(request);
  return NextResponse.next({ request: { headers } });
}

// layout.tsx  
import { VisitorTracker } from '@jillen/analytics'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <VisitorTracker username={userId} /> {/* Optional user ID */}
        {children}
      </body>
    </html>
  );
}
```

## External Dependencies

- **isbot**: Bot detection library (runtime)
- **web-vitals**: Web Vitals performance monitoring (runtime)
- **next**: Peer dependency for Next.js integration
- **react**: Peer dependency for React components

## Configuration

**Zero-config package!** No environment variables or setup required:

- **Analytics endpoint**: Hardcoded to `https://analytics.jillen.com/api/log/data`
- **Site identification**: Automatically determined from the request host header
- **Performance monitoring**: Automatically enabled in production
- **Bot detection**: Works out of the box with comprehensive bot registry

## Package Exports

The package exports a minimal, focused API:

```ts
// Components
export { VisitorTracker } from './visitor-tracker'
export type { VisitorTrackerProps } from './visitor-tracker'

// Server utilities
export { setupAnalyticsMiddleware } from './middleware-utils'

// TypeScript types
export type { 
  BaseEventData, 
  HumanEventData, 
  PerformanceEventData, 
  BotEventData,
  ServerEnrichedFields 
} from './events'
```

## Internal Architecture Notes

- **Event Pipeline**: Three separate event types (human, performance, bot) with dedicated processing
- **Performance Collection**: Leverages `web-vitals` library for accurate Core Web Vitals measurement
- **Bot Registry**: Extensive database covering search engines, social media crawlers, monitoring tools
- **Resource Classification**: Automatic categorization of network resources for performance insights
- **Session Management**: Client-side session tracking with automatic cleanup and timeout handling