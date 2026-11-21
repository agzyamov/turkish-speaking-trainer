import { createContext, useContext, useState, type ReactNode } from "react";
import { createHashHistory, createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";

/*
 * Sections as URLs (ADR-0009). The browser uses hash history (/app#/statistics), so section links work
 * without changing the hosting routes; the native Android app keeps an in-memory history, and its
 * pager stays the way to move between panels. The router only holds the location: TrainerApp still
 * renders every section itself.
 */
const sectionPaths = ["/statistics", "/statistics/phrases", "/premium", "/settings", "/admin"] as const;
const rootRoute = createRootRoute({ component: () => null });
const routeTree = rootRoute.addChildren([createRoute({ getParentRoute: () => rootRoute, path: "/" }), ...sectionPaths.map(path => createRoute({ getParentRoute: () => rootRoute, path }))]);

function createAppRouter(native: boolean) {
  return createRouter({
    routeTree,
    history: native ? createMemoryHistory({ initialEntries: ["/"] }) : createHashHistory(),
    defaultNotFoundComponent: () => null,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

const AppTree = createContext<ReactNode>(null);
// Stable component, so the app tree is not remounted when the router re-renders.
function InnerWrap({ children }: { children: ReactNode }) {
  return (
    <>
      {useContext(AppTree)}
      {children}
    </>
  );
}

/** One router per signed-in account; renders `children` inside the router context. */
export function AppRouter({ native, children }: { native: boolean; children: ReactNode }) {
  const [router] = useState(() => createAppRouter(native));
  return (
    <AppTree.Provider value={children}>
      <RouterProvider router={router} InnerWrap={InnerWrap} />
    </AppTree.Provider>
  );
}
