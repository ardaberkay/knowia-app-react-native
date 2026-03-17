import { supabase } from '../lib/supabase';
import { cacheData, getCachedData, CACHE_DURATIONS } from './CacheService';

export const getCategories = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = await getCachedData('categories_all', CACHE_DURATIONS.CATEGORIES);
    if (cached && !cached.isStale) return cached.data;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  const result = data || [];
  await cacheData('categories_all', result);
  return result;
};
