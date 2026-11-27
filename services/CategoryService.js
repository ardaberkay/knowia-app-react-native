import { supabase } from '../lib/supabase';
import { cachedQuery } from './CacheService';
import { STALE } from '../lib/queryClient';

export const getCategories = async (forceRefresh = false) => cachedQuery('categories_all', async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}, { staleTime: STALE.STATIC, force: forceRefresh });
