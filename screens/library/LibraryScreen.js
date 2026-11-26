import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Alert, Animated, ScrollView, Image, Keyboard, useWindowDimensions, Platform } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { typography } from '../../theme/typography';
import { getDecksByCategory, deleteDeck, getLibrarySummary } from '../../services/DeckService';
import { deleteCard, getUserCardProgressForCards } from '../../services/CardService';
import { Iconify } from 'react-native-iconify';
import { getFavoriteDecks, getFavoriteCards, addFavoriteDeck, removeFavoriteDeck, addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { BottomSheetModal, BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
// Full-height native sheet.
const LARGE_SNAP_POINTS = ['100%'];
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import LibraryHeader from '../../components/layout/LibraryHeader';

// Native-driven page scroll events → smooth segmented control / header.
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardListItem from '../../components/lists/CardList';
import LottieView from 'lottie-react-native';
import DeckList from '../../components/lists/DeckList';
import MyDecksSkeleton from '../../components/skeleton/MyDecksSkeleton';
import CardDetailView from '../../components/layout/CardDetailView';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ProfileAvatarButton from '../../components/layout/ProfileAvatarButton';
import { getLanguages, languagesInUse } from '../../services/LanguageService';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

// Fade efekti - karakter bazlı opacity (MaskedView sorunlarından kaçınır)
const FadeText = ({ text, style, maxChars = 15 }) => {
  if (!text) return null;

  const shouldFade = text.length > maxChars;

  if (!shouldFade) {
    return <Text style={style} numberOfLines={1}>{text}</Text>;
  }

  // Son 4 karaktere fade uygula
  const fadeLength = 4;
  const visibleLength = maxChars - fadeLength;
  const visibleText = text.substring(0, visibleLength);
  const fadeText = text.substring(visibleLength, maxChars);

  // Her fade karakteri için azalan opacity
  const opacities = [0.7, 0.5, 0.3, 0.1];

  // Style'dan textAlign kontrolü
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style || {});
  const isCentered = flatStyle.textAlign === 'center';

  return (
    <View style={{ flexDirection: 'row', overflow: 'hidden', justifyContent: isCentered ? 'center' : 'flex-start', alignSelf: isCentered ? 'center' : 'flex-start' }}>
      <Text style={style} numberOfLines={1}>{visibleText}</Text>
      {fadeText.split('').map((char, index) => (
        <Text
          key={index}
          style={[style, { opacity: opacities[index] || 0.1 }]}
        >
          {char}
        </Text>
      ))}
    </View>
  );
};

const MY_DECKS_SEARCH_THRESHOLD = 10;
// The pager is pulled up under the hero by this much (same as Discover) so list
// content scrolls behind the hero's rounded bottom corners. Lists add it back
// as top padding and offset their refresh spinner by it.
// The hero is part of the page now (no card surface), so the pager no longer
// tucks under it.
const HERO_OVERLAP = 0;

/** Aynı ekranda inline fonksiyon kullanılırsa her render'da yeni component tipi oluşur; liste yenilenince header (Image) yeniden mount olur. */
const MyDecksListHeaderCard = React.memo(function MyDecksListHeaderCard({
  cardBackground,
  cardBorder,
  textColor,
  mutedColor,
  searchTopMargin,
  query,
  onQueryChange,
  onOpenFilter,
}) {
  const { t } = useTranslation();
  // Intro text + illustration now live in the LibraryHeader hero; the list
  // header only carries search + filter.
  return (
    <View style={myDecksListHeaderStyles.myDecksCardContainer}>
      <View style={[myDecksListHeaderStyles.myDecksSearchContainer, { marginTop: searchTopMargin }]}>
        <SearchBar
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('common.searchPlaceholder', 'Destelerde ara...')}
          style={{ flex: 1 }}
        />
        <FilterModalButton onPress={onOpenFilter} />
      </View>
    </View>
  );
});



export default function LibraryScreen() {
  const { colors, isDarkMode } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigation = useNavigation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const listBottomInset = useListBottomInset();
  const [activeTab, setActiveTab] = useState('myDecks');
  const [myDecks, setMyDecks] = useState([]);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [myDecksRefreshing, setMyDecksRefreshing] = useState(false);
  const [favoritesFetched, setFavoritesFetched] = useState(false);
  const [activeDeckMenuId, setActiveDeckMenuId] = useState(null);
  const { t } = useTranslation();
  const pagerRef = useRef(null);
  // Pager scroll position (native driver): progress = position + offset,
  // 0 -> MyDecks, 1 -> Favorites. Drives the header + segmented control.
  const pagePosition = useRef(new Animated.Value(0)).current;
  const pageOffset = useRef(new Animated.Value(0)).current;
  const pagerProgress = useMemo(() => Animated.add(pagePosition, pageOffset), [pagePosition, pageOffset]);
  const onPageScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { position: pagePosition, offset: pageOffset } }],
    { useNativeDriver: true }
  ), [pagePosition, pageOffset]);
  const [favSlideIndex, setFavSlideIndex] = useState(0);
  const [favCardsQuery, setFavCardsQuery] = useState('');
  const [favCardsSort, setFavCardsSort] = useState('original');
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [favoriteCardIds, setFavoriteCardIds] = useState([]);
  // Hero summary ("12 deste · 32 kart"): real counts from the server, refreshed
  // when the loaded lists change size (create/delete/favourite) and on focus.
  const [librarySummary, setLibrarySummary] = useState(null);
  const [myDecksQuery, setMyDecksQuery] = useState('');
  const [myDecksSort, setMyDecksSort] = useState('default');
  const [myDecksSelectedCategories, setMyDecksSelectedCategories] = useState([]);
  const [myDecksFilterModalVisible, setMyDecksFilterModalVisible] = useState(false);
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [allLanguages, setAllLanguages] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  // MyDecks sayfalama durumu
  const [myDecksPage, setMyDecksPage] = useState(0);
  const [myDecksHasMore, setMyDecksHasMore] = useState(true);
  const [myDecksLoadingMore, setMyDecksLoadingMore] = useState(false);

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();

  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (width - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

  // The header is now a normal (non-overlay) block above the pager, so the
  // pages only need a small top gap instead of clearing an absolute overlay.
  const favoritesScrollViewPaddingTop = HERO_OVERLAP + 4; // same top as Destelerim
  const myDecksListPaddingTop = HERO_OVERLAP + 4;

  const myDecksSearchContainerTopMargin = 8;

  const favoriteSliderDimensions = useMemo(() => {
    const sliderHeight = height * 0.27;
    const basePadding = 16;

    return {
      sliderHeight,
      fontSize: 20,
      dividerMargin: 5,
      padding: basePadding,
      profileBottomPadding: basePadding * 0.7,
      profileLeftPadding: basePadding * 0.7,
      favoriteButtonTopPadding: basePadding * 0.7,
      favoriteButtonRightPadding: basePadding * 0.7,
      badgeBottomPadding: basePadding * 0.7,
      badgeRightPadding: basePadding * 0.5,
      profileAvatarSize: 36,
      profileUsernameSize: 16,
      badgeIconSize: 20,
      badgeTextSize: 18,
      favoriteButtonSize: 26,
      favoriteButtonPadding: 8,
      categoryIconSize: 150,
      categoryIconLeft: -70,
    };
  }, [height]);

  // Gorhom Bottom Sheet Referansı
  const cardDetailSheetRef = useRef(null);

  // Modal görünürlük kontrolü
  useEffect(() => {
    if (cardDetailModalVisible) {
      cardDetailSheetRef.current?.present();
    } else {
      cardDetailSheetRef.current?.dismiss();
    }
  }, [cardDetailModalVisible]);

  // Kategoriye göre renkleri al (Supabase sort_order kullanarak)
  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    // Varsayılan renkler (Tarih kategorisi - sort_order: 4)
    return ['#6F8EAD', '#3F5E78'];
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill", // Dil
      2: "clarity:atom-solid", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "streamline-ultimate:module-puzzle-2-bold" // Genel Kültür
    };
    return icons[sortOrder] || "material-symbols:category";
  };

  // Search and filter removed

  const MY_DECKS_PAGE_SIZE = 50;
  const FAVORITE_DECKS_PAGE_SIZE = 50;

  const handleSetPage = (pageIndex) => {
    if (pagerRef.current && typeof pagerRef.current.setPage === 'function') {
      pagerRef.current.setPage(pageIndex);
    }
    // activeTab is updated in onPageSelected (after the page settles) so the
    // whole screen doesn't re-render while the pager is animating.
  };

  const fetchMyDecks = useCallback(
    async (forceRefresh = false) => {
      if (!userId) {
        setMyDecks([]);
        setLoading(false);
        setMyDecksRefreshing(false);
        setMyDecksPage(0);
        setMyDecksHasMore(false);
        return;
      }

      if (forceRefresh) {
        setMyDecksRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const decks = await getDecksByCategory(userId, 'myDecks', {
          page: 0,
          limit: MY_DECKS_PAGE_SIZE,
          forceRefresh,
        });
        const safeDecks = decks || [];
        setMyDecks(safeDecks);
        setMyDecksPage(0);
        setMyDecksHasMore(safeDecks.length >= MY_DECKS_PAGE_SIZE);
      } catch (e) {
        setMyDecks([]);
        setMyDecksHasMore(false);
      } finally {
        if (forceRefresh) {
          setMyDecksRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchMyDecks(false);
  }, [fetchMyDecks]);

  // Favorilerim sekmesine geçildiğinde veri yoksa (veya henüz gelmediyse) yükle
  useEffect(() => {
    if (activeTab === 'favorites' && !favoritesFetched && userId) {
      fetchFavorites();
    }
  }, [activeTab, favoritesFetched, userId]);

  const FAVORITE_CARDS_PAGE_SIZE = 20;
  const fetchFavorites = async (silent = false, forceRefresh = false, sortOverride = null) => {
    if (!userId) return;
    const currentSort = sortOverride ?? favCardsSort;
    if (!silent) setFavoritesLoading(true);
    try {
      const decks = await getFavoriteDecks(userId, {
        page: 0,
        limit: FAVORITE_DECKS_PAGE_SIZE,
        forceRefresh,
      });
      // is_admin_created kontrolü - tüm kategoriler için geçerli
      const modifiedDecks = (decks || []).map((deck) => {
        if (deck.is_admin_created) {
          return {
            ...deck,
            profiles: {
              ...deck.profiles,
              username: 'Knowia',
              image_url: null, // app_icon.png kullanılacak
            },
          };
        }
        return deck;
      });
      setFavoriteDecks(modifiedDecks);

      const sortBy = ['original', 'az'].includes(currentSort) ? currentSort : 'original';
      const filter = ['learned', 'unlearned'].includes(currentSort) ? currentSort : null;
      const cards = await getFavoriteCards(userId, 0, FAVORITE_CARDS_PAGE_SIZE, forceRefresh, sortBy, filter);
      const cardIds = (cards || []).map(c => c.id);
      const statusMap = await getUserCardProgressForCards(userId, cardIds);

      const cardsWithProgress = (cards || []).map(card => ({
        ...card,
        status: statusMap[card.id] || 'new'
      }));

      setFavoriteCards(cardsWithProgress);
      setFavoriteCardIds(cardsWithProgress.map(card => card.id));
      setFavoritesFetched(true);
    } catch (e) {
      setFavoriteDecks([]);
      setFavoriteCards([]);
      setFavoriteCardIds([]);
    } finally {
      if (!silent) setFavoritesLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (favoritesFetched) {
        fetchFavorites(true);
      }
    }, [favoritesFetched])
  );

  // Deck creation now starts from this screen (CreateDeck stack screen), so
  // re-read "my decks" silently when coming back. createDeck/delete invalidate
  // the mydecks cache, so this hits the network only when something changed.
  const hasFocusedOnceRef = useRef(false);
  const myDecksPageRef = useRef(0);
  myDecksPageRef.current = myDecksPage;
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      if (!userId || myDecksPageRef.current > 0) return;
      let cancelled = false;
      getDecksByCategory(userId, 'myDecks', { page: 0, limit: MY_DECKS_PAGE_SIZE })
        .then((decks) => {
          if (cancelled || !decks) return;
          setMyDecks(decks);
          setMyDecksHasMore(decks.length >= MY_DECKS_PAGE_SIZE);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [userId])
  );

  // Favoriler sekmesindeki birleşik liste kaldırıldı

  // Favorilerim sekmesindeki birleşik render kaldırıldı

  // Favori deste ekleme/çıkarma fonksiyonları
  const handleAddFavoriteDeck = useCallback(async (deckId) => {
    if (!userId) return;
    setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, is_favorite: true } : d));
    const deckToAdd = myDecks.find(d => d.id === deckId);
    if (deckToAdd) {
      const modified = deckToAdd.is_admin_created
        ? { ...deckToAdd, is_favorite: true, favorited_at: new Date().toISOString(), profiles: { ...deckToAdd.profiles, username: 'Knowia', image_url: null } }
        : { ...deckToAdd, is_favorite: true, favorited_at: new Date().toISOString() };
      setFavoriteDecks(prev => [modified, ...prev]);
    }
    try {
      await addFavoriteDeck(userId, deckId);
    } catch (e) {
      setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, is_favorite: false } : d));
      if (deckToAdd) setFavoriteDecks(prev => prev.filter(d => d.id !== deckId));
    }
  }, [userId, myDecks]);

  const handleRemoveFavoriteDeck = useCallback(async (deckId) => {
    if (!userId) return;
    setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, is_favorite: false } : d));
    const removedDeck = favoriteDecks.find(d => d.id === deckId);
    setFavoriteDecks(prev => prev.filter(d => d.id !== deckId));
    try {
      await removeFavoriteDeck(userId, deckId);
    } catch (e) {
      setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, is_favorite: true } : d));
      if (removedDeck) setFavoriteDecks(prev => [removedDeck, ...prev]);
    }
  }, [userId, favoriteDecks]);


  // Kart silme fonksiyonu (favorite cards için)
  const handleDeleteCard = async (cardId) => {
    Alert.alert(
      t('cardDetail.deleteConfirmation', 'Kart Silinsin mi?'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        { text: t('cardDetail.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('cardDetail.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(cardId);

              // Kartı favori kartlar listesinden çıkar
              const updatedCards = favoriteCards.filter(c => c.id !== cardId);
              const updatedCardIds = favoriteCardIds.filter(id => id !== cardId);
              setFavoriteCards(updatedCards);
              setFavoriteCardIds(updatedCardIds);

              // Eğer seçili kart silindiyse, modal'ı kapat veya sonraki karta geç
              if (selectedCard && selectedCard.id === cardId) {
                // Güncellenmiş kart listesini filtrele (silinen kart olmadan)
                let remainingCards = updatedCards.slice();
                if (favCardsQuery && favCardsQuery.trim()) {
                  const q = favCardsQuery.toLowerCase();
                  remainingCards = remainingCards.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
                }
                const favAt = (c) => new Date(c.favorited_at || c.created_at || 0).getTime();
                if (favCardsSort === 'az') {
                  remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || '') || favAt(b) - favAt(a));
                } else if (favCardsSort === 'unlearned') {
                  remainingCards = remainingCards.filter(c => c.status !== 'learned');
                  remainingCards.sort((a, b) => favAt(b) - favAt(a));
                } else if (favCardsSort !== 'fav') {
                  remainingCards.sort((a, b) => favAt(b) - favAt(a));
                }

                if (remainingCards.length > 0) {
                  setSelectedCard(remainingCards[0]);
                } else {
                  setCardDetailModalVisible(false);
                  setSelectedCard(null);
                }
              }

              showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinemedi'));
            }
          }
        }
      ]
    );
  };

  // Favori kartlar ve kart işlemleri kaldırıldı
  const handleRemoveFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const removedCard = favoriteCards.find(c => c.id === cardId);
    const updatedCards = favoriteCards.filter(c => c.id !== cardId);
    const updatedIds = favoriteCardIds.filter(id => id !== cardId);
    setFavoriteCards(updatedCards);
    setFavoriteCardIds(updatedIds);

    if (selectedCard && selectedCard.id === cardId && cardDetailModalVisible) {
      const currentIndex = filteredFavoriteCards.findIndex(c => c.id === cardId);
      let remainingCards = updatedCards.slice();
      if (favCardsQuery && favCardsQuery.trim()) {
        const q = favCardsQuery.toLowerCase();
        remainingCards = remainingCards.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
      }
      const favAt = (c) => new Date(c.favorited_at || c.created_at || 0).getTime();
      if (favCardsSort === 'az') {
        remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || '') || favAt(b) - favAt(a));
      } else if (favCardsSort === 'unlearned') {
        remainingCards = remainingCards.filter(c => c.status !== 'learned');
        remainingCards.sort((a, b) => favAt(b) - favAt(a));
      } else if (favCardsSort !== 'fav') {
        remainingCards.sort((a, b) => favAt(b) - favAt(a));
      }

      if (remainingCards.length > 0) {
        let nextCard;
        if (currentIndex >= 0 && currentIndex < remainingCards.length) nextCard = remainingCards[currentIndex];
        else if (currentIndex >= remainingCards.length) nextCard = remainingCards[remainingCards.length - 1];
        else nextCard = remainingCards[0];
        setSelectedCard(nextCard);
      } else {
        setCardDetailModalVisible(false);
        setSelectedCard(null);
      }
    }

    try {
      await removeFavoriteCard(userId, cardId);
    } catch (e) {
      if (removedCard) {
        setFavoriteCards(prev => [...prev, removedCard]);
        setFavoriteCardIds(prev => [...prev, cardId]);
      }
    }
  }, [userId, favoriteCards, favoriteCardIds, selectedCard, cardDetailModalVisible, filteredFavoriteCards, favCardsQuery, favCardsSort]);



  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCardIds.includes(cardId);

    if (wasFavorite) {
      const updatedCards = favoriteCards.filter(c => c.id !== cardId);
      const updatedIds = favoriteCardIds.filter(id => id !== cardId);
      setFavoriteCardIds(updatedIds);
      setFavoriteCards(updatedCards);

      if (selectedCard && selectedCard.id === cardId) {
        const currentIndex = filteredFavoriteCards.findIndex(c => c.id === cardId);
        let remainingCards = updatedCards.slice();
        if (favCardsQuery && favCardsQuery.trim()) {
          const q = favCardsQuery.toLowerCase();
          remainingCards = remainingCards.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
        }
        const favAt = (c) => new Date(c.favorited_at || c.created_at || 0).getTime();
        if (favCardsSort === 'az') {
          remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || '') || favAt(b) - favAt(a));
        } else if (favCardsSort === 'unlearned') {
          remainingCards = remainingCards.filter(c => c.status !== 'learned');
          remainingCards.sort((a, b) => favAt(b) - favAt(a));
        } else if (favCardsSort !== 'fav') {
          remainingCards.sort((a, b) => favAt(b) - favAt(a));
        }

        if (remainingCards.length > 0) {
          let nextCard;
          if (currentIndex >= 0 && currentIndex < remainingCards.length) nextCard = remainingCards[currentIndex];
          else if (currentIndex >= remainingCards.length) nextCard = remainingCards[remainingCards.length - 1];
          else nextCard = remainingCards[0];
          setSelectedCard(nextCard);
        } else {
          setCardDetailModalVisible(false);
          setSelectedCard(null);
        }
      }
    } else {
      setFavoriteCardIds(prev => [...prev, cardId]);
      const card = filteredFavoriteCards.find(c => c.id === cardId);
      if (card) setFavoriteCards(prev => [...prev, card]);
    }

    try {
      wasFavorite ? await removeFavoriteCard(userId, cardId) : await addFavoriteCard(userId, cardId);
    } catch (e) {
      if (wasFavorite) {
        fetchFavorites(true);
      } else {
        setFavoriteCardIds(prev => prev.filter(id => id !== cardId));
        setFavoriteCards(prev => prev.filter(c => c.id !== cardId));
      }
    }
  }, [userId, favoriteCardIds, favoriteCards, selectedCard, filteredFavoriteCards, favCardsQuery, favCardsSort]);

  const filteredFavoriteCards = useMemo(() => {
    let list = favoriteCards.slice();

    if (favCardsQuery && favCardsQuery.trim()) {
      const q = favCardsQuery.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }

    return list;
  }, [favoriteCards, favCardsQuery]);

  const filteredMyDecks = useMemo(() => {
    // Orijinal diziyi bozmamak için kopyalıyoruz
    let list = myDecks.slice();

    // 1. Search filter
    if (myDecksQuery && myDecksQuery.trim()) {
      const q = myDecksQuery.toLowerCase();
      list = list.filter(d =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.to_name || '').toLowerCase().includes(q)
      );
    }

    // 2. Category filter
    if (myDecksSelectedCategories.length > 0) {
      list = list.filter(d => {
        const deckSortOrder = d.categories?.sort_order;
        return deckSortOrder != null && myDecksSelectedCategories.includes(deckSortOrder);
      });
    }

    // 3. Language filter (İkinci koddan gelen yeni özellik)
    if (typeof selectedLanguages !== 'undefined' && selectedLanguages.length > 0) {
      list = list.filter(d => {
        const deckLanguageIds = d.decks_languages?.map(dl => dl.language_id) || [];
        return deckLanguageIds.some(id => selectedLanguages.includes(id));
      });
    }

    // 4. Favorites filter (Eğer sort 'favorites' ise sadece favorileri gösterir)
    if (myDecksSort === 'favorites') {
      list = list.filter(d => d.is_favorite === true);
    }

    // 5. Apply sorting: updated_at'e göre (yeni oluşturulanda created_at atanıyor; güncellenince yine en üste çıkar). updated_at yoksa eski kayıt için created_at kullanılır.
    const sortDate = (d) => new Date(d.updated_at != null ? d.updated_at : d.created_at || 0).getTime();
    switch (myDecksSort) {
      case 'az':
        list.sort((a, b) => {
          const cmp = (a.name || '').localeCompare(b.name || '');
          return cmp !== 0 ? cmp : sortDate(b) - sortDate(a);
        });
        break;
      case 'favorites':
        list.sort((a, b) => {
          const aIsFavorite = a.is_favorite === true;
          const bIsFavorite = b.is_favorite === true;
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return sortDate(b) - sortDate(a);
        });
        break;
      case 'popularity':
        list.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return sortDate(b) - sortDate(a);
        });
        break;
      case 'default':
      default:
        list.sort((a, b) => sortDate(b) - sortDate(a));
        break;
    }

    return list;
    // Bağımlılık listesi: favoriteDecks artık sadece Favorilerim sekmesi için; Destelerim filtresi deck.is_favorite kullanır
  }, [myDecks, myDecksQuery, myDecksSelectedCategories, myDecksSort, selectedLanguages]);

  const refreshLibrarySummary = useCallback(() => {
    getLibrarySummary(userId).then((s) => { if (s) setLibrarySummary(s); }).catch(() => {});
  }, [userId]);
  useEffect(() => {
    refreshLibrarySummary();
  }, [refreshLibrarySummary, myDecks.length, favoriteDecks.length, favoriteCardIds.length]);
  useFocusEffect(useCallback(() => {
    refreshLibrarySummary();
  }, [refreshLibrarySummary]));

  const openMyDecksFilterModal = useCallback(() => setMyDecksFilterModalVisible(true), []);

  // First cell of "Destelerim" grid: always-visible "create deck" card
  // (deck creation moved here from the tab bar). Hidden while searching.
  const renderCreateDeckCard = useCallback(({ style }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        triggerHaptic('selection');
        navigation.navigate('CreateDeck');
      }}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={t('tabs.createDeck', 'Deste Oluştur')}
    >
      {/* Same surface as the Profile stats box (translucent, no border), with a
          glowing ⊕ in the middle and the title + hint under it. The whole card
          is the button. */}
      <View
        style={[
          createCardStyles.surface,
          { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ]}
      >
        <View style={[createCardStyles.plusHalo, { backgroundColor: `${colors.buttonColor}1F` }]}>
          <View style={[createCardStyles.plusRing, { borderColor: `${colors.buttonColor}66` }]}>
            <View style={[createCardStyles.plusCore, { backgroundColor: colors.buttonColor, shadowColor: colors.buttonColor }]}>
              <Iconify icon="ic:round-plus" size={28} color="#FFFFFF" />
            </View>
          </View>
        </View>
        <Text
          style={[createCardStyles.title, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {t('library.newDeck', 'Yeni Deste')}
        </Text>
        <Text
          style={[createCardStyles.subtitle, { color: colors.muted }]}
          numberOfLines={2}
        >
          {t('library.newDeckSubtitle', 'Kendi desteni oluştur')}
        </Text>
      </View>
    </TouchableOpacity>
  ), [colors.buttonColor, colors.text, colors.muted, isDarkMode, navigation, t]);

  // Search + filter only earn their space once the library is big enough to
  // need them. Keep them visible while any query/filter is active so the user
  // can always clear it, even if the result count drops below the threshold.
  const showMyDecksSearch =
    myDecks.length >= MY_DECKS_SEARCH_THRESHOLD ||
    !!myDecksQuery?.trim() ||
    myDecksSelectedCategories.length > 0 ||
    selectedLanguages.length > 0 ||
    myDecksSort !== 'default';

  const myDecksListHeader = useMemo(
    () => showMyDecksSearch ? (
      <MyDecksListHeaderCard
        cardBackground={colors.cardBackground}
        cardBorder={colors.cardBorder}
        textColor={colors.text}
        mutedColor={colors.muted}
        searchTopMargin={myDecksSearchContainerTopMargin}
        query={myDecksQuery}
        onQueryChange={setMyDecksQuery}
        onOpenFilter={openMyDecksFilterModal}
      />
    ) : (
      <View style={{ height: 10 }} />
    ),
    [
      showMyDecksSearch,
      colors.cardBackground,
      colors.cardBorder,
      colors.text,
      colors.muted,
      myDecksSearchContainerTopMargin,
      myDecksQuery,
      openMyDecksFilterModal,
    ]
  );

  // Yükleniyor ekranı (sadece Favorites için)
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
    </View>
  );


  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <LibraryHeader progress={pagerProgress} onTabPress={handleSetPage} summary={librarySummary} />
      {/* PagerView: 0 - MyDecks, 1 - Favorites */}
      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1, marginTop: -HERO_OVERLAP, backgroundColor: colors.background }}
        initialPage={activeTab === 'myDecks' ? 0 : 1}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          // Ensure loading is shown immediately when navigating to favorites
          if (index === 1 && !favoritesFetched) {
            setFavoritesLoading(true);
          }
          setActiveTab(index === 0 ? 'myDecks' : 'favorites');
        }}
        onPageScroll={onPageScroll}
      >
        {/* Page 0: My Decks */}
        <View key="myDecks" style={{ flex: 1 }}>
          {loading ? (
            <MyDecksSkeleton ListHeaderComponent={myDecksListHeader} contentPaddingTop={myDecksListPaddingTop} />
          ) : (
            <DeckList
              decks={filteredMyDecks}
              favoriteDecks={[]}
              onToggleFavorite={async (deckId) => {
                if (
                  (filteredMyDecks.find(
                    (d) => d.id === deckId
                  ) || {}).is_favorite
                ) {
                  await handleRemoveFavoriteDeck(deckId);
                } else {
                  await handleAddFavoriteDeck(deckId);
                }
              }}
              onPressDeck={(deck) =>
                navigation.navigate('DeckDetail', { deck })
              }
              ListHeaderComponent={myDecksListHeader}
              renderLeadingItem={myDecksQuery?.trim() ? null : renderCreateDeckCard}
              refreshing={myDecksRefreshing}
              onRefresh={() => fetchMyDecks(true)}
              onEndReached={
                myDecksHasMore
                  ? async () => {
                    if (
                      !userId ||
                      myDecksLoadingMore ||
                      !myDecksHasMore
                    ) {
                      return;
                    }

                    setMyDecksLoadingMore(true);

                    try {
                      const nextPage = myDecksPage + 1;

                      const decks = await getDecksByCategory(
                        userId,
                        'myDecks',
                        {
                          page: nextPage,
                          limit: MY_DECKS_PAGE_SIZE,
                        }
                      );

                      const safeDecks = decks || [];

                      if (safeDecks.length === 0) {
                        setMyDecksHasMore(false);
                      } else {
                        setMyDecks((prev) => [
                          ...prev,
                          ...safeDecks,
                        ]);

                        setMyDecksPage(nextPage);

                        if (
                          safeDecks.length <
                          MY_DECKS_PAGE_SIZE
                        ) {
                          setMyDecksHasMore(false);
                        }
                      }
                    } catch {
                      setMyDecksHasMore(false);
                    } finally {
                      setMyDecksLoadingMore(false);
                    }
                  }
                  : undefined}
              cardVariant="myDecks"
              layoutMode="double"
              showPopularityBadge={false}
              loadingMore={myDecksLoadingMore}
              contentPaddingTop={myDecksListPaddingTop}
              progressViewOffset={HERO_OVERLAP}
              contentPaddingBottom={listBottomInset}
            />
          )}
        </View>
        {/* Page 1: Favorites */}
        <View key="favorites" style={{ flex: 1, marginHorizontal: 10 }}>
          {favoritesLoading ? (
            renderLoading()
          ) : (
            <ScrollView
              style={{ flex: 1, backgroundColor: colors.background }}
              contentContainerStyle={{ paddingBottom: listBottomInset, paddingTop: favoritesScrollViewPaddingTop, flexGrow: 1, paddingHorizontal: 4 }}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => Keyboard.dismiss()}
            >
              <View style={styles.favoriteSliderWrapper}>
                <View style={[styles.favoriteHeaderRow, (favoriteDecks?.length === 0 && { zIndex: 10, elevation: 10 })]}>
                  <View style={{ flex: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="ph:cards-fill" size={26} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                      {t('library.favoriteDecksTitle', 'Favori Destelerim')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30', flexShrink: 0 }]} onPress={() => navigation.navigate('FavoriteDecks')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}>
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color={colors.secondary} />
                  </TouchableOpacity>
                </View>

                {favoriteDecks && favoriteDecks.length > 0 ? (
                  <>
                    <PagerView
                      style={[styles.favoriteSlider, { height: favoriteSliderDimensions.sliderHeight }]}
                      initialPage={0}
                      onPageSelected={(e) => setFavSlideIndex(e.nativeEvent.position)}
                      orientation="horizontal"
                    >
                      {favoriteDecks
                        .slice()
                        .sort((a, b) => new Date(b.favorited_at || b.created_at) - new Date(a.favorited_at || a.created_at))
                        .slice(0, 10)
                        .map(deck => (
                          <View key={'fav_slide_' + deck.id} style={styles.favoriteSlideItem}>
                            <TouchableOpacity
                              activeOpacity={0.93}
                              onPress={() => navigation.navigate('DeckDetail', { deck })}
                              style={{ flex: 1 }}
                            >
                              <LinearGradient
                                colors={getCategoryColors(deck.categories?.sort_order)}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.favoriteSlideGradient, { padding: favoriteSliderDimensions.padding }]}
                              >
                                {/* Background Category Icon */}
                                <View style={[styles.backgroundCategoryIcon, { left: favoriteSliderDimensions.categoryIconLeft }]}>
                                  <Iconify
                                    icon={getCategoryIcon(deck.categories?.sort_order)}
                                    size={favoriteSliderDimensions.categoryIconSize}
                                    color="rgba(0, 0, 0, 0.1)"
                                    style={styles.categoryIconStyle}
                                  />
                                </View>
                                {/* Profile Section */}
                                <View style={[styles.deckProfileRow, { position: 'absolute', top: 'auto', bottom: favoriteSliderDimensions.profileBottomPadding, left: favoriteSliderDimensions.profileLeftPadding, zIndex: 10 }]}>
                                  <Image
                                    source={
                                      deck.is_admin_created
                                        ? require('../../assets/app_icon.png')
                                        : deck.profiles?.image_url
                                          ? { uri: deck.profiles.image_url }
                                          : require('../../assets/avatar_default.webp')
                                    }
                                    style={[styles.deckProfileAvatar, { width: favoriteSliderDimensions.profileAvatarSize, height: favoriteSliderDimensions.profileAvatarSize }]}
                                  />
                                  <FadeText
                                    text={deck.profiles?.username || 'Kullanıcı'}
                                    style={[typography.styles.body, styles.deckProfileUsername, { fontSize: favoriteSliderDimensions.profileUsernameSize }]}
                                    maxChars={16}
                                  />
                                </View>
                                <TouchableOpacity
                                  style={{ position: 'absolute', top: favoriteSliderDimensions.favoriteButtonTopPadding, right: favoriteSliderDimensions.favoriteButtonRightPadding, zIndex: 10, backgroundColor: colors.iconBackground, padding: favoriteSliderDimensions.favoriteButtonPadding, borderRadius: 999 }}
                                  onPress={async () => {
                                    if (favoriteDecks.some(d => d.id === deck.id)) {
                                      await handleRemoveFavoriteDeck(deck.id);
                                    } else {
                                      await handleAddFavoriteDeck(deck.id);
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Iconify
                                    icon={favoriteDecks.some(d => d.id === deck.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                                    size={favoriteSliderDimensions.favoriteButtonSize}
                                    color={favoriteDecks.some(d => d.id === deck.id) ? '#F98A21' : colors.text}
                                  />
                                </TouchableOpacity>
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                  <View style={[styles.deckHeaderModern, { flexDirection: 'column' }]}>
                                    {deck.to_name ? (
                                      <>
                                        <FadeText
                                          text={deck.name}
                                          style={[typography.styles.body, { color: colors.headText, fontSize: favoriteSliderDimensions.fontSize, fontWeight: '800', textAlign: 'center' }]}
                                          maxChars={20}
                                        />
                                        <View style={{ width: 70, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: favoriteSliderDimensions.dividerMargin, alignSelf: 'center' }} />
                                        <FadeText
                                          text={deck.to_name}
                                          style={[typography.styles.body, { color: colors.headText, fontSize: favoriteSliderDimensions.fontSize, fontWeight: '800', textAlign: 'center' }]}
                                          maxChars={20}
                                        />
                                      </>
                                    ) : (
                                      <FadeText
                                        text={deck.name}
                                        style={[typography.styles.body, { color: colors.headText, fontSize: favoriteSliderDimensions.fontSize, fontWeight: '800', textAlign: 'center' }]}
                                        maxChars={20}
                                      />
                                    )}
                                  </View>
                                </View>
                                <View style={{ position: 'absolute', bottom: favoriteSliderDimensions.badgeBottomPadding, right: favoriteSliderDimensions.badgeRightPadding }}>
                                  <View style={styles.deckCountBadge}>
                                    <Iconify icon="ri:stack-fill" size={favoriteSliderDimensions.badgeIconSize} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: favoriteSliderDimensions.badgeTextSize }]}>{deck.card_count || 0}</Text>
                                  </View>
                                </View>
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>
                        ))}
                    </PagerView>
                    <View style={styles.favoriteSliderDots}>
                      {favoriteDecks
                        .slice()
                        .sort((a, b) => new Date(b.favorited_at || b.created_at) - new Date(a.favorited_at || a.created_at))
                        .slice(0, 10)
                        .map((_, i) => (
                          <View
                            key={'fav_dot_' + i}
                            style={[styles.favoriteDot, { opacity: favSlideIndex === i ? 1 : 0.35, backgroundColor: '#F98A21' }]}
                          />
                        ))}
                    </View>
                  </>
                ) : (
                  <View style={[styles.favoriteSliderEmpty, { pointerEvents: 'box-none' }]}>
                    <Image
                      source={require('../../assets/deckbg.webp')}
                      style={{ position: 'absolute', alignSelf: 'center', width: 300, height: 300, opacity: 0.2 }}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  </View>
                )}

                {/* Favorite Cards Section Header + Controls */}
                <View style={[styles.favoriteHeaderRow, { marginTop: 40 }]}>
                  <View style={{ flex: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="mdi:cards" size={26} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                      {t('library.favoriteCardsTitle', 'Favori Kartlarım')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30', flexShrink: 0 }]} onPress={() => navigation.navigate('FavoriteCards')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}>
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color={colors.secondary} />
                  </TouchableOpacity>
                </View>
                <View style={{ marginVertical: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '98%', alignSelf: 'center' }}>
                    <SearchBar
                      value={favCardsQuery}
                      onChangeText={setFavCardsQuery}
                      placeholder={t('common.searchPlaceholder', 'Kartlarda ara...')}
                      style={{ flex: 1 }}
                    />
                    <FilterIcon
                      value={favCardsSort}
                      onChange={(newSort) => {
                        setFavCardsSort(newSort);
                        fetchFavorites(false, true, newSort);
                      }}
                      hideFavorites={true}
                      hideAz={true}
                    />
                  </View>
                  {/* Favorite Cards List */}
                  <View style={{ marginTop: 14, paddingHorizontal: 4, pointerEvents: filteredFavoriteCards.length > 0 ? 'auto' : 'none' }}>
                    <FlatList
                      data={filteredFavoriteCards}
                      keyExtractor={item => String(item.id)}
                      scrollEnabled={false}
                      removeClippedSubviews={true}
                      initialNumToRender={10}
                      maxToRenderPerBatch={8}
                      windowSize={5}
                      renderItem={({ item: card }) => {
                        const isOwner = userId && card.deck?.user_id && card.deck.user_id === userId;
                        return (
                          <CardListItem
                            question={card.question}
                            answer={card.answer}
                            isFavorite={true}
                            onPress={() => {
                              setSelectedCard(card);
                              setCardDetailModalVisible(true);
                            }}
                            onToggleFavorite={() => handleRemoveFavoriteCard(card.id)}
                            canDelete={true}
                            onDelete={() => handleDeleteCard(card.id)}
                            isOwner={isOwner}
                          />
                        );
                      }}
                      ListEmptyComponent={
                        <View style={styles.favoriteCardsEmpty}>
                          <Image
                            source={require('../../assets/cardbg.webp')}
                            style={{ width: 400, height: 400, opacity: 0.2 }}
                            resizeMode="contain"
                            fadeDuration={0}
                          />
                        </View>
                      }
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </AnimatedPagerView>

      {/* Card Detail Modal */}
      {/* Card detail: full-height native sheet */}
      <BottomSheetModal
        ref={cardDetailSheetRef}
        snapPoints={LARGE_SNAP_POINTS}
        enablePanDownToClose
        index={0}
        onChange={(index) => {
          // Kullanıcı paneli aşağı sürükleyerek kapatırsa state'i güncelle
          if (index === -1) setCardDetailModalVisible(false);
        }}
        backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      >

        {/* --- SABİT HEADER BÖLÜMÜ (Aşağı kaymaz, hep üstte durur) --- */}
        <View style={[styles.modalHeader, {
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.cardBorder || '#E0E0E0',
          paddingBottom: 12,
          paddingTop: 24,
          paddingHorizontal: 16,
          borderRadius: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }]}>
          <TouchableOpacity
            onPress={() => setCardDetailModalVisible(false)}
            style={styles.modalCloseButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.modalTitle, { color: colors.text, flex: 1, textAlign: 'center', fontWeight: '600' }]}>
            {t('cardDetail.cardDetail', 'Kart Detayı')}
          </Text>

          {selectedCard ? (
            <TouchableOpacity
              onPress={() => handleToggleFavoriteCard(selectedCard.id)}
              activeOpacity={0.7}
              style={styles.modalFavoriteButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Iconify
                icon={favoriteCardIds.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={24}
                color={favoriteCardIds.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* --- KAYDIRILABİLİR İÇERİK (Sihirli Kısım Burası) --- */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {selectedCard && (
            <CardDetailView
              card={selectedCard}
              cards={filteredFavoriteCards}
              onSelectCard={(card) => setSelectedCard(card)}
              showCreatedAt={true}
            />
          )}
        </BottomSheetScrollView>

      </BottomSheetModal>

      {/* MyDecks Filter Modal */}
      <FilterModal
        visible={myDecksFilterModalVisible}
        onClose={() => setMyDecksFilterModalVisible(false)}
        currentSort={myDecksSort}
        currentCategories={myDecksSelectedCategories}
        onApply={(newSort, newCategories, newLanguages) => {
          setMyDecksSort(newSort);
          setMyDecksSelectedCategories(newCategories);
          setMyDecksFilterModalVisible(false);
          setSelectedLanguages(newLanguages || []);
        }}
        showSortOptions={true}
        languages={languagesInUse(allLanguages, myDecks, selectedLanguages)}
        currentLanguages={selectedLanguages}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  favoriteSliderWrapper: {
    marginBottom: 12,
  },
  favoriteHeaderRow: {
    paddingHorizontal: 4,
    marginBottom: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoriteHeaderTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 30,
  },
  favoriteSlider: {
    // height dinamik olarak uygulanacak
    borderRadius: 18,
    overflow: 'hidden',
  },
  favoriteSliderEmpty: {
    height: 200,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: 'transparent',
  },
  favoriteCardsEmpty: {
    height: 200,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: 'transparent',
  },
  favoriteSlideItem: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  favoriteSlideGradient: {
    flex: 1,
    borderRadius: 18,
    // padding dinamik olarak uygulanacak
    justifyContent: 'center',
    overflow: 'hidden', // İkonun taşan kısmını gizlemek için
  },
  favoriteSliderDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  favoriteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F98A21',
  },
  // Count badge used in Favorites slider
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  seeAllText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 120,
  },
  deckProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    marginRight: 6,
  },
  deckProfileUsername: {
    fontSize: 15,
    color: '#BDBDBD',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    gap: -65,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  backgroundCategoryIcon: {
    position: 'absolute',
    // left dinamik olarak uygulanacak (favoriteSliderDimensions.categoryIconLeft)
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start', // Sola hizala
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
    top: 0
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  modalFavoriteButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const createCardStyles = StyleSheet.create({
  surface: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft halo > thin ring > solid orange core: the ⊕ glows without an image.
  plusHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  plusRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCore: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    ...typography.styles.button,
    fontSize: 16,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.styles.caption,
    textAlign: 'center',
    marginTop: 2,
  },
});

const myDecksListHeaderStyles = StyleSheet.create({
  // Aligned with DeckList's grid padding (listPaddingHorizontal = 12).
  myDecksCardContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  myDecksSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});