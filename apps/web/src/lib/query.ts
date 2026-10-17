import { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { ApiError } from './api';
import { kvDel, kvGet, kvSet } from './db';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 3600_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) return false;
        return count < 2;
      },
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst', retry: 0 },
  },
});

/** Persistiert den Query-Cache in IndexedDB → Pläne & Übungen offline verfügbar. */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => kvSet('query-cache', client),
  restoreClient: async () => kvGet<PersistedClient>('query-cache'),
  removeClient: async () => kvDel('query-cache'),
};

export const QUERY_CACHE_BUSTER = 'satzio-v1';
