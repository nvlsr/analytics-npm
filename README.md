# @jillen/analytics

Lightweight human-visit and Web Vitals analytics for React apps. Framework-agnostic core with a Next.js adapter — works with Next.js, Vite, React Router, TanStack Router, Astro, and any other React-based setup.

Sends events to `https://analytics.jillen.com`.

## What it tracks

- **Page views** on initial mount and on every route change.
- **Sessions** with a 30-minute idle timeout. Heartbeats fire at 15s → 60s → 5m → 15m intervals while the user is active; pause when the tab is hidden.
- **Web Vitals**: Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint, plus navigation-timing breakdown and resource analysis.
- **Visitor identity**: localStorage-based fingerprint for anonymous users; deterministic id when you pass `username`.

Tracking only fires when `process.env.NODE_ENV === "production"`. No requests in dev.

JS-running bots (Puppeteer, Playwright, headless Chromium) are filtered out client-side via [`isbot`](https://www.npmjs.com/package/isbot); their events are not sent.

## Installation

```bash
bun add @jillen/analytics
# or
npm install @jillen/analytics
```

## Usage

The component returns `null` (renders no DOM). Mount it once near the root of your app — re-renders on route changes drive the page-view tracking.

### Vite + React Router

```tsx
// src/components/analytics-provider.tsx
import { VisitorTracker } from "@jillen/analytics"
import { useLocation } from "react-router-dom"

export function AnalyticsProvider() {
  const { pathname } = useLocation()
  return <VisitorTracker pathname={pathname} />
}
```

```tsx
// src/App.tsx
import { Routes, Route } from "react-router-dom"
import { AnalyticsProvider } from "@/components/analytics-provider"

export function App() {
  return (
    <>
      <AnalyticsProvider />
      <Routes>{/* ... */}</Routes>
    </>
  )
}
```

### Next.js (App Router)

Import from the `/next` sub-path — it wires up `usePathname()` for you:

```tsx
// app/lib/analytics-provider.tsx
"use client"
import { VisitorTracker } from "@jillen/analytics/next"

export function AnalyticsProvider() {
  return <VisitorTracker />
}
```

```tsx
// app/layout.tsx
import { AnalyticsProvider } from "./lib/analytics-provider"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  )
}
```

### TanStack Router

```tsx
import { VisitorTracker } from "@jillen/analytics"
import { useRouterState } from "@tanstack/react-router"

export function AnalyticsProvider() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return <VisitorTracker pathname={pathname} />
}
```

### Identifying users

Pass a `username` to associate visits with an authenticated user. The id is normalised (lowercased, alphanumeric-with-dashes) and persists in localStorage. Read the user info from your auth library and forward whatever string you want to use as the visitor id:

```tsx
// Clerk
const { user } = useUser()
const username = user?.username ?? user?.id ?? null

// NextAuth
const { data: session } = useSession()
const username = session?.user?.name ?? session?.user?.email ?? null

// Supabase
const user = useUser()
const username = user?.email ?? user?.id ?? null

return <VisitorTracker username={username} pathname={pathname} />
```

`null` (or omitted) = anonymous visitor, fingerprinted via locally-cached browser characteristics.

## API

### Default entry — `@jillen/analytics`

```ts
interface VisitorTrackerProps {
  username?: string | null
  pathname: string
}
declare function VisitorTracker(props: VisitorTrackerProps): null
```

### Next.js adapter — `@jillen/analytics/next`

Same component, with `pathname` wired from `usePathname()`:

```ts
interface VisitorTrackerProps {
  username?: string | null
}
declare function VisitorTracker(props: VisitorTrackerProps): null
```

## Migrating from v4

See [CHANGELOG.md](./CHANGELOG.md). Short version:

- **Next.js consumers**: change `from "@jillen/analytics"` → `from "@jillen/analytics/next"`. Remove any `setupAnalyticsMiddleware` calls (the `/server` entry no longer exists).
- **Other React apps**: import from default and pass `pathname` from your router.
- **Bot tracking** is removed in v5. Bot data was noisy in practice. Client-side bot filtering still works — JS-running bots' events still get suppressed before reaching the network.

## License

MIT
