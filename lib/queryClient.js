import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// Freshness rules (K23). Our own changes invalidate the data right away
// (see invalidateQueriesForCacheKey), so data only the user changes can stay
// fresh for a long time; data others change is re-checked sooner.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
export const STALE = {
  OWN: 24 * HOUR,      // my decks, my cards/chapters, progress, favourites
  SHARED: 20 * MINUTE, // discover, community / official decks, others' cards
  STATIC: 7 * 24 * HOUR, // languages, categories
};

// How long a persisted (entry point) query may come back from disk.
export const PERSIST_MAX_AGE = 7 * 24 * HOUR;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.SHARED,
      gcTime: 24 * HOUR,
      retry: 1,
    },
  },
});

// App back in the foreground = "window focus": active queries that are stale
// refetch in the background (fresh ones don't send a request).
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

// Only queries marked meta.persist (entry points: plain first pages) go to
// disk, so a cold start shows them without a request while they are fresh.
// Searches, filters and detail screens stay in RAM only.
export const PERSIST_STORAGE_KEY = 'rq_cache_v1';
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_STORAGE_KEY,
  throttleTime: 2000,
});
export const persistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist === true,
  },
};

// Query keys. The user id is part of every user-bound key.
export const qk = {
  myDecks: (userId, options) => ['myDecks', userId, options],
  homeDecks: (userId, category) => ['homeDecks', userId, category],
};

// Query groups for the invalidate table.
const MY_DECKS = { queryKey: ['myDecks'] };
const HOME_ALL = { queryKey: ['homeDecks'] };
const HOME_IN_PROGRESS = { predicate: (q) => q.queryKey[0] === 'homeDecks' && q.queryKey[2] === 'inProgressDecks' };

// Mutation → invalidate table. Services call invalidateCache(prefix) after a
// change (for the AsyncStorage keys of screens not yet on TanStack); the same
// call marks the matching queries stale here, so the table lives in one place.
// Nothing refetches at that moment: each screen refetches its stale queries
// when it is focused again, so a change costs one request, only if the list
// is looked at.
const QUERIES_BY_CACHE_PREFIX = [
  ['mydecks_', [MY_DECKS, HOME_ALL]],              // deck created / edited / deleted / shared
  ['deck_detail_', [MY_DECKS, HOME_ALL]],
  ['cards_deck_', [MY_DECKS, HOME_ALL]],           // card added / deleted → card_count
  ['chapters_', [MY_DECKS]],                       // chapter added / deleted → chapter_count
  ['fav_deck_ids_', [MY_DECKS, HOME_ALL]],         // favourite toggled → is_favorite
  ['blocked_hidden_', [HOME_ALL]],                 // user blocked / deck hidden
  ['progress_deck_', [HOME_IN_PROGRESS]],          // study session ended / deck started
];

export const invalidateQueriesForCacheKey = (keyPrefix) => {
  const prefixText = String(keyPrefix);
  // service caches (cachedQuery): ['kv', '<cache key>'] — same prefix rule as before
  queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'kv' && String(q.queryKey[1]).startsWith(prefixText),
    refetchType: 'none',
  });
  QUERIES_BY_CACHE_PREFIX.forEach(([prefix, groups]) => {
    if (String(keyPrefix).startsWith(prefix)) {
      groups.forEach((filters) => queryClient.invalidateQueries({ ...filters, refetchType: 'none' }));
    }
  });
};

/** Sign-out / account switch: RAM and the persisted copy are dropped (B6). */
export const clearQueryCache = async () => {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch {}
};
