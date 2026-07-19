"use client";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useEffect, type ReactNode } from "react";

const noop = () => {};
const mockRouter = {
  back: noop,
  forward: noop,
  refresh: noop,
  hmrRefresh: noop,
  push: noop,
  replace: noop,
  prefetch: noop,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/**
 * Static Next.js router context so components using next/link and
 * next/navigation (usePathname, useRouter) render outside the app.
 * Also paints the app's own background behind every preview cell — the
 * primary theme is dark, and outline/ghost/muted styles are illegible on
 * the harness's white cell background without it.
 * Preview-only — never imported by app code.
 */
export function PreviewRouter({ children }: { children: ReactNode }) {
  // Portalled content (dialogs, menus, sheets) mounts on document.body,
  // outside the frame div below — paint the body too so backdrops sit on
  // the app background instead of white. Inline style, not a class: the
  // preview harness sets an inline body background that beats any class.
  useEffect(() => {
    document.body.style.background = "var(--background)";
  }, []);
  return (
    <AppRouterContext.Provider value={mockRouter}>
      <PathnameContext.Provider value="/">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <SearchParamsContext.Provider value={new URLSearchParams() as any}>
          <PathParamsContext.Provider value={{}}>
            <div className="bg-background p-4 text-foreground">{children}</div>
          </PathParamsContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}
