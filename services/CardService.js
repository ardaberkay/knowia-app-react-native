import { supabase } from '../lib/supabase';

export const ensureUserCardProgress = async (deckId, userId) => {
  console.log('ensureUserCardProgress başlıyor', deckId, userId);

  // 1. ADIM: Destedeki tüm kartların ID'lerini sayfalama ile çek (1000 limitini aş)
  let allCardIds = [];
  let from = 0;
  const step = 1000;
  let hasMoreCards = true;

  while (hasMoreCards) {
    const { data: cardsChunk, error: cardsError } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', deckId)
      .range(from, from + step - 1);

    if (cardsError) throw cardsError;

    if (cardsChunk && cardsChunk.length > 0) {
      allCardIds.push(...cardsChunk.map(c => c.id));
    }

    if (!cardsChunk || cardsChunk.length < step) {
      hasMoreCards = false;
    } else {
      from += step;
    }
  }

  if (allCardIds.length === 0) {
    console.log('Kart yok, fonksiyon bitiyor');
    return;
  }

  // 2. ADIM: Kullanıcının bu destedeki mevcut progress kayıtlarını sayfalama ile çek
  // DİKKAT: .in() KULLANMIYORUZ! (Bad Request Hatasını çözen sihir burası)
  let existingCardIds = new Set(); // Hızlı karşılaştırma için Set
  let progFrom = 0;
  let hasMoreProgress = true;

  while (hasMoreProgress) {
    const { data: progChunk, error: progError } = await supabase
      .from('user_card_progress')
      .select('card_id, cards!inner(deck_id)') // cards!inner şart!
      .eq('user_id', userId)
      .eq('cards.deck_id', deckId)
      .range(progFrom, progFrom + step - 1);

    if (progError) throw progError;

    if (progChunk && progChunk.length > 0) {
      progChunk.forEach(p => existingCardIds.add(p.card_id));
    }

    if (!progChunk || progChunk.length < step) {
      hasMoreProgress = false;
    } else {
      progFrom += step;
    }
  }

  // 3. ADIM: Eksik olan kartları tespit et
  const missingCardIds = allCardIds.filter(id => !existingCardIds.has(id));

  // 4. ADIM: Eksik olanları 500'erlik PAKETLER halinde Insert yap
  // 3000 kartı aynı anda yazarsan veritabanı kilitlenir.
  if (missingCardIds.length > 0) {
    console.log(`${missingCardIds.length} adet eksik kayıt oluşturuluyor...`);
    
    const CHUNK_SIZE = 500;
    for (let i = 0; i < missingCardIds.length; i += CHUNK_SIZE) {
      const chunk = missingCardIds.slice(i, i + CHUNK_SIZE);
      const inserts = chunk.map(card_id => ({
        user_id: userId,
        card_id,
        status: 'new',
        next_review: new Date().toISOString(),
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('user_card_progress')
        .insert(inserts);

      if (insertError) {
         console.error('Insert chunk hatası:', insertError);
         throw insertError;
      }
    }
    console.log('Eksik kayıtlar başarıyla 500\'lük paketler halinde eklendi.');
  } else {
    console.log('Eksik kayıt yok, insert yapılmadı');
  }
  
  console.log('ensureUserCardProgress bitti');
};

export const getCardsForLearning = async (deckId, userId) => {
  // Bu fonksiyonda da cards!inner eksikti, onu da düzelttik!
  const { data, error } = await supabase
    .from('user_card_progress')
    .select('card_id, status, next_review, cards!inner(question, answer, image, example, note)')
    .eq('user_id', userId)
    .neq('status', 'learned') // 'is_learned' boolean'ı yerine 'status' kullanıyoruz
    .lte('next_review', new Date().toISOString())
    .eq('cards.deck_id', deckId);

  if (error) throw error;

  // Kartları frontend'de shuffle et
  return data.sort(() => Math.random() - 0.5);
};