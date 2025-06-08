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

## Installation

```bash
npm install @jillen/analytics
```

## Prerequisites

- Next.js 13.0.0 or higher
- React 18.0.0 or higher

## Quick Start

### 1. Set up environment variables

Create a `.env.local` file in your Next.js project:

```env
ANALYTICS_SERVER_URL=https://your-analytics-server.com
ANALYTICS_SITE_ID=your-site-id
```

### 2. Add middleware (optional, for bot tracking)

Create or update `middleware.ts` in your project root:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { setupAnalyticsMiddleware } from '@jillen/analytics/server';

export function middleware(request: NextRequest) {
  // Set up analytics headers and bot tracking
  const { headers } = setupAnalyticsMiddleware(request);
  
  // Continue with your existing middleware logic
  return NextResponse.next({
    request: {
      headers,
    }
  });
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 3. Add analytics to your app

In your root layout or pages:

```typescript
import { JillenAnalytics } from '@jillen/analytics';
import { headers } from 'next/headers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <JillenAnalytics 
          headers={headers()} 
          route="/current-route" 
        />
      </body>
    </html>
  )
}
```

## API Reference

### Main Components

#### `JillenAnalytics`

Main analytics component for tracking page views and user interactions.

```typescript
interface AnalyticsWrapperProps {
  headers: Headers;
  route: string;
}
```

### Server Utilities

Import from `@jillen/analytics/server`:

#### `setupAnalyticsMiddleware(request: NextRequest)`

Sets up analytics middleware for bot detection and header processing.

#### `parseAnalyticsHeaders(headers: Headers)`

Extracts analytics data from Next.js headers (IP, location, user agent, etc.).

#### `trackBotVisit(request: NextRequest, pathname: string)`

Fire-and-forget bot visit tracking (called automatically by middleware).

### Client Components

Import from `@jillen/analytics/client`:

#### `AnalyticsProvider`

Low-level analytics provider component with full customization options.

### Configuration

#### `ANALYTICS_CONFIG`

Access to current analytics configuration.

#### `validateAnalyticsConfig()`

Validates that required environment variables are set.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANALYTICS_SERVER_URL` | ✅ | URL of your analytics server |
| `ANALYTICS_SITE_ID` | ✅ | Unique identifier for your site |

## Advanced Usage

### Custom Analytics Provider

```typescript
import { AnalyticsProvider } from '@jillen/analytics/client';

export function CustomAnalytics() {
  return (
    <AnalyticsProvider
      ip="127.0.0.1"
      country="US"
      city="New York"
      region="NY"
      route="/custom-page"
      userAgent="Custom User Agent"
      // ... other props
    />
  );
}
```

### Server-Side Bot Tracking

```typescript
import { trackBotVisit } from '@jillen/analytics/server';
import { NextRequest } from 'next/server';

export function customMiddleware(request: NextRequest) {
  // Manual bot tracking
  trackBotVisit(request, '/api/endpoint');
}
```

## Architecture

This package is designed with performance and reliability in mind:

- **Server Components**: Analytics setup uses React Server Components for optimal performance
- **Client Components**: Only essential tracking code runs on the client
- **Edge Compatible**: Works with Vercel Edge Runtime and other edge environments
- **Fire-and-Forget**: Bot tracking never blocks your application
- **TypeScript**: Full type safety throughout the package

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, please visit our [GitHub repository](https://github.com/jillen/analytics). 