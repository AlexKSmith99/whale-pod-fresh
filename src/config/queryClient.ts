import { QueryClient } from '@tanstack/react-query';

// Create a client with optimized defaults for mobile
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus (mobile doesn't have this)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect automatically
      refetchOnReconnect: false,
    },
  },
});
