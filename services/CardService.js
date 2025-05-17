import { supabase } from '../lib/supabase';

export const ensureUserCardProgress = async (deckId, userId) => {
  console.log('ensureUserCardProgress başlıyor', deckId, userId);
  // Önce destedeki tüm kartları çek
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id')
    .eq('deck_id', deckId);

  if (cardsError) throw cardsError;
  if (!cards || cards.length === 0) {
    console.log('Kart yok, fonksiyon bitiyor');
    return;
  }

  // Kullanıcının bu kartlar için progress kaydı var mı?
  const { data: progress, error: progressError } = await supabase
    .from('user_card_progress')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', cards.map(c => c.id));

  if (progressError) throw progressError;

  const existingCardIds = progress.map(p => p.card_id);
  const missingCardIds = cards.map(c => c.id).filter(id => !existingCardIds.includes(id));

  // Eksik olanlar için kayıt oluştur
  if (missingCardIds.length > 0) {
    const inserts = missingCardIds.map(card_id => ({
      user_id: userId,
      card_id,
      status: 'new',
      next_review: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    console.log('insert edilecek kayıtlar:', inserts);
    try {
      const { error: insertError } = await supabase.from('user_card_progress').insert(inserts);
      if (insertError) {
        console.log('insert hatası:', insertError);
        throw insertError;
      }
    } catch (e) {
      console.log('insert catch hatası:', e);
      throw e;
    }
  } else {
    console.log('Eksik kayıt yok, insert yapılmadı');
  }
  console.log('ensureUserCardProgress bitti');
};

export const getCardsForLearning = async (deckId, userId) => {
  // Kullanıcının bu destedeki, öğrenilmemiş ve zamanı gelmiş kartlarını çek
  const { data, error } = await supabase
    .from('user_card_progress')
    .select('card_id, is_learned, next_review, cards(question, answer, image, example, note)')
    .eq('user_id', userId)
    .eq('is_learned', false)
    .lte('next_review', new Date().toISOString())
    .eq('cards.deck_id', deckId);

  if (error) throw error;

  // Kartları frontend'de shuffle et
  return data.sort(() => Math.random() - 0.5);
}; 