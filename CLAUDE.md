# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@jillen/analytics` is a lightweight human-visit + Web Vitals analytics package for
React apps. As of v5 it is **framework-agnostic**: a core component works in any React
setup (Vite, React Router, TanStack Router, Astro, plain React), with a thin Next.js
App Router adapter. It is zero-config and privacy-focused. Events are sent to
`https://analytics.jillen.com`.

There is **no bot tracking** (removed in v5) and **no server/middleware entry** — see
"What v5 removed" below. The README is the user-facing source of truth; keep it, this
file, and `src/` in sync.

## Architecture

All source is in `src/`, bundled by `tsup` into dual ESM/CJS with type declarations.

### Two entry points (package `exports`)

- **`.` → `src/index.ts`** — the framework-agnostic core. Re-exports `VisitorTracker`
  from `src/visitor-tracker.tsx`, which takes a **required `pathname` prop** (you wire
  it from your router). No Next.js import, so it works everywhere.
- **`./next` → `src/next.ts`** — the Next.js App Router adapter. Re-exports the wrapper
  in `src/visitor-tracker-next.tsx`, which calls `usePathname()` from `next/navigation`
  and forwards it to the core, so consumers omit `pathname`.

`next` is an **optional** peer dependency — only the `/next` adapter imports it.

### Modules

- **`visitor-tracker.tsx`** — the core client component (`"use client"`). Page-view +
  session tracking, adaptive heartbeats (15s → 60s → 5m → 15m, 30-min idle timeout,
  pauses when the tab is hidden), client-side bot filtering via `isbot`, and triggering
  Web Vitals collection. Returns `null`.
- **`visitor-tracker-next.tsx`** — Next adapter; wires `pathname` via `usePathname()`.
- **`performance-collector.ts`** — Web Vitals (LCP, CLS, INP, plus navigation-timing)
  built on the `web-vitals` library.
- **`resource-classification.ts`** — categorises network resources for the perf payload.
- **`send.ts`** — `fetch`-based transmission (fire-and-forget, 30s timeout, silent
  failure). Two endpoints: `POST /api/human` and `POST /api/perf`.
- **`event-types.ts`** — `BaseHumanEvent` and `PerformanceEvent` payload types.
- **`analytics-host-utils.ts`** — `getSiteIdWithFallback(hostname)`; the site is
  identified by `window.location.hostname`, no API key.
- **`storage-utils.ts`** — `AnalyticsStorage` / `AnalyticsSessionStorage` wrappers over
  local/session storage (visitor id, session data).
- **`version.ts`** — re-exports `package.json` version as `sdk_version` (sent on events).

## Development Commands

```bash
npm run build          # tsup → dual ESM/CJS + d.ts in dist/
npm run dev            # tsup --watch
npm run clean          # rm -rf dist
npm run prepublishOnly # clean + build (runs before publish)
```

## Key concepts

- **Production-only.** Tracking fires only when `process.env.NODE_ENV === "production"`;
  dev returns early. Bundlers (Next.js, Vite, etc.) set this on a production build.
- **Site identification is domain-based.** No API key or site id — `send.ts` attaches
  `website_domain = window.location.hostname`. The dashboard attributes events by domain.
- **Visitor identity.** Anonymous visitors get a localStorage fingerprint; passing a
  `username` yields a deterministic, normalised id. `pathname` is required on the core.
- **Bot filtering, not bot tracking.** `isbot` suppresses JS-running-bot events
  client-side before they're sent. No bot events, registry, or pipeline exist.
- **Two payload types only:** human events and performance events.

## What v5 removed (do not reintroduce without intent)

- The `/server` entry, `setupAnalyticsMiddleware`, and all Next.js middleware code.
- Bot **tracking**: `BOT_REGISTRY` / `BOT_CATEGORIES`, `sendBotVisit`, the `BotEvent`
  type, and the `isBotEvent` / `isValidBotCategory` guards. (Bot *filtering* via `isbot`
  remains.)
- Next.js is no longer required — it's an optional peer dep used only by `./next`.

## API

```ts
// @jillen/analytics  (core — any React framework)
interface VisitorTrackerProps {
  username?: string | null
  pathname: string            // required — pass from your router
}

// @jillen/analytics/next  (Next.js App Router adapter)
interface VisitorTrackerProps {
  username?: string | null    // pathname wired via usePathname()
}
```

Both render `null`. Mount once near the app root, inside the router so the path updates
drive page-view tracking. See README.md for per-framework snippets.
