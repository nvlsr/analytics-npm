# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@jillen/analytics` - an advanced analytics package for Next.js applications with intelligent bot detection and comprehensive visitor tracking. The package is designed to be lightweight, privacy-focused, and optimized for Next.js 13+ with App Router support.

## Architecture

The codebase follows a modular structure with clear separation between client and server components:

### Core Structure
- **`src/`**: All source files organized in a single directory
- **Main entry**: `src/index.ts` - exports all public APIs

### Key Components

1. **VisitorTracker** (`visitor-tracker.tsx`): The main client component that handles:
   - Bot detection using multiple methods (isbot library + custom checks)
   - Session management with localStorage/sessionStorage
   - Heartbeat tracking with adaptive intervals
   - Analytics event collection and transmission

2. **Server Middleware** (`src/middleware-utils.ts`): Sets up analytics middleware for Next.js
3. **Header Parser** (`src/header-parser.ts`): Extracts analytics data from Vercel/Next.js headers
4. **Bot Tracking** (`analytics-bot-utils.ts`): Fire-and-forget bot visit tracking
5. **Storage Utilities** (`storage-utils.ts`): Browser storage helpers
6. **Host Utilities** (`analytics-host-utils.ts`): Site ID management

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

### Bot Detection Strategy
- Uses `isbot` library as primary detection
- Additional custom checks for automation tools
- Server-side bot tracking via middleware
- Client-side tracking disabled for detected bots

### Data Collection
- Minimal data collection for bots (fire-and-forget)
- Comprehensive tracking for real users
- Session management with 30-minute timeouts
- Adaptive heartbeat intervals (5s to 15min)

### Integration Points
1. **Middleware**: `setupAnalyticsMiddleware` adds pathname header and bot tracking
2. **Layout**: `VisitorTracker` component handles client-side analytics  
3. **Headers**: `parseAnalyticsHeaders` extracts Vercel geolocation data

All exports are available from the main package import:
```ts
import { 
  VisitorTracker, 
  setupAnalyticsMiddleware, 
  parseAnalyticsHeaders 
} from '@jillen/analytics'
```

## External Dependencies

- **isbot**: Bot detection library
- **next**: Peer dependency for Next.js integration
- **react**: Peer dependency for React components

## Configuration

**No environment variables required!** The package is zero-config:

- **Analytics endpoint**: Hardcoded to `https://analytics-ingestion.maaakri.workers.dev` (Cloudflare Worker)
- **Site identification**: Automatically determined from the request host header