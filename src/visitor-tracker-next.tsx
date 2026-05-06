"use client";

import { usePathname } from "next/navigation";

import {
  VisitorTracker as Core,
  type VisitorTrackerProps as CoreProps,
} from "./visitor-tracker";

export type VisitorTrackerProps = Omit<CoreProps, "pathname">;

/**
 * Next.js adapter for VisitorTracker. Reads the current pathname via
 * `usePathname()` from `next/navigation` and forwards it to the
 * framework-agnostic core.
 *
 * Use this in a Next.js App Router project. For other React frameworks
 * (Vite, React Router, TanStack Router, Astro, etc.), import the core
 * from `@jillen/analytics` directly and pass `pathname` from your
 * router state.
 */
export function VisitorTracker(props: VisitorTrackerProps) {
  const pathname = usePathname();
  return <Core {...props} pathname={pathname ?? ""} />;
}
