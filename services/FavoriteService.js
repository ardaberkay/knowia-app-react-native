import { supabase } from '../lib/supabase';

// Favori Desteleri Getir (ilişkili deck verisiyle birlikte)
export const getFavoriteDecks = async (userId) => {
  // Eğer foreign key ilişkisi varsa join ile çek
  const { data, error } = await supabase
    .from('favorite_decks')
    .select('deck_id, decks(*, profiles:profiles(username, image_url))')
    .eq('user_id', userId);

  if (error) throw error;
  // data: [{ deck_id, decks: { ...deckData, profiles: { username, image_url } } }]
  // Eğer join yoksa, deck_id'leri döndürüp, DeckService ile topluca çekebilirsin
  return data.map(item => item.decks);
};

// Favori Kartları Getir (ilişkili card verisiyle birlikte)
export const getFavoriteCards = async (userId) => {
  const { data, error } = await supabase
    .from('favorite_cards')
    .select('card_id, cards(*)')
    .eq('user_id', userId);

  if (error) throw error;
  return data.map(item => item.cards);
};

// Favori Kart Ekle
export const addFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').insert({ user_id: userId, card_id: cardId });
  if (error) throw error;
};

// Favori Kart Çıkar
export const removeFavoriteCard = async (userId, cardId) => {
  const { error } = await supabase.from('favorite_cards').delete().eq('user_id', userId).eq('card_id', cardId);
  if (error) throw error;
}; 