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

// Popüler desteleri getir (hibrit skor ile, zaman bazlı filtreleme ile)
// Yüzdelik dağılım: Favori %35, Unique Başlatma %25, Toplam Başlatma %20, Aktif Kullanım %20
// timeFilter: 'today' | 'week' | 'month' | 'year' | 'all'
export const getPopularDecks = async (limit = 20, timeFilter = 'all') => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Paylaşılmış/admin destelerini al
  const { data: allDecks, error: decksError } = await supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
    .or('is_shared.eq.true,is_admin_created.eq.true');

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    throw decksError;
  }

  if (!allDecks || allDecks.length === 0) {
    return [];
  }

  // 2. Batch sorgular ile tüm metrikleri toplu olarak al
  const deckIds = allDecks.map(d => d.id);
  
  // Zaman bazlı filtreleme için tarih hesapla
  let startDate = null;
  if (timeFilter !== 'all') {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  // Önce tüm card'ları al (progress sorgusu için gerekli)
  const { data: allCards } = await supabase
    .from('cards')
    .select('id, deck_id')
    .in('deck_id', deckIds);
  
  const allCardIds = allCards?.map(c => c.id) || [];

  // Batch sorgular - paralel çalıştır
  const [
    favoriteCountsResult,
    statsResult,
    progressResult
  ] = await Promise.all([
    // a) Tüm deck'ler için favori sayıları
    supabase
      .from('favorite_decks')
      .select('deck_id')
      .in('deck_id', deckIds),
    
    // b) Tüm deck'ler için stats (zaman bazlı filtreleme ile)
    (() => {
      let query = supabase
        .from('decks_stats')
        .select('deck_id')
        .in('deck_id', deckIds);
      if (startDate) {
        query = query.gte('started_at', startDate.toISOString());
      }
      return query;
    })(),
    
    // c) Tüm card'lar için progress (unique users ve active usage için)
    allCardIds.length > 0 ? supabase
      .from('user_card_progress')
      .select('card_id, user_id, status')
      .in('card_id', allCardIds) : Promise.resolve({ data: [] })
  ]);

  // Card'ları deck_id'ye göre grupla
  const cardsByDeck = {};
  if (allCards) {
    allCards.forEach(card => {
      if (!cardsByDeck[card.deck_id]) {
        cardsByDeck[card.deck_id] = [];
      }
      cardsByDeck[card.deck_id].push(card.id);
    });
  }

  // Favori sayılarını hesapla
  const favoriteCountsByDeck = {};
  if (favoriteCountsResult.data) {
    favoriteCountsResult.data.forEach(fav => {
      favoriteCountsByDeck[fav.deck_id] = (favoriteCountsByDeck[fav.deck_id] || 0) + 1;
    });
  }

  // Stats sayılarını hesapla
  const statsCountsByDeck = {};
  if (statsResult.data) {
    statsResult.data.forEach(stat => {
      statsCountsByDeck[stat.deck_id] = (statsCountsByDeck[stat.deck_id] || 0) + 1;
    });
  }

  // Progress verilerini işle
  const progressByCard = {};
  if (progressResult.data) {
    progressResult.data.forEach(progress => {
      if (!progressByCard[progress.card_id]) {
        progressByCard[progress.card_id] = {
          users: new Set(),
          activeCount: 0
        };
      }
      progressByCard[progress.card_id].users.add(progress.user_id);
      if (progress.status === 'learning' || progress.status === 'learned') {
        progressByCard[progress.card_id].activeCount++;
      }
    });
  }

  // Her deck için metrikleri hesapla
  const decksWithMetrics = allDecks.map((deck) => {
    const cardIds = cardsByDeck[deck.id] || [];
    const favoriteCount = favoriteCountsByDeck[deck.id] || 0;
    const totalStartsCount = statsCountsByDeck[deck.id] || 0;

    // Unique started count - bu deck'in card'larına sahip unique user sayısı
    let uniqueStartedCount = 0;
    let activeUsageCount = 0;
    
    if (cardIds.length > 0) {
      const allUsers = new Set();
      cardIds.forEach(cardId => {
        if (progressByCard[cardId]) {
          progressByCard[cardId].users.forEach(userId => allUsers.add(userId));
          activeUsageCount += progressByCard[cardId].activeCount;
        }
      });
      uniqueStartedCount = allUsers.size;
    }

    // Skor hesapla (yüzdelik dağılım)
    const popularityScore = 
      favoriteCount * 0.35 +
      uniqueStartedCount * 0.25 +
      totalStartsCount * 0.20 +
      activeUsageCount * 0.20;

    return {
      ...deck,
      favorite_count: favoriteCount,
      unique_started_count: uniqueStartedCount,
      total_starts_count: totalStartsCount,
      active_usage_count: activeUsageCount,
      popularity_score: popularityScore
    };
  });

  // 3. Skora göre sırala ve limit uygula
  const sortedDecks = decksWithMetrics
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, limit);

  // 4. Favori durumunu ekle (eğer kullanıcı varsa)
  if (user && sortedDecks.length > 0) {
    try {
      const deckIds = sortedDecks.map(deck => deck.id);
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (!favoriteError && favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        sortedDecks.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
      sortedDecks.forEach(deck => {
        deck.is_favorite = false;
      });
    }
  } else if (sortedDecks) {
    sortedDecks.forEach(deck => {
      deck.is_favorite = false;
    });
  }

  return sortedDecks;
};

// Yeni eklenen desteleri getir
export const getNewDecks = async (limit = 20) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: allDecks, error: decksError } = await supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
    .or('is_shared.eq.true,is_admin_created.eq.true')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (decksError) {
    console.error('Error fetching new decks:', decksError);
    throw decksError;
  }

  if (!allDecks || allDecks.length === 0) {
    return [];
  }

  // Favori durumunu ekle (eğer kullanıcı varsa)
  if (user && allDecks.length > 0) {
    try {
      const deckIds = allDecks.map(deck => deck.id);
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (!favoriteError && favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        allDecks.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
      allDecks.forEach(deck => {
        deck.is_favorite = false;
      });
    }
  } else if (allDecks) {
    allDecks.forEach(deck => {
      deck.is_favorite = false;
    });
  }

  return allDecks;
};

// En çok favorilenen desteleri getir (zaman bazlı filtreleme ile)
// timeFilter: 'today' | 'week' | 'month' | 'year' | 'all'
export const getMostFavoritedDecks = async (limit = 20, timeFilter = 'all') => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Paylaşılmış/admin destelerini al
  const { data: allDecks, error: decksError } = await supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
    .or('is_shared.eq.true,is_admin_created.eq.true');

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    throw decksError;
  }

  if (!allDecks || allDecks.length === 0) {
    return [];
  }

  // 2. Batch sorgu ile tüm favori sayılarını al
  const deckIds = allDecks.map(d => d.id);
  
  // Zaman bazlı filtreleme için tarih hesapla
  let startDate = null;
  if (timeFilter !== 'all') {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  // Tüm favorileri tek sorguda al
  let favoriteQuery = supabase
    .from('favorite_decks')
    .select('deck_id')
    .in('deck_id', deckIds);
  
  if (startDate) {
    favoriteQuery = favoriteQuery.gte('created_at', startDate.toISOString());
  }
  
  const { data: favoriteData } = await favoriteQuery;

  // Favori sayılarını hesapla
  const favoriteCountsByDeck = {};
  if (favoriteData) {
    favoriteData.forEach(fav => {
      favoriteCountsByDeck[fav.deck_id] = (favoriteCountsByDeck[fav.deck_id] || 0) + 1;
    });
  }

  // Her deck için favori sayısını ekle
  const decksWithFavorites = allDecks.map(deck => ({
    ...deck,
    favorite_count: favoriteCountsByDeck[deck.id] || 0,
  }));

  // 3. Favori sayısına göre sırala ve limit uygula
  const sortedDecks = decksWithFavorites
    .sort((a, b) => b.favorite_count - a.favorite_count)
    .slice(0, limit);

  // 4. Favori durumunu ekle
  if (user && sortedDecks.length > 0) {
    try {
      const deckIds = sortedDecks.map(deck => deck.id);
      const { data: favoriteData } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        sortedDecks.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
    }
  }

  return sortedDecks;
};

// En çok başlatılan desteleri getir (zaman bazlı filtreleme ile)
// timeFilter: 'today' | 'week' | 'month' | 'year' | 'all'
export const getMostStartedDecks = async (limit = 20, timeFilter = 'all') => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Paylaşılmış/admin destelerini al
  const { data: allDecks, error: decksError } = await supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
    .or('is_shared.eq.true,is_admin_created.eq.true');

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    throw decksError;
  }

  if (!allDecks || allDecks.length === 0) {
    return [];
  }

  // 2. Batch sorgu ile tüm başlatma sayılarını al
  const deckIds = allDecks.map(d => d.id);
  
  // Zaman bazlı filtreleme için tarih hesapla
  let startDate = null;
  if (timeFilter !== 'all') {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  // Tüm stats'leri tek sorguda al
  let statsQuery = supabase
    .from('decks_stats')
    .select('deck_id')
    .in('deck_id', deckIds);
  
  if (startDate) {
    statsQuery = statsQuery.gte('started_at', startDate.toISOString());
  }
  
  const { data: statsData } = await statsQuery;

  // Başlatma sayılarını hesapla
  const startsCountsByDeck = {};
  if (statsData) {
    statsData.forEach(stat => {
      startsCountsByDeck[stat.deck_id] = (startsCountsByDeck[stat.deck_id] || 0) + 1;
    });
  }

  // Her deck için başlatma sayısını ekle
  const decksWithStarts = allDecks.map(deck => ({
    ...deck,
    total_starts_count: startsCountsByDeck[deck.id] || 0,
  }));

  // 3. Toplam başlatma sayısına göre sırala ve limit uygula
  const sortedDecks = decksWithStarts
    .sort((a, b) => b.total_starts_count - a.total_starts_count)
    .slice(0, limit);

  // 4. Favori durumunu ekle
  if (user && sortedDecks.length > 0) {
    try {
      const deckIds = sortedDecks.map(deck => deck.id);
      const { data: favoriteData } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        sortedDecks.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
    }
  }

  return sortedDecks;
};

// En çok farklı kişi tarafından başlatılan desteleri getir (zaman bazlı filtreleme ile)
// timeFilter: 'today' | 'week' | 'month' | 'year' | 'all'
export const getMostUniqueStartedDecks = async (limit = 20, timeFilter = 'all') => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. Paylaşılmış/admin destelerini al
  const { data: allDecks, error: decksError } = await supabase
    .from('decks')
    .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
    .or('is_shared.eq.true,is_admin_created.eq.true');

  if (decksError) {
    console.error('Error fetching decks:', decksError);
    throw decksError;
  }

  if (!allDecks || allDecks.length === 0) {
    return [];
  }

  // 2. Batch sorgular ile unique başlatma sayılarını al
  const deckIds = allDecks.map(d => d.id);
  
  // Önce tüm card'ları al
  const { data: allCards } = await supabase
    .from('cards')
    .select('id, deck_id')
    .in('deck_id', deckIds);
  
  const allCardIds = allCards?.map(c => c.id) || [];
  
  // Zaman bazlı filtreleme için tarih hesapla
  let startDate = null;
  if (timeFilter !== 'all') {
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
  }

  // Tüm progress verilerini tek sorguda al
  let progressQuery = supabase
    .from('user_card_progress')
    .select('card_id, user_id')
    .in('card_id', allCardIds);
  
  if (startDate) {
    progressQuery = progressQuery.gte('created_at', startDate.toISOString());
  }
  
  const { data: progressData } = await progressQuery;

  // Card'ları deck_id'ye göre grupla
  const cardsByDeck = {};
  if (allCards) {
    allCards.forEach(card => {
      if (!cardsByDeck[card.deck_id]) {
        cardsByDeck[card.deck_id] = [];
      }
      cardsByDeck[card.deck_id].push(card.id);
    });
  }

  // Progress verilerini card_id'ye göre grupla
  const progressByCard = {};
  if (progressData) {
    progressData.forEach(progress => {
      if (!progressByCard[progress.card_id]) {
        progressByCard[progress.card_id] = new Set();
      }
      progressByCard[progress.card_id].add(progress.user_id);
    });
  }

  // Her deck için unique başlatma sayısını hesapla
  const decksWithUniqueStarts = allDecks.map(deck => {
    const cardIds = cardsByDeck[deck.id] || [];
    const allUsers = new Set();
    
    cardIds.forEach(cardId => {
      if (progressByCard[cardId]) {
        progressByCard[cardId].forEach(userId => allUsers.add(userId));
      }
    });

    return {
      ...deck,
      unique_started_count: allUsers.size,
    };
  });

  // 3. Unique başlatma sayısına göre sırala ve limit uygula
  const sortedDecks = decksWithUniqueStarts
    .sort((a, b) => b.unique_started_count - a.unique_started_count)
    .slice(0, limit);

  // 4. Favori durumunu ekle
  if (user && sortedDecks.length > 0) {
    try {
      const deckIds = sortedDecks.map(deck => deck.id);
      const { data: favoriteData } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', user.id)
        .in('deck_id', deckIds);
      
      if (favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        sortedDecks.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
    }
  }

  return sortedDecks;
};