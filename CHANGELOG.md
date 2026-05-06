# Changelog

## 5.0.0

### Breaking changes

- **Default entry is now framework-agnostic.** `import { VisitorTracker } from "@jillen/analytics"` returns a component that requires a `pathname` prop. This makes the package work in any React app — Vite, React Router, TanStack Router, Astro, and Next.js — by wiring up your router's pathname source explicitly.
- **Bot tracking removed.** The `/server` entry, the `setupAnalyticsMiddleware` Next.js middleware utility, the `BOT_REGISTRY` table, and the `sendBotVisit` server-side fire-and-forget have all been removed. Bot data was high-volume and noisy in practice; the package is now a focused human-visit + Web Vitals tracker.
- The `BotEvent` type and `BOT_CATEGORIES` / `BotCategory` exports are gone. The `isBotEvent` and `isValidBotCategory` type guards are gone.
- `next` is now an **optional** peer dependency. Only the `/next` adapter file imports `next/navigation`; the default entry has no Next.js code.

### Migration

#### Next.js consumers (App Router)

One-line change per site — switch the import path:

```diff
- import { VisitorTracker } from "@jillen/analytics"
+ import { VisitorTracker } from "@jillen/analytics/next"
```

Component usage is identical (`<VisitorTracker username={...} />`); the new path is a thin wrapper that calls `usePathname()` for you.

If you were also wiring up the server middleware, **remove the call entirely**:

```diff
// middleware.ts
- import { setupAnalyticsMiddleware } from "@jillen/analytics/server"
- const { headers } = setupAnalyticsMiddleware(request)
- return NextResponse.next({ request: { headers } })
+ return NextResponse.next()
```

The middleware is gone in v5; it's a no-op import that won't resolve.

#### Vite, React Router, and other React apps

Import the default and pass `pathname` from your router:

```tsx
import { VisitorTracker } from "@jillen/analytics"
import { useLocation } from "react-router-dom"

export function AnalyticsProvider() {
  const { pathname } = useLocation()
  return <VisitorTracker pathname={pathname} />
}
```

For TanStack Router, Astro, or any other source: pass `pathname` from wherever your router exposes it. The component re-evaluates on every prop change, so route transitions Just Work as long as the value updates.

### Behaviour notes (unchanged from v4)

- Tracking only fires when `process.env.NODE_ENV === "production"`. Vite's build replaces this constant; Next.js's build does too. No analytics requests fire in dev.
- Client-side bot detection (Puppeteer, Playwright, headless Chromium, etc.) is still active inside the tracker — those clients do not emit human events. The change in v5 is that we no longer also report them server-side as bot events.
- Web Vitals (LCP / CLS / INP) and detailed performance breakdown are unchanged.
- Session, visitor, and heartbeat logic are unchanged.

## 4.x

See git history.
