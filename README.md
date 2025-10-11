# @jillen/analytics

Advanced analytics package for Next.js applications with intelligent bot detection, comprehensive visitor tracking, and Web Vitals performance monitoring.

## Features

- 🤖 **Smart Bot Detection**: Advanced bot filtering using comprehensive bot registry and multiple detection methods
- 📊 **Comprehensive Tracking**: Detailed visitor analytics with geolocation and device info
- ⚡ **Web Vitals Monitoring**: Automatic collection of Core Web Vitals (CLS, FID, LCP, FCP, TTFB, INP)
- 🚀 **Next.js Optimized**: Built specifically for Next.js 13+ with App Router support
- 📱 **Mobile-First**: Responsive tracking with mobile device detection
- 🔒 **Privacy-Focused**: GDPR compliant with DNT (Do Not Track) support
- 🏎️ **Performance-First**: Lightweight, non-blocking analytics with fire-and-forget tracking
- 🌍 **Zero-Config**: No environment variables required - works out of the box
- 🔧 **Next.js 15+ Compatible**: Proper client/server separation prevents build errors

# Analytics Package Integration Guide

## Prerequisites

**Next.js project** with middleware and app router support

## Important: Client/Server Separation

This package uses separate entry points for client and server code to ensure compatibility with Next.js 15+:

- **Client components**: Import from `@jillen/analytics`
- **Server utilities**: Import from `@jillen/analytics/server`

This prevents build errors like "usePathname is not exported from 'next/navigation'" in Next.js 15.3.1+.

## Installation

## Implementation Steps

### Step 1: Install Package

```bash
npm install @jillen/analytics
# or
bun add @jillen/analytics
```

### Step 2: Update Middleware

Add the setupAnalyticsMiddleware utility to your middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setupAnalyticsMiddleware } from '@jillen/analytics/server';

export function middleware(request: NextRequest) {
  // Setup analytics (pathname header + bot tracking)
  const { headers } = setupAnalyticsMiddleware(request);

  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Step 3: Create Client Analytics Component

Create a client component to handle analytics:

```typescript
// components/analytics-provider.tsx
"use client";
import { VisitorTracker } from '@jillen/analytics';
import { useUser } from "@clerk/nextjs"; // or your auth system

export function AnalyticsProvider() {
  const { isLoaded, user } = useUser();

  // Wait for auth to load before initializing analytics
  if (!isLoaded) {
    return null;
  }

  // Use username, fallback to user ID, or null for anonymous
  const username = user?.username ?? user?.id ?? null;

  return <VisitorTracker username={username} />;
}
```

**Alternative auth systems:**

```typescript
// For NextAuth.js
import { useSession } from "next-auth/react";

export function AnalyticsProvider() {
  const { status, data: session } = useSession();
  
  if (status === "loading") return null;
  
  const username = session?.user?.email ?? session?.user?.id ?? null;
  return <VisitorTracker username={username} />;
}

// For Supabase Auth
import { useUser } from "@supabase/auth-helpers-react";

export function AnalyticsProvider() {
  const user = useUser();
  const username = user?.email ?? user?.id ?? null;
  return <VisitorTracker username={username} />;
}
```

### Step 4: Update Root Layout

Add analytics tracking to your layout:

```typescript
// app/layout.tsx
import { AnalyticsProvider } from "@/components/analytics-provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
```

### Step 5: Deploy

Deploy to production. Analytics automatically:
- ✅ **Detects bots** and tracks them separately
- ✅ **Collects Web Vitals** performance metrics
- ✅ **Tracks user sessions** and page views
- ✅ **Works in production only** (disabled in development)

## What Gets Tracked

### 📊 **User Analytics**
- Page views and session tracking
- User identification (if username provided)
- Device info (screen resolution, viewport, mobile detection)
- Geographic data (via Vercel headers)
- Referrer information

### ⚡ **Performance Metrics**
- **Core Web Vitals**: CLS, LCP, FID/INP
- **Loading Metrics**: FCP, TTFB
- **Resource Performance**: Automatic classification and timing
- **User Experience**: Real user monitoring data

### 🤖 **Bot Detection**
- Comprehensive bot registry (search engines, social crawlers, monitoring tools)
- Separate tracking pipeline for bot visits
- Protection against analytics pollution

## API Reference

### Components

#### `VisitorTracker`
```typescript
interface VisitorTrackerProps {
  username?: string | null; // Optional user identifier
}
```

### Server Functions

#### `setupAnalyticsMiddleware(request: NextRequest)`
Sets up analytics middleware for automatic bot detection and header processing.

**Import from server entry point:**
```typescript
import { setupAnalyticsMiddleware } from '@jillen/analytics/server';
```

### TypeScript Types

Export types for custom implementations:
- `BaseEventData`
- `HumanEventData` 
- `PerformanceEventData`
- `BotEventData`
- `ServerEnrichedFields`

## Migration from v4.0.14 and Earlier

If upgrading from versions before 4.0.15, update your server imports:

```diff
// middleware.ts
- import { setupAnalyticsMiddleware } from '@jillen/analytics';
+ import { setupAnalyticsMiddleware } from '@jillen/analytics/server';
```

Client component imports remain unchanged:
```typescript
// components/analytics-provider.tsx
import { VisitorTracker } from '@jillen/analytics'; // ✅ No change needed
```

## Troubleshooting

### Build Errors in Next.js 15+

If you see errors like:
- "usePathname is not exported from 'next/navigation'"
- "useRef is not exported from 'react'"

**Solution**: Ensure you're using the correct import paths:
- Server code: `import { setupAnalyticsMiddleware } from '@jillen/analytics/server'`
- Client components: `import { VisitorTracker } from '@jillen/analytics'`