import { supabase } from '../lib/supabase';
import { getCachedBlockedAndHidden, filterDecksByBlockAndHide } from './BlockService';
import { invalidateCache, cacheData, getCachedData, CACHE_DURATIONS } from './CacheService';
import { getFavoriteDeckIds } from './FavoriteService';

const DECK_LIST_SELECT = 'id, name, to_name, description, card_count, user_id, category_id, is_shared, is_admin_created, shared_at, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order), decks_languages(language_id)';

// Oluşturma/güncelleme sonrası dönüş için kullanılan select (tekil deck).
const DECK_SELECT_SINGLE = 'id, name, to_name, description, card_count, user_id, category_id, is_shared, is_admin_created, shared_at, updated_at, created_at, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)';

export const getDecksByCategory = async (userId, category, options = false) => {
  // options hem eski boolean forceRefresh çağrılarını hem de yeni { forceRefresh, page, limit } yapısını destekler
  let forceRefresh = false;
  let page = 0;
  let limit;
  let searchQuery = '';
  let sortBy = 'default';
  let categorySortOrders = [];
  let languageIds = [];
  let favoritesOnly = false;

  if (typeof options === 'boolean') {
    forceRefresh = options;
  } else if (options && typeof options === 'object') {
    forceRefresh = options.forceRefresh ?? false;
    page = options.page ?? 0;
    limit = options.limit;
    searchQuery = (options.searchQuery || '').trim();
    sortBy = options.sortBy || 'default';
    categorySortOrders = Array.isArray(options.categorySortOrders) ? options.categorySortOrders : [];
    languageIds = Array.isArray(options.languageIds) ? options.languageIds : [];
    favoritesOnly = Boolean(options.favoritesOnly);
  }

  if (category === 'myDecks' && userId && !forceRefresh) {
    const cached = await getCachedData(`mydecks_${userId}`, CACHE_DURATIONS.MY_DECKS);
    if (cached && !cached.isStale) return cached.data;
  }

  if (category === 'inProgressDecks') {
    if (!userId) {
      return [];
    }
    const { data: statsData, error: statsError } = await supabase
      .from('decks_stats')
      .select('deck_id, started_at')
      .eq('user_id', userId);
    if (statsError) {
      console.error('Error fetching decks_stats:', statsError);
      return [];
    }

    if (!statsData || statsData.length === 0) {
      return [];
    }

    // deck_id başına en son started_at (MAX)
    const lastStartedAtByDeck = {};
    statsData.forEach((row) => {
      const t = new Date(row.started_at || 0).getTime();
      if (!lastStartedAtByDeck[row.deck_id] || lastStartedAtByDeck[row.deck_id] < t) {
        lastStartedAtByDeck[row.deck_id] = t;
      }
    });
    const deckIds = Object.keys(lastStartedAtByDeck);

    const { data, error } = await supabase
      .from('decks')
      .select(DECK_LIST_SELECT)
      .in('id', deckIds);

    if (error) {
      console.error(`Error fetching ${category} decks:`, error);
      return [];
    }

    let resultData = data || [];
    const [blockedIds, hiddenIds] = await getCachedBlockedAndHidden(userId);
    resultData = filterDecksByBlockAndHide(resultData, blockedIds, hiddenIds);

    // En son çalışılan en üstte sırala
    resultData.sort((a, b) => (lastStartedAtByDeck[b.id] || 0) - (lastStartedAtByDeck[a.id] || 0));

    // Favori durumunu ekle
    if (userId && resultData.length > 0) {
      try {
        const favoriteDeckIds = resultData.map(deck => deck.id);
        const { data: favoriteData, error: favoriteError } = await supabase
          .from('favorite_decks')
          .select('deck_id')
          .eq('user_id', userId)
          .in('deck_id', favoriteDeckIds);

        if (!favoriteError && favoriteData) {
          const favoriteDeckIdSet = new Set(favoriteData.map(f => f.deck_id));
          resultData.forEach(deck => {
            deck.is_favorite = favoriteDeckIdSet.has(deck.id);
          });
        }
      } catch (e) {
        console.error('Error fetching favorite status:', e);
        resultData.forEach(deck => {
          deck.is_favorite = false;
        });
      }
    } else if (resultData.length > 0) {
      resultData.forEach(deck => {
        deck.is_favorite = false;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLocaleLowerCase();
      resultData = resultData.filter((deck) =>
        (deck.name || '').toLocaleLowerCase().includes(q) ||
        (deck.to_name || '').toLocaleLowerCase().includes(q)
      );
    }

    if (categorySortOrders.length > 0) {
      const allowed = new Set(categorySortOrders);
      resultData = resultData.filter((d) => d.categories?.sort_order != null && allowed.has(d.categories.sort_order));
    }

    if (languageIds.length > 0) {
      const langSet = new Set(languageIds);
      resultData = resultData.filter((d) => (d.decks_languages || []).some((dl) => langSet.has(dl.language_id)));
    }

    if (favoritesOnly) {
      resultData = resultData.filter((d) => d.is_favorite === true);
    }

    if (sortBy === 'az') {
      resultData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // inProgressDecks için sayfalama: slice ile uygula
    if (typeof limit === 'number' && limit > 0) {
      const start = page * limit;
      const end = start + limit;
      resultData = resultData.slice(start, end);
    }

    return resultData;
  }

  // Diğer kategoriler için mevcut mantık
  let query = supabase
    .from('decks')
    .select(DECK_LIST_SELECT);

  switch (category) {
    case 'myDecks':
      query = query
        .eq('user_id', userId)
        .eq('is_admin_created', false)
        .order('updated_at', { ascending: false });
      break;
    case 'defaultDecks':
      query = query
        .eq('is_admin_created', true)
        .order('updated_at', { ascending: false });
      break;
    case 'communityDecks':
      query = query
        .eq('is_shared', true)
        .eq('is_admin_created', false)
        .order('shared_at', { ascending: false });
      break;
  }

  const searchLike = searchQuery
    ? `%${searchQuery.replace(/%/g, '').replace(/_/g, '').replace(/\\/g, '').replace(/"/g, '')}%`
    : null;
  if (searchLike) {
    query = query.or(`name.ilike."${searchLike}",to_name.ilike."${searchLike}"`);
  }

  if (categorySortOrders.length > 0) {
    const { data: categoryRows, error: categoryErr } = await supabase
      .from('categories')
      .select('id')
      .in('sort_order', categorySortOrders);
    if (categoryErr) throw categoryErr;
    const categoryIds = (categoryRows || []).map((r) => r.id);
    if (categoryIds.length === 0) return [];
    query = query.in('category_id', categoryIds);
  }

  if (languageIds.length > 0) {
    const { data: deckLangRows, error: deckLangErr } = await supabase
      .from('decks_languages')
      .select('deck_id')
      .in('language_id', languageIds);
    if (deckLangErr) throw deckLangErr;
    const deckIds = Array.from(new Set((deckLangRows || []).map((r) => r.deck_id)));
    if (deckIds.length === 0) return [];
    query = query.in('id', deckIds);
  }

  // Sayfalama: limit belirtilmişse Supabase range kullan
  if (typeof limit === 'number' && limit > 0) {
    const from = page * limit;
    query = query.range(from, from + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching ${category} decks:`, error);
    throw error;
  }

  let resultData = data || [];
  if ((category === 'communityDecks' || category === 'defaultDecks') && userId) {
    const [blockedIds, hiddenIds] = await getCachedBlockedAndHidden(userId);
    resultData = filterDecksByBlockAndHide(resultData, blockedIds, hiddenIds);
  }

  // Favori durumunu ekle (eğer kullanıcı varsa)
  if (userId && resultData.length > 0) {
    try {
      const deckIds = resultData.map(deck => deck.id);
      const { data: favoriteData, error: favoriteError } = await supabase
        .from('favorite_decks')
        .select('deck_id')
        .eq('user_id', userId)
        .in('deck_id', deckIds);

      if (!favoriteError && favoriteData) {
        const favoriteDeckIds = new Set(favoriteData.map(f => f.deck_id));
        resultData.forEach(deck => {
          deck.is_favorite = favoriteDeckIds.has(deck.id);
        });
      }
    } catch (e) {
      console.error('Error fetching favorite status:', e);
      resultData.forEach(deck => {
        deck.is_favorite = false;
      });
    }
  } else if (resultData.length > 0) {
    resultData.forEach(deck => {
      deck.is_favorite = false;
    });
  }

  if (favoritesOnly) {
    resultData = resultData.filter((deck) => deck.is_favorite === true);
  }

  if (sortBy === 'az') {
    resultData = [...resultData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  if (category === 'myDecks' && userId) {
    await cacheData(`mydecks_${userId}`, resultData);
  }

  return resultData;
};

// Kullanıcı bir destede çalışmaya başladığında is_started alanını true yapar
export const setDeckStarted = async (userId, deckId) => {
  const { error } = await supabase
    .from('decks')
    .update({ is_started: true })
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const getDecks = async () => {
  const { data, error } = await supabase
    .from('decks')
    .select(DECK_LIST_SELECT);

  if (error) throw error;
  return data || [];
};

/**
 * Tekil deste detayını döndürür. 4 saat cache (mutation: düzenleme/silme/paylaşımda invalidate).
 */
export const getDeckById = async (deckId, forceRefresh = false) => {
  const cacheKey = `deck_detail_${deckId}`;
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.DECK_DETAIL);
    if (cached && !cached.isStale) return cached.data;
  }
  const { data, error } = await supabase
    .from('decks')
    .select(DECK_LIST_SELECT)
    .eq('id', deckId)
    .single();
  if (error) throw error;
  if (data) await cacheData(cacheKey, data);
  return data;
};

export const deleteDeck = async (deckId) => {
  try {
    // 1. Desteye ait kartların sadece 'image' sütununu çekiyoruz.
    // .not('image', 'is', null) ile sadece görseli olan kartları getirerek performansı artırıyoruz.
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('image')
      .eq('deck_id', deckId) // 'deck_id' sütun adını kendi veritabanına göre kontrol et
      .not('image', 'is', null);

    if (cardsError) throw cardsError;

    // 2. Tam URL'leri parçalayıp Supabase'in istediği dosya yollarına (path) çeviriyoruz.
    const imagePaths = cards
      .filter(card => card.image)
      .map(card => {
        // Örnek URL: https://[proje].supabase.co/storage/v1/object/public/images/kartlar/resim.jpg
        // split('/images/') yaptığımızda dizinin 2. elemanı (index 1) 'kartlar/resim.jpg' olur.
        const urlParts = card.image.split('/images/');
        return urlParts.length > 1 ? urlParts[1] : null;
      })
      .filter(path => path !== null); // Olası hatalı parçalamaları diziden çıkarıyoruz

    // 3. Eğer silinecek görsel yolu varsa, 'images' bucket'ından topluca siliyoruz.
    if (imagePaths.length > 0) {
      const { error: storageError } = await supabase
        .storage
        .from('images') // Senin belirttiğin bucket adı
        .remove(imagePaths);

      if (storageError) {
        console.error("Görseller storage'dan silinirken hata:", storageError);
        // Not: Görseller silinemese bile desteyi silmek istersen burayı böyle bırakabilirsin.
      }
    }

    // 4. Desteyi veritabanından siliyoruz (Senin mevcut kodun)
    const { error: deleteError } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);

    if (deleteError) throw deleteError;

    // 5. Önbelleği (Cache) temizliyoruz
    await invalidateCache(`deck_detail_${deckId}`);
    await invalidateCache(`cards_deck_${deckId}`);
    await invalidateCache('mydecks_');

  } catch (error) {
    console.error("Deste silme işlemi başarısız:", error);
    throw error;
  }
};

export const updateDeckShare = async (deckId, userId, isShared) => {
  const { error } = await supabase
    .from('decks')
    .update({ is_shared: isShared, updated_at: new Date().toISOString() })
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
  await invalidateCache(`deck_detail_${deckId}`);
  await invalidateCache(`mydecks_${userId}`);
};

export const insertDeckStats = async (deckId, userId) => {
  const { error } = await supabase
    .from('decks_stats')
    .insert({
      deck_id: deckId,
      user_id: userId,
      started_at: new Date().toISOString(),
    });
  if (error) throw error;
};

/**
 * Yeni deste oluşturur. decks insert + decks_languages insert yapar.
 * @param {string} userId - Oluşturan kullanıcı id
 * @param {Object} payload - name, to_name?, description?, category_id, languageIds (uuid[])
 * @returns {Promise<Object>} Oluşturulan deck (profiles, categories ile)
 */
export const createDeck = async (userId, payload) => {
  const { name, to_name, description, category_id, languageIds = [] } = payload;
  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: userId,
      name: (name || '').trim(),
      to_name: (to_name || '').trim() || null,
      description: (description || '').trim() || null,
      category_id: category_id || null,
      is_shared: false,
      is_admin_created: false,
      card_count: 0,
      is_started: false,
    })
    .select(DECK_SELECT_SINGLE)
    .single();
  if (error) throw error;

  if (languageIds.length > 0) {
    const relations = languageIds.map((languageId) => ({
      deck_id: data.id,
      language_id: languageId,
    }));
    const { error: deckLangError } = await supabase
      .from('decks_languages')
      .insert(relations);
    if (deckLangError) throw deckLangError;
  }

  await invalidateCache(`mydecks_${userId}`);
  return data;
};

/**
 * Deste bilgilerini ve dil ilişkilerini günceller. decks update + decks_languages delete + insert.
 * @param {string} deckId - Deste id
 * @param {string} userId - Deste sahibi kullanıcı id (yetki/cache için)
 * @param {Object} payload - name, to_name?, description?, category_id, languageIds (uuid[])
 */
export const updateDeck = async (deckId, userId, payload) => {
  const { name, to_name, description, category_id, languageIds = [] } = payload;
  const { error } = await supabase
    .from('decks')
    .update({
      name: (name || '').trim(),
      to_name: (to_name || '').trim() || null,
      description: (description || '').trim() || null,
      category_id: category_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deckId);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('decks_languages')
    .delete()
    .eq('deck_id', deckId);
  if (deleteError) throw deleteError;

  if (languageIds.length > 0) {
    const relations = languageIds.map((languageId) => ({
      deck_id: deckId,
      language_id: languageId,
    }));
    const { error: deckLangError } = await supabase
      .from('decks_languages')
      .insert(relations);
    if (deckLangError) throw deckLangError;
  }

  await invalidateCache(`deck_detail_${deckId}`);
  await invalidateCache(`mydecks_${userId}`);
};

/**
 * Bir desteye ait dil id listesini döndürür (decks_languages tablosundan).
 * @param {string} deckId - Deste id
 * @returns {Promise<string[]>} language_id listesi
 */
export const getDeckLanguages = async (deckId) => {
  const { data, error } = await supabase
    .from('decks_languages')
    .select('language_id')
    .eq('deck_id', deckId);
  if (error) throw error;
  return (data || []).map((row) => row.language_id);
};

const TAB_TO_SORT_BY = {
  trend: 'popular',
  favorites: 'favorites',
  starts: 'starts',
  unique: 'unique_starts',
  new: 'new',
};

const transformRpcDeck = (d) => ({
  id: d.id,
  name: d.name,
  to_name: d.to_name,
  description: d.description,
  card_count: d.card_count,
  user_id: d.user_id,
  category_id: d.category_id,
  is_shared: d.is_shared,
  is_admin_created: d.is_admin_created,
  created_at: d.created_at,
  updated_at: d.updated_at,
  profiles: { username: d.profile_username, image_url: d.profile_image_url },
  categories: { id: d.category_id, name: d.category_name, sort_order: d.category_sort_order },
  decks_languages: (d.language_ids || []).map(id => ({ language_id: id })),
  popularity_score: d.popularity_score,
  favorite_count: d.favorite_count,
});

export const getDiscoverDecks = async (userId, tab = 'trend', timeFilter = 'all', limit = 50, forceRefresh = false) => {
  const sortBy = TAB_TO_SORT_BY[tab] || 'popular';
  const cacheKey = `discover_${tab}_${timeFilter}`;

  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey, CACHE_DURATIONS.DISCOVER);
    if (cached && !cached.isStale) {
      const favIds = new Set(await getFavoriteDeckIds(userId));
      return cached.data.map(d => ({ ...d, is_favorite: favIds.has(d.id) }));
    }
  }

  const [blockedIds, hiddenIds] = await getCachedBlockedAndHidden(userId);

  const { data, error } = await supabase.rpc('get_discover_decks', {
    p_sort_by: sortBy,
    p_time_filter: timeFilter,
    p_limit: limit,
    p_excluded_user_ids: Array.from(blockedIds),
    p_excluded_deck_ids: Array.from(hiddenIds),
  });
  if (error) throw error;

  const decks = (data || []).map(transformRpcDeck);
  await cacheData(cacheKey, decks);

  const favIds = new Set(await getFavoriteDeckIds(userId));
  return decks.map(d => ({ ...d, is_favorite: favIds.has(d.id) }));
};