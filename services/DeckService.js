import { supabase } from '../lib/supabase';

export const getDecksByCategory = async (category) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  let query = supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)');

  switch(category) {
    case 'myDecks':
      query = query
        .eq('user_id', user.id)
        .eq('is_admin_created', false)
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

  // Favori durumunu ekle (eğer kullanıcı varsa)
  if (user && data && data.length > 0) {
    try {
      const deckIds = data.map(deck => deck.id);
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (!favoriteError && favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        // Her deck'e is_favorite property'si ekle
        data.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
      // Hata durumunda tüm deck'leri favori değil olarak işaretle
      data.forEach(deck => {
        deck.is_favorite = false;
      });
    }
  } else if (data) {
    // Kullanıcı yoksa tüm deck'leri favori değil olarak işaretle
    data.forEach(deck => {
      deck.is_favorite = false;
    });
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