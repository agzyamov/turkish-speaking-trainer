import { QueryClient } from "@tanstack/react-query";

/**
 * One client per signed-in account: QueryProvider creates it and App keys the provider by account id,
 * so cached data never crosses accounts.
 * Defaults keep the app's earlier behaviour: no silent retries (errors show a retry button at once)
 * and no refetch on window focus (the app refreshes its own data when the page becomes visible).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}
