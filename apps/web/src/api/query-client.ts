import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Mutations explicitly invalidate their affected resources. Keeping
        // read data fresh for five minutes avoids re-running the same Lambda
        // and database queries during ordinary navigation.
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
