import { supabase } from '../lib/supabase';

export const getDecksByCategory = async (category) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  let query = supabase
    .from('decks')
    .select('*');

  switch(category) {
    case 'myDecks':
      query = query
        .eq('user_id', user.id)
        .eq('is_admin_created', false)
        .eq('is_shared', false);
      break;
    case 'defaultDecks':
      query = query
        .eq('is_admin_created', true);
      break;
    case 'communityDecks':
      query = query
        .eq('is_shared', true)
        .eq('is_admin_created', false);
      break;
    case 'inProgressDecks':
      query = query
        .eq('user_id', user.id)
        .eq('is_started', true);
      break;
  }

  const { data, error } = await query;
  
  console.log(`${category} decks:`, data); // Debug için
  
  if (error) {
    console.error(`Error fetching ${category} decks:`, error);
    throw error;
  }

  return data;
};

// Kullanıcı bir destede çalışmaya başladığında is_started alanını true yapar
export const setDeckStarted = async (deckId) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('decks')
    .update({ is_started: true })
    .eq('id', deckId)
    .eq('user_id', user.id);
  if (error) throw error;
};