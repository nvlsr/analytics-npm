# @jillen/analytics

Advanced analytics package for Next.js applications with intelligent bot detection and comprehensive visitor tracking.

## Features

- 🤖 **Smart Bot Detection**: Advanced bot filtering using multiple detection methods
- 📊 **Comprehensive Tracking**: Detailed visitor analytics with geolocation and device info
- 🚀 **Next.js Optimized**: Built specifically for Next.js 13+ with App Router support
- 📱 **Mobile-First**: Responsive tracking with mobile device detection
- 🔒 **Privacy-Focused**: GDPR compliant with DNT (Do Not Track) support
- ⚡ **Performance**: Lightweight, non-blocking analytics with fire-and-forget bot tracking
- 🌍 **Global Edge**: Vercel Edge Runtime compatible with worldwide deployment

# Analytics Package Integration Guide

## Prerequisites

**Next.js project** with middleware and app router support

## Installation

### Environment Variables

Set the required environment variables in your `.env`:

```bash
NEXT_PUBLIC_ANALYTICS_SERVER_URL=https://analytics.jillen.com
NEXT_PUBLIC_ANALYTICS_SITE_ID=your-domain.com
```

**Important**: Both variables use `NEXT_PUBLIC_` prefix for consistent server/client access.

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
import { VisitorTracker, type ParsedAnalyticsHeaders } from '@jillen/analytics';

interface AnalyticsProviderProps {
  analyticsData: ParsedAnalyticsHeaders;
  route: string;
}

export function AnalyticsProvider({ analyticsData, route }: AnalyticsProviderProps) {
  return <VisitorTracker {...analyticsData} route={route} />;
}
```

### Step 4: Update Root Layout

Add analytics tracking to your layout:

```typescript
// app/layout.tsx
import { headers } from "next/headers"; // Add this import if not already present
import { parseAnalyticsHeaders } from "@jillen/analytics";
import { AnalyticsProvider } from "@/components/analytics-provider";

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  const analyticsData = parseAnalyticsHeaders(headersList);

  return (
    <html lang="en">
      <body>
        <AnalyticsProvider analyticsData={analyticsData} route={pathname} />
        {children}
      </body>
    </html>
  );
}
```

### Step 5: Deploy

Deploy to production. Analytics automatically activates based on environment detection.