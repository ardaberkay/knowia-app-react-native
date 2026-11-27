import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Animated, useWindowDimensions } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';
import { typography, fontSizes, fonts, lineHeights } from '../../theme/typography';
import { spacing } from '../../theme/layout';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getDecksByCategory, getLibrarySummary } from '../../services/DeckService';
import { qk, STALE } from '../../lib/queryClient';
import { deleteCard } from '../../services/CardService';
import { getFavoriteDecks, getFavoriteCards, addFavoriteDeck, removeFavoriteDeck, addFavoriteCard, removeFavoriteCard } from '../../services/FavoriteService';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import LibraryHeader, { LIBRARY_HEADER_ESTIMATED_HEIGHT, LIBRARY_TABS_BLOCK_HEIGHT } from '../../components/layout/LibraryHeader';

// Native-driven page scroll events → smooth segmented control / header.
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
import SearchBar from '../../components/tools/SearchBar';
import CardListItem from '../../components/lists/CardList';
import LottieView from 'lottie-react-native';
import DeckList from '../../components/lists/DeckList';
import { DeckStackCarousel } from '../../components/ui/DeckUi';
import MyDecksSkeleton from '../../components/skeleton/MyDecksSkeleton';
import CardDetailSheet from '../../components/layout/CardDetailView';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ProfileAvatarButton from '../../components/layout/ProfileAvatarButton';
import { getLanguages, languagesInUse } from '../../services/LanguageService';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/TabBarInset';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const MY_DECKS_SEARCH_THRESHOLD = 10;
// Favorilerim overview: newest decks in the carousel, newest cards in the list.
const FAVORITE_DECKS_PREVIEW_COUNT = 10;
const FAVORITE_CARDS_PREVIEW_COUNT = 5;
const favoritedAt = (item) => new Date(item.favorited_at || item.created_at || 0).getTime();
const sortByFavoritedAt = (items) => items.slice().sort((a, b) => favoritedAt(b) - favoritedAt(a));

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
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
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

  // Collapsing header (like Discover's): it floats over the pages and each
  // page's list scrolls it away; the tabs stay pinned. Each page keeps its own
  // scroll position; while swiping between pages the header blends between
  // the two, so it shows the state of the page in front. All native-driven.
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(() => insets.top + LIBRARY_HEADER_ESTIMATED_HEIGHT);
  const handleHeaderHeight = useCallback((height) => {
    if (height > 0) setHeaderHeight((prev) => (Math.abs(prev - height) < 0.5 ? prev : height));
  }, []);
  const collapseDistance = Math.max(1, headerHeight - insets.top - LIBRARY_TABS_BLOCK_HEIGHT);
  const myDecksScrollY = useRef(new Animated.Value(0)).current;
  const favoritesScrollY = useRef(new Animated.Value(0)).current;
  const onMyDecksScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: myDecksScrollY } } }],
    { useNativeDriver: true }
  ), [myDecksScrollY]);
  const onFavoritesScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: favoritesScrollY } } }],
    { useNativeDriver: true }
  ), [favoritesScrollY]);
  const headerCollapsed = useMemo(() => {
    const clampScroll = (value) => value.interpolate({
      inputRange: [0, collapseDistance],
      outputRange: [0, collapseDistance],
      extrapolate: 'clamp',
    });
    const favoritesShare = pagerProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
    const myDecksShare = pagerProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' });
    return Animated.add(
      Animated.multiply(clampScroll(myDecksScrollY), myDecksShare),
      Animated.multiply(clampScroll(favoritesScrollY), favoritesShare)
    );
  }, [collapseDistance, favoritesScrollY, myDecksScrollY, pagerProgress]);
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
  // "Destelerim" search / filters / sort run on the server over all decks
  // (list_decks), not only over the pages loaded so far.
  const [myDecksDebouncedQuery, setMyDecksDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setMyDecksDebouncedQuery(myDecksQuery.trim()), 350);
    return () => clearTimeout(id);
  }, [myDecksQuery]);
  const myDecksServerOptions = useMemo(() => ({
    searchQuery: myDecksDebouncedQuery,
    sortBy: myDecksSort === 'az' ? 'az' : 'default',
    categorySortOrders: myDecksSelectedCategories,
    languageIds: selectedLanguages,
    favoritesOnly: myDecksSort === 'favorites',
  }), [myDecksDebouncedQuery, myDecksSort, myDecksSelectedCategories, selectedLanguages]);

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width } = useWindowDimensions();

  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (width - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

  // The header floats over the pages: the lists start below it.
  const favoritesScrollViewPaddingTop = headerHeight + 4; // same top as Destelerim
  const myDecksListPaddingTop = headerHeight + 4;

  const myDecksSearchContainerTopMargin = 8;

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

  // "Destelerim" (TanStack Query): pages live in RAM; the plain first page
  // (no search / filter / sort) is also kept on disk for a cold start. Our own
  // changes (new / edited / deleted deck, cards, chapters, favourites)
  // invalidate it; otherwise it is re-checked after STALE.OWN.
  const queryClient = useQueryClient();
  const myDecksIsPlain = !myDecksServerOptions.searchQuery && myDecksServerOptions.sortBy !== 'az'
    && !myDecksServerOptions.categorySortOrders.length && !myDecksServerOptions.languageIds.length
    && !myDecksServerOptions.favoritesOnly;
  const myDecksQueryKey = qk.myDecks(userId, myDecksServerOptions);
  const myDecksQ = useInfiniteQuery({
    queryKey: myDecksQueryKey,
    queryFn: ({ pageParam }) => getDecksByCategory(userId, 'myDecks', {
      page: pageParam,
      limit: MY_DECKS_PAGE_SIZE,
      ...myDecksServerOptions,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      (lastPage?.length || 0) >= MY_DECKS_PAGE_SIZE ? allPages.length : undefined,
    enabled: !!userId,
    staleTime: STALE.OWN,
    gcTime: myDecksIsPlain ? STALE.STATIC : undefined,
    // a new search / filter keeps the current list on screen until it answers
    placeholderData: keepPreviousData,
    meta: { persist: myDecksIsPlain },
  });
  const myDecks = useMemo(() => {
    const seen = new Set();
    const out = [];
    (myDecksQ.data?.pages || []).forEach((page) => (page || []).forEach((deck) => {
      if (deck?.id && !seen.has(deck.id)) { seen.add(deck.id); out.push(deck); }
    }));
    return out;
  }, [myDecksQ.data]);
  const loading = !!userId && myDecksQ.isPending;
  const myDecksHasMore = !!myDecksQ.hasNextPage;
  const myDecksLoadingMore = myDecksQ.isFetchingNextPage;
  const fetchMyDecks = useCallback(async () => {
    setMyDecksRefreshing(true);
    try {
      await myDecksQ.refetch();
    } finally {
      setMyDecksRefreshing(false);
    }
  }, [myDecksQ.refetch]);
  // Optimistic change of one deck in every cached "Destelerim" list.
  const patchMyDeck = useCallback((deckId, patch) => {
    queryClient.setQueriesData({ queryKey: ['myDecks', userId] }, (data) => (data?.pages ? {
      ...data,
      pages: data.pages.map((page) => (page || []).map((d) => (d.id === deckId ? { ...d, ...patch } : d))),
    } : data));
  }, [queryClient, userId]);

  // Favorilerim sekmesine geçildiğinde veri yoksa (veya henüz gelmediyse) yükle
  useEffect(() => {
    if (activeTab === 'favorites' && !favoritesFetched && userId) {
      fetchFavorites();
    }
  }, [activeTab, favoritesFetched, userId]);

  const FAVORITE_CARDS_PAGE_SIZE = 20;
  const fetchFavorites = async (silent = false, forceRefresh = false) => {
    if (!userId) return;
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

      // Newest favourites first; search and filters live on the "Tümü" screen.
      const cards = await getFavoriteCards(userId, 0, FAVORITE_CARDS_PAGE_SIZE, forceRefresh, 'original', null);
      // status comes with the rows (list_favorite_cards RPC)
      const cardsWithProgress = (cards || []).map(card => ({
        ...card,
        status: card.status || 'new'
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

  // Back on this screen: refetch "Destelerim" only if it is stale. Our own
  // changes (e.g. a deck created on the CreateDeck screen) already invalidated it.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      queryClient.refetchQueries({ queryKey: ['myDecks', userId], stale: true, type: 'active' });
    }, [queryClient, userId])
  );

  // Favoriler sekmesindeki birleşik liste kaldırıldı

  // Favorilerim sekmesindeki birleşik render kaldırıldı

  // Favori deste ekleme/çıkarma fonksiyonları
  const handleAddFavoriteDeck = useCallback(async (deckId) => {
    if (!userId) return;
    patchMyDeck(deckId, { is_favorite: true });
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
      patchMyDeck(deckId, { is_favorite: false });
      if (deckToAdd) setFavoriteDecks(prev => prev.filter(d => d.id !== deckId));
    }
  }, [userId, myDecks, patchMyDeck]);

  const handleRemoveFavoriteDeck = useCallback(async (deckId) => {
    if (!userId) return;
    patchMyDeck(deckId, { is_favorite: false });
    const removedDeck = favoriteDecks.find(d => d.id === deckId);
    setFavoriteDecks(prev => prev.filter(d => d.id !== deckId));
    try {
      await removeFavoriteDeck(userId, deckId);
    } catch (e) {
      patchMyDeck(deckId, { is_favorite: true });
      if (removedDeck) setFavoriteDecks(prev => [removedDeck, ...prev]);
    }
  }, [userId, favoriteDecks, patchMyDeck]);


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
                const remainingCards = sortByFavoritedAt(updatedCards);
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
      const currentIndex = favoriteCards.findIndex(c => c.id === cardId);
      const remainingCards = sortByFavoritedAt(updatedCards);
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
  }, [userId, favoriteCards, favoriteCardIds, selectedCard, cardDetailModalVisible]);



  const handleToggleFavoriteCard = useCallback(async (cardId) => {
    if (!userId) return;
    const wasFavorite = favoriteCardIds.includes(cardId);

    if (wasFavorite) {
      const updatedCards = favoriteCards.filter(c => c.id !== cardId);
      const updatedIds = favoriteCardIds.filter(id => id !== cardId);
      setFavoriteCardIds(updatedIds);
      setFavoriteCards(updatedCards);

      if (selectedCard && selectedCard.id === cardId) {
        const currentIndex = favoriteCards.findIndex(c => c.id === cardId);
        const remainingCards = sortByFavoritedAt(updatedCards);
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
      const card = favoriteCards.find(c => c.id === cardId);
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
  }, [userId, favoriteCardIds, favoriteCards, selectedCard]);

  // Overview: the newest favourite cards. The full list (search, filters) is
  // on the "Tümü" screen.
  const favoriteCardsPreview = useMemo(
    () => favoriteCards.slice(0, FAVORITE_CARDS_PREVIEW_COUNT),
    [favoriteCards]
  );
  const favoriteDecksPreview = useMemo(
    () => favoriteDecks
      .slice()
      .sort((a, b) => new Date(b.favorited_at || b.created_at) - new Date(a.favorited_at || a.created_at))
      .slice(0, FAVORITE_DECKS_PREVIEW_COUNT),
    [favoriteDecks]
  );

  // Search, category, language, favourites and A–Z are applied by the server.
  const filteredMyDecks = myDecks;

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
              <PhosphorIcon icon={ICONS.add} size={28} color="#FFFFFF" />
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
      <LottieView source={require('../../assets/animations/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
      <LottieView source={require('../../assets/animations/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
    </View>
  );

  // Favorilerim section header, same look as Home's: plain icon, title,
  // "Tümü ›" link.
  const renderFavoriteSectionHeader = ({ icon, title, onSeeAll }) => (
    <View style={styles.favoriteSectionHeader}>
      <PhosphorIcon icon={icon} size={22} color="#F98A21" />
      <Text style={[typography.styles.title3, styles.favoriteSectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        onPress={onSeeAll}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        style={styles.seeAllLink}
      >
        <Text style={[typography.styles.subhead, styles.seeAllText, { color: colors.secondary }]}>
          {t('library.all', 'Tümü')}
        </Text>
        <PhosphorIcon icon={ICONS.chevronRight} size={13} color={colors.secondary} />
      </TouchableOpacity>
    </View>
  );


  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* PagerView: 0 - MyDecks, 1 - Favorites */}
      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1, backgroundColor: colors.background }}
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
              onRefresh={fetchMyDecks}
              onEndReached={
                myDecksHasMore
                  ? () => {
                    if (!myDecksQ.isFetchingNextPage) myDecksQ.fetchNextPage();
                  }
                  : undefined}
              cardVariant="myDecks"
              layoutMode="double"
              showPopularityBadge={false}
              loadingMore={myDecksLoadingMore}
              contentPaddingTop={myDecksListPaddingTop}
              progressViewOffset={headerHeight}
              contentPaddingBottom={listBottomInset}
              onScroll={onMyDecksScroll}
            />
          )}
        </View>
        {/* Page 1: Favorites — overview: newest decks (carousel) and cards.
            "Tümü" opens the full lists with search and filters. */}
        <View key="favorites" style={{ flex: 1 }}>
          {favoritesLoading ? (
            <View style={{ flex: 1, paddingTop: headerHeight }}>{renderLoading()}</View>
          ) : (
            <Animated.ScrollView
              style={{ flex: 1, backgroundColor: colors.background }}
              contentContainerStyle={{ paddingTop: favoritesScrollViewPaddingTop + spacing.sm, paddingBottom: listBottomInset, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              onScroll={onFavoritesScroll}
              scrollEventThrottle={16}
            >
              {renderFavoriteSectionHeader({
                icon: ICONS.deck,
                title: t('library.decksSection', 'Desteler'),
                onSeeAll: () => navigation.navigate('FavoriteDecks'),
              })}
              {favoriteDecksPreview.length > 0 ? (
                <DeckStackCarousel
                  decks={favoriteDecksPreview}
                  colors={colors}
                  typography={typography}
                  onPress={(deck) => navigation.navigate('DeckDetail', { deck })}
                />
              ) : (
                <Text style={[typography.styles.subhead, styles.favoriteEmptyText, { color: colors.muted }]}>
                  {t('library.favoriteDecksEmptyHint', 'Beğendiğin desteleri kalple kaydet, burada görünsün.')}
                </Text>
              )}

              <View style={styles.favoriteSectionGap} />
              {renderFavoriteSectionHeader({
                icon: ICONS.stack,
                title: t('library.cardsSection', 'Kartlar'),
                onSeeAll: () => navigation.navigate('FavoriteCards'),
              })}
              {favoriteCardsPreview.length > 0 ? (
                <View style={styles.favoriteCardsList}>
                  {favoriteCardsPreview.map((card) => (
                    <CardListItem
                      key={card.id}
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
                      isOwner={Boolean(userId && card.deck?.user_id && card.deck.user_id === userId)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[typography.styles.subhead, styles.favoriteEmptyText, { color: colors.muted }]}>
                  {t('library.favoriteCardsEmptyHint', 'Çalışırken karttaki kalbe dokun, burada görünsün.')}
                </Text>
              )}
            </Animated.ScrollView>
          )}
        </View>
      </AnimatedPagerView>

      {/* Over the pages: scrolls away with the lists, tabs stay pinned. */}
      <LibraryHeader
        progress={pagerProgress}
        onTabPress={handleSetPage}
        summary={librarySummary}
        collapsed={headerCollapsed}
        collapseDistance={collapseDistance}
        onHeightChange={handleHeaderHeight}
      />

      {/* Card detail: full-screen native sheet */}
      <CardDetailSheet
        card={selectedCard}
        visible={cardDetailModalVisible}
        onDismiss={() => setCardDetailModalVisible(false)}
        isFavorite={Boolean(selectedCard && favoriteCardIds.includes(selectedCard.id))}
        onToggleFavorite={(card) => handleToggleFavoriteCard(card.id)}
      />

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
  // Favorilerim: section header (Home style), carousel, card list.
  favoriteSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  favoriteSectionTitle: {
    flex: 1,
  },
  favoriteSectionGap: {
    height: spacing.xl,
  },
  seeAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  seeAllText: {
    fontFamily: fonts.semibold,
  },
  favoriteCardsList: {
    paddingHorizontal: spacing.lg,
  },
  favoriteEmptyText: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    lineHeight: lineHeights.subhead,
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
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.semibold,
    textAlign: 'center',
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
    ...typography.styles.headline,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.styles.subhead,
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