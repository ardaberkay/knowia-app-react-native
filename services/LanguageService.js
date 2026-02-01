import { supabase } from '../lib/supabase';

// services/languageService.js
export const getLanguages = async () => {
    const { data, error } = await supabase
      .from('languages')
      .select('id, language_name, language_code, sort_order') // Filtre listesi için bu kadarı yeterli
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  };