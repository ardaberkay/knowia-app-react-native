import { supabase } from '../lib/supabase';
import { cachedQuery, dropCachedQuery } from './CacheService';
import { STALE } from '../lib/queryClient';

// v3: v2 may hold the 7-row list cached before the content-languages SQL ran.
const CACHE_KEY = 'languages_all_v3';

// Content languages (deck front/back). Every language with a built-in TTS
// voice; native_name + english_name come from the table. Falls back to the old
// columns if the new ones aren't there yet.
export const getLanguages = async (forceRefresh = false) => {
  let complete = true;
  const result = await cachedQuery(CACHE_KEY, async () => {
    let { data, error } = await supabase
      .from('languages')
      .select('id, language_name, language_code, sort_order, native_name, english_name')
      .order('sort_order', { ascending: true });
    complete = !error;
    if (error) {
      ({ data, error } = await supabase
        .from('languages')
        .select('id, language_name, language_code, sort_order')
        .order('sort_order', { ascending: true }));
    }
    if (error) throw error;
    return data || [];
  }, { staleTime: STALE.STATIC, force: forceRefresh });
  // Only the full list is kept; the old-column fallback is fetched again next time.
  if (!complete) dropCachedQuery(CACHE_KEY);
  return result || [];
};

// The first 7 rows also have translated names in the app (languages.<order>).
const TRANSLATED_ORDERS = 7;

/** Badge text: "TR", "JA", "YUE". */
export const languageCode = (language) => (language?.language_code || '').toUpperCase();

/** Name in the language itself ("日本語"); translated name for the original 7 when missing. */
export const languageNativeName = (language, t) => {
  if (!language) return '';
  if (language.native_name) return language.native_name;
  if (language.sort_order <= TRANSLATED_ORDERS) return t(`languages.${language.sort_order}`, language.language_name);
  return language.language_name || languageCode(language);
};

/** English name shown under the native one; null when it would repeat it. */
export const languageEnglishName = (language) => {
  const english = language?.english_name;
  if (!english || english === language?.native_name) return null;
  return english;
};

/**
 * Picker order: the app's language first, then the original 7 (by their
 * order), then everything else by English name.
 */
export const sortLanguagesForPicker = (languages = [], appLanguageCode) => {
  const app = (appLanguageCode || '').toLowerCase().split('-')[0];
  const rank = (l) => {
    if ((l.language_code || '').toLowerCase() === app) return 0;
    return l.sort_order <= TRANSLATED_ORDERS ? 1 : 2;
  };
  return [...languages].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return a.sort_order - b.sort_order;
    return (a.english_name || a.language_name || '').localeCompare(b.english_name || b.language_name || '');
  });
};

/** Search by native name, English name, translated name or code. */
export const filterLanguages = (languages = [], query, t) => {
  const q = (query || '').trim().toLocaleLowerCase();
  if (!q) return languages;
  return languages.filter((l) =>
    [languageNativeName(l, t), l.english_name, l.language_name, l.language_code]
      .some((v) => (v || '').toLocaleLowerCase().includes(q))
  );
};

/**
 * Filter lists only offer languages that some loaded deck uses (plus any that
 * are currently selected, so they can be cleared).
 */
export const languagesInUse = (languages = [], decks = [], selectedIds = []) => {
  const used = new Set(selectedIds);
  for (const deck of decks || []) {
    for (const dl of deck?.decks_languages || []) used.add(dl.language_id);
  }
  return languages.filter((l) => used.has(l.id));
};
