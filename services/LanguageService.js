import { supabase } from '../lib/supabase';
import { cacheData, getCachedData, CACHE_DURATIONS } from './CacheService';

export const getLanguages = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = await getCachedData('languages_all', CACHE_DURATIONS.LANGUAGES);
    if (cached && !cached.isStale) return cached.data;
  }

  const { data, error } = await supabase
    .from('languages')
    .select('id, language_name, language_code, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  const result = data || [];
  await cacheData('languages_all', result);
  return result;
};