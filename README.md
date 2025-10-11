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

# Analytics Package Integration Guide

## Prerequisites

**Next.js project** with middleware and app router support

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

### TypeScript Types

Export types for custom implementations:
- `BaseEventData`
- `HumanEventData` 
- `PerformanceEventData`
- `BotEventData`
- `ServerEnrichedFields`