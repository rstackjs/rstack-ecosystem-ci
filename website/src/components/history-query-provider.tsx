import { useState, type ReactNode } from 'react';
import { isServer, QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

const CACHE_KEY = 'ecosystem-ci-history';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

const persister: Persister = {
  async persistClient(client) {
    const query = client.clientState.queries[0];
    // A failed refresh must not overwrite the last successful snapshot.
    if (!query) return;
    try {
      await set(CACHE_KEY, {
        ...client,
        // Expiration is based on the last successful fetch.
        timestamp: query.state.dataUpdatedAt,
      });
    } catch {
      // Storage can be unavailable or full; keep using the in-memory cache.
    }
  },
  async restoreClient() {
    try {
      return await get<PersistedClient>(CACHE_KEY);
    } catch {
      return undefined;
    }
  },
  async removeClient() {
    try {
      await del(CACHE_KEY);
    } catch {
      // An unavailable persistent cache must not prevent fetching fresh data.
    }
  },
};

export function HistoryQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: isServer ? Infinity : CACHE_MAX_AGE,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: 'v1',
        dehydrateOptions: {
          shouldDehydrateQuery: ({ queryKey, state }) =>
            queryKey[0] === 'ci-history' &&
            state.status === 'success' &&
            state.fetchStatus === 'idle',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
