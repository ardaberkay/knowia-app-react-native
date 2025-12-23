import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, Alert, ActivityIndicator, Animated, ScrollView, RefreshControl, Image, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getDecksByCategory } from '../../services/DeckService';
import { Iconify } from 'react-native-iconify';
import { getFavoriteDecks, getFavoriteCards } from '../../services/FavoriteService';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import PagerView from 'react-native-pager-view';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import CardListItem from '../../components/lists/CardList';
import LottieView from 'lottie-react-native';
import MyDecksList from '../../components/lists/MyDecksList';
import MaskedView from '@react-native-masked-view/masked-view';
import MyDecksSkeleton from '../../components/skeleton/MyDecksSkeleton';
import CardDetailView from '../../components/layout/CardDetailView';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';

// Fade efekti için yardımcı bileşen
const FadeText = ({ text, style, maxWidth, maxChars }) => {
  // Karakter sayısına göre fade gösterimi
  const shouldShowFade = text && text.length > maxChars;
  
  if (!shouldShowFade) {
    return (
      <Text 
        style={[style, { maxWidth }]} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    );
  }
  
  return (
    <MaskedView
      style={[styles.maskedView, { maxWidth }]}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1.15, y: 0 }}
          style={styles.maskGradient}
        />
      }
    >
      <Text 
        style={style} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    </MaskedView>
  );
};

export default function LibraryScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('myDecks');
  const [myDecks, setMyDecks] = useState([]);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoritesFetched, setFavoritesFetched] = useState(false);
  const [activeDeckMenuId, setActiveDeckMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { t } = useTranslation();
  const pagerRef = useRef(null);
  const tabScroll = useRef(new Animated.Value(0)).current; // 0 -> MyDecks, 1 -> Favorites
  const [pillWidth, setPillWidth] = useState(0);
  const [favSlideIndex, setFavSlideIndex] = useState(0);
  const [favCardsQuery, setFavCardsQuery] = useState('');
  const [favCardsSort, setFavCardsSort] = useState('original');
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [favoriteCardIds, setFavoriteCardIds] = useState([]);
  const [myDecksQuery, setMyDecksQuery] = useState('');
  const [myDecksSort, setMyDecksSort] = useState('default');
  const [myDecksSelectedCategories, setMyDecksSelectedCategories] = useState([]);
  const [myDecksFilterModalVisible, setMyDecksFilterModalVisible] = useState(false);
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

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

  const handleSetPage = (pageIndex) => {
    if (pagerRef.current && typeof pagerRef.current.setPage === 'function') {
      pagerRef.current.setPage(pageIndex);
    }
    // When switching to favorites, set loading immediately to avoid UI flash
    if (pageIndex === 1 && !favoritesFetched) {
      setFavoritesLoading(true);
    }
    setActiveTab(pageIndex === 0 ? 'myDecks' : 'favorites');
  };

  useEffect(() => {
    const fetchDecks = async () => {
      setLoading(true);
      try {
        const decks = await getDecksByCategory('myDecks');
        setMyDecks(decks || []);
      } catch (e) {
        setMyDecks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites' && !favoritesFetched) {
      fetchFavorites();
    }
  }, [activeTab, favoritesFetched]);

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id); // currentUserId'yi burada da set et
      const decks = await getFavoriteDecks(user.id);
      setFavoriteDecks(decks || []);
      
      // Fetch favorite cards and user progress in parallel
      const [cards, progressResult] = await Promise.all([
        getFavoriteCards(user.id),
        supabase
          .from('user_card_progress')
          .select('card_id, status')
          .eq('user_id', user.id)
      ]);
      
      // Create a map of card statuses
      const statusMap = {};
      if (progressResult.data) {
        progressResult.data.forEach(p => {
          statusMap[p.card_id] = p.status;
        });
      }
      
      // Merge status into cards (default: 'new' if no progress record)
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
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id));
  }, []);

  // Favoriler sekmesindeki birleşik liste kaldırıldı

  // Favorilerim sekmesindeki birleşik render kaldırıldı

  const openDropdown = () => {
    if (filterIconRef.current) {
      filterIconRef.current.measureInWindow((x, y, width, height) => {
        setDropdownPos({ x, y, width, height });
        setFilterDropdownVisible(true);
      });
    } else {
      setFilterDropdownVisible(true);
    }
  };

  // Favori deste ekleme/çıkarma fonksiyonları
  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };
  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  // Deste silme fonksiyonu
  const handleDeleteDeck = (deckId) => {
    Alert.alert(
      t('library.deleteConfirmation', 'Bu işlemi geri alamazsınız. Emin misiniz?'),
      t('library.deleteConfirm', 'Deste Silinsin mi?'),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('library.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            await supabase.from('decks').delete().eq('id', deckId);
            setMyDecks(prev => prev.filter(deck => deck.id !== deckId));
            setFavoriteDecks(prev => prev.filter(deck => deck.id !== deckId));
            setActiveDeckMenuId(null);
          }
        }
      ]
    );
  };

  // Favori kartlar ve kart işlemleri kaldırıldı
  const handleRemoveFavoriteCard = async (cardId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_cards').delete().eq('user_id', user.id).eq('card_id', cardId);
    
    // Fetch cards and progress in parallel
    const [cards, progressResult] = await Promise.all([
      getFavoriteCards(user.id),
      supabase
        .from('user_card_progress')
        .select('card_id, status')
        .eq('user_id', user.id)
    ]);
    
    // Create a map of card statuses
    const statusMap = {};
    if (progressResult.data) {
      progressResult.data.forEach(p => {
        statusMap[p.card_id] = p.status;
      });
    }
    
    // Merge status into cards
    const updatedCards = (cards || []).map(card => ({
      ...card,
      status: statusMap[card.id] || 'new'
    }));
    
    setFavoriteCards(updatedCards);
    setFavoriteCardIds(updatedCards.map(card => card.id));
    
    // Eğer seçili kart favorilerden çıkarıldıysa ve modal açıksa, sonraki karta geç
    if (selectedCard && selectedCard.id === cardId && cardDetailModalVisible) {
      // Mevcut kartın index'ini bul (filtrelenmiş listede)
      const currentIndex = filteredFavoriteCards.findIndex(c => c.id === cardId);
      
      // Güncellenmiş kart listesini filtrele (çıkarılan kart olmadan)
      let remainingCards = updatedCards.slice();
      if (favCardsQuery && favCardsQuery.trim()) {
        const q = favCardsQuery.toLowerCase();
        remainingCards = remainingCards.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
      }
      if (favCardsSort === 'az') {
        remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
      } else if (favCardsSort === 'unlearned') {
        remainingCards = remainingCards.filter(c => c.status !== 'learned');
      } else if (favCardsSort !== 'fav') {
        remainingCards.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (remainingCards.length > 0) {
        // Sonraki karta geç, eğer son kart ise önceki karta geç
        let nextCard;
        if (currentIndex >= 0 && currentIndex < remainingCards.length) {
          // Aynı index'teki karta geç (eğer varsa)
          nextCard = remainingCards[currentIndex];
        } else if (currentIndex >= remainingCards.length) {
          // Son karta geç
          nextCard = remainingCards[remainingCards.length - 1];
        } else {
          // İlk karta geç
          nextCard = remainingCards[0];
        }
        setSelectedCard(nextCard);
      } else {
        // Hiç kart kalmadıysa modal'ı kapat
        setCardDetailModalVisible(false);
        setSelectedCard(null);
      }
    }
  };

  const handleToggleFavoriteCard = async (cardId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (favoriteCardIds.includes(cardId)) {
        // Favorilerden çıkar
        await supabase
          .from('favorite_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId);
        
        const updatedFavoriteCards = favoriteCards.filter(c => c.id !== cardId);
        const updatedFavoriteCardIds = favoriteCardIds.filter(id => id !== cardId);
        setFavoriteCardIds(updatedFavoriteCardIds);
        setFavoriteCards(updatedFavoriteCards);
        
        // Eğer seçili kart favorilerden çıkarıldıysa, sonraki karta geç
        if (selectedCard && selectedCard.id === cardId) {
          // Mevcut kartın index'ini bul (filtrelenmiş listede)
          const currentIndex = filteredFavoriteCards.findIndex(c => c.id === cardId);
          
          // Güncellenmiş kart listesini filtrele (çıkarılan kart olmadan)
          let remainingCards = updatedFavoriteCards.slice();
          if (favCardsQuery && favCardsQuery.trim()) {
            const q = favCardsQuery.toLowerCase();
            remainingCards = remainingCards.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
          }
          if (favCardsSort === 'az') {
            remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
          } else if (favCardsSort === 'unlearned') {
            remainingCards = remainingCards.filter(c => c.status !== 'learned');
          } else if (favCardsSort !== 'fav') {
            remainingCards.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          }
          
          if (remainingCards.length > 0) {
            // Sonraki karta geç, eğer son kart ise önceki karta geç
            let nextCard;
            if (currentIndex >= 0 && currentIndex < remainingCards.length) {
              // Aynı index'teki karta geç (eğer varsa)
              nextCard = remainingCards[currentIndex];
            } else if (currentIndex >= remainingCards.length) {
              // Son karta geç
              nextCard = remainingCards[remainingCards.length - 1];
            } else {
              // İlk karta geç
              nextCard = remainingCards[0];
            }
            setSelectedCard(nextCard);
          } else {
            // Hiç kart kalmadıysa modal'ı kapat
            setCardDetailModalVisible(false);
            setSelectedCard(null);
          }
        }
      } else {
        // Favorilere ekle
        await supabase
          .from('favorite_cards')
          .insert({ user_id: user.id, card_id: cardId });
        setFavoriteCardIds([...favoriteCardIds, cardId]);
        // Kartı favori kartlar listesine de ekle (eğer gerekirse)
        const card = filteredFavoriteCards.find(c => c.id === cardId);
        if (card) {
          setFavoriteCards([...favoriteCards, card]);
        }
      }
    } catch (e) {}
  };

  const filteredFavoriteCards = useMemo(() => {
    let list = favoriteCards.slice();
    
    // Search filter
    if (favCardsQuery && favCardsQuery.trim()) {
      const q = favCardsQuery.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    
    // Sort/Filter options
    if (favCardsSort === 'az') {
      list.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
    } else if (favCardsSort === 'fav') {
      // Favori kartlar zaten favori olduğu için burada bir değişiklik yapmıyoruz
      // Sadece orijinal sıralamayı koruyoruz
    } else if (favCardsSort === 'unlearned') {
      list = list.filter(c => c.status !== 'learned');
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return list;
  }, [favoriteCards, favCardsQuery, favCardsSort]);

  const filteredMyDecks = (() => {
    let list = myDecks.slice();
    
    // Search filter
    if (myDecksQuery && myDecksQuery.trim()) {
      const q = myDecksQuery.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.to_name || '').toLowerCase().includes(q));
    }
    
    // Category filter
    if (myDecksSelectedCategories.length > 0) {
      list = list.filter(d => {
        const deckSortOrder = d.categories?.sort_order;
        return deckSortOrder != null && myDecksSelectedCategories.includes(deckSortOrder);
      });
    }
    
    // Favorites filter (if sort is 'favorites')
    if (myDecksSort === 'favorites') {
      list = list.filter(d => favoriteDecks.some(favDeck => favDeck.id === d.id));
    }
    
    // Apply sorting
    switch (myDecksSort) {
      case 'az':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'favorites':
        // Favoriler önce, sonra A-Z
        list.sort((a, b) => {
          const aIsFavorite = favoriteDecks.some(favDeck => favDeck.id === a.id);
          const bIsFavorite = favoriteDecks.some(favDeck => favDeck.id === b.id);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        break;
      case 'popularity':
        list.sort((a, b) => {
          const scoreA = a.popularity_score || 0;
          const scoreB = b.popularity_score || 0;
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          return new Date(b.created_at) - new Date(a.created_at);
        });
        break;
      case 'default':
      default:
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }
    
    return list;
  })();

  // MyDecks Card
  const renderMyDecksCard = () => {
    return (
      <View style={[styles.myDecksCard, styles.myDecksCardContainer, { backgroundColor: colors.cardBackground || colors.cardBackgroundTransparent || (isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)') }]}>
        <View style={styles.myDecksContent}>
          <View style={styles.myDecksTextContainer}>
            <View style={styles.myDecksTitleContainer}>
              <Iconify icon="ph:cards-fill" size={26} color="#F98A21" style={{ marginRight: 6 }} />
              <Text style={[typography.styles.h2, { color: colors.text}]}>
                {t('library.myDecks', 'Destelerim')}
              </Text>
            </View>
            <Text style={[typography.styles.caption, { color: colors.muted, lineHeight: 22, marginRight: 3 }]}>
              {t('library.myDecksSubtitle', ' Oluşturduğun destelerle kendi öğrenme yolculuğunu tasarla; keşfet, pekiştir ve hedeflerine doğru ilerle')}
            </Text>
          </View>
          <View style={styles.myDecksImageContainer}>
            <Image
              source={require('../../assets/mydecks-item.png')}
              style={styles.myDecksImage}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.myDecksSearchContainer}>
          <SearchBar
            value={myDecksQuery}
            onChangeText={setMyDecksQuery}
            placeholder={t('common.searchPlaceholder', 'Destelerde ara...')}
            style={{ flex: 1 }}
          />
          <FilterModalButton onPress={() => setMyDecksFilterModalVisible(true)} />
        </View>
      </View>
    );
  };

  // Yükleniyor ekranı (sadece Favorites için)
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
    </View>
  );


  return (
    <View style={[styles.container]}>
      {/* Pill Tabs + Animated Indicator */}
      <View style={styles.segmentedControlContainer} pointerEvents="box-none">
        <View style={[styles.segmentedControlInner, { backgroundColor: colors.background }]}>
          <View
            style={[styles.pillContainer, { borderColor: colors.cardBordaer || '#444444', backgroundColor: colors.background }]}
            onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
          >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pillIndicator,
              {
                width: (pillWidth > 0 ? pillWidth / 2 : 0),
                transform: [
                  {
                    translateX: tabScroll.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (pillWidth > 0 ? pillWidth / 2 : 0)],
                      extrapolate: 'clamp',
                    })
                  }
                ],
                backgroundColor: colors.buttonColor || '#F98A21',
              }
            ]}
          />
          <TouchableOpacity style={styles.pillTab} activeOpacity={0.8} onPress={() => handleSetPage(0)}>
            <Text style={[styles.pillLabel, { color: activeTab === 'myDecks' ? colors.text : (colors.border || '#666') }]}>
              {t('library.myDecks', 'Destelerim')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillTab} activeOpacity={0.8} onPress={() => handleSetPage(1)}>
            <Text style={[styles.pillLabel, { color: activeTab === 'favorites' ? colors.text : (colors.border || '#666') }]}>
              {t('library.favorites', 'Favorilerim')}
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* PagerView: 0 - MyDecks, 1 - Favorites */}
      <PagerView
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
        onPageScroll={(e) => {
          const { position, offset } = e.nativeEvent;
          tabScroll.setValue(position + offset);
        }}
      >
        {/* Page 0: My Decks */}
        <View key="myDecks" style={{ flex: 1 }}>
          {loading ? (
            <MyDecksSkeleton />
          ) : (
            <MyDecksList
              decks={filteredMyDecks}
              favoriteDecks={favoriteDecks}
              onToggleFavorite={async (deckId) => {
                if (favoriteDecks.some(d => d.id === deckId)) {
                  await handleRemoveFavoriteDeck(deckId);
                } else {
                  await handleAddFavoriteDeck(deckId);
                }
              }}
              onDeleteDeck={handleDeleteDeck}
              onPressDeck={(deck) => navigation.navigate('DeckDetail', { deck })}
              ListHeaderComponent={renderMyDecksCard}
              refreshing={loading}
              onRefresh={() => {
                setLoading(true);
                getDecksByCategory('myDecks').then(decks => {
                  setMyDecks(decks || []);
                  setLoading(false);
                });
              }}
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
              contentContainerStyle={{ paddingBottom: '18%', marginTop: '22%', flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={favoritesLoading}
                  onRefresh={fetchFavorites}
                  tintColor={colors.buttonColor}
                  colors={[colors.buttonColor]}
                />
              }
            >
              <View style={styles.favoriteSliderWrapper}>
                <View style={styles.favoriteHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="ph:cards-fill" size={26} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]}>
                      {t('library.favoriteDecksTitle', 'Favori Destelerim')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30' }]} onPress={() => navigation.navigate('FavoriteDecks')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}>
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color={colors.secondary}/>
                  </TouchableOpacity>
                </View>

                {favoriteDecks && favoriteDecks.length > 0 ? (
                  <>
                    <PagerView
                      style={styles.favoriteSlider}
                      initialPage={0}
                      onPageSelected={(e) => setFavSlideIndex(e.nativeEvent.position)}
                      orientation="horizontal"
                    >
                      {favoriteDecks
                        .slice()
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .slice(0, 5)
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
                                style={styles.favoriteSlideGradient}
                              >
                                {/* Background Category Icon */}
                                <View style={styles.backgroundCategoryIcon}>
                                  <Iconify
                                    icon={getCategoryIcon(deck.categories?.sort_order)}
                                    size={150}
                                    color="rgba(0, 0, 0, 0.1)"
                                    style={styles.categoryIconStyle}
                                  />
                                </View>
                                {/* Profile Section */}
                                <View style={[styles.deckProfileRow, { position: 'absolute', top: 'auto', bottom: 10, left: 10, zIndex: 10 }]}>
                                  <Image
                                    source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
                                    style={styles.deckProfileAvatar}
                                  />
                                  <FadeText 
                                    text={deck.profiles?.username || 'Kullanıcı'} 
                                    style={[typography.styles.body, styles.deckProfileUsername]} 
                                    maxWidth={'100%'}
                                    maxChars={16}
                                  />
                                </View>
                                <TouchableOpacity
                                  style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
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
                                    size={24}
                                    color={favoriteDecks.some(d => d.id === deck.id) ? '#F98A21' : colors.text}
                                  />
                                </TouchableOpacity>
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                  <View style={[styles.deckHeaderModern, { flexDirection: 'column' }]}> 
                                    {deck.to_name ? (
                                      <>
                                        <FadeText 
                                          text={deck.name} 
                                          style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                                          maxWidth={'100%'}
                                          maxChars={35}
                                        />
                                        <View style={{ width: 70, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10, alignSelf: 'center' }} />
                                        <FadeText 
                                          text={deck.to_name} 
                                          style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                                          maxWidth={'100%'}
                                          maxChars={35}
                                        />
                                      </>
                                    ) : (
                                      <FadeText 
                                        text={deck.name} 
                                        style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                                        maxWidth={'100%'}
                                        maxChars={35}
                                      />
                                    )}
                                  </View>
                                </View>
                                <View style={{ position: 'absolute', bottom: 12, right: 8 }}>
                                  <View style={styles.deckCountBadge}>
                                    <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{deck.card_count || 0}</Text>
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
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .slice(0, 5)
                        .map((_, i) => (
                          <View
                            key={'fav_dot_' + i}
                            style={[styles.favoriteDot, { opacity: favSlideIndex === i ? 1 : 0.35, backgroundColor: '#F98A21' }]}
                          />
                        ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.favoriteSliderEmpty}>
                    <Image
                      source={require('../../assets/greyBg.png')}
                      style={{ position: 'absolute', alignSelf: 'center', width: 300, height: 300, opacity: 0.2 }}
                      resizeMode="contain"
                    />
                    <Text style={[typography.styles.body, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>
                      {t('library.addFavoriteDeckCta', 'Favorilerine bir deste ekle')}
                    </Text>
                  </View>
                )}

                {/* Favorite Cards Section Header + Controls */}
                <View style={[styles.favoriteHeaderRow, { marginTop: 40 }]}> 
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="mdi:cards" size={26} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]}> 
                      {t('library.favoriteCardsTitle', 'Favori Kartlarım')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30' }]} onPress={() => navigation.navigate('FavoriteCards')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}> 
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color={colors.secondary}  />
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
                      onChange={setFavCardsSort}
                      hideFavorites={true}
                    />
                  </View>
                  {/* Favorite Cards List */}
                  <View style={{ marginTop: 14, paddingHorizontal: 4 }}>
                    {filteredFavoriteCards.map((card) => {
                      const isOwner = currentUserId && card.deck?.user_id && card.deck.user_id === currentUserId;
                      return (
                        <CardListItem
                          key={String(card.id)}
                          question={card.question}
                          answer={card.answer}
                          isFavorite={true}
                          onPress={() => {
                            setSelectedCard(card);
                            setCardDetailModalVisible(true);
                          }}
                          onToggleFavorite={() => handleRemoveFavoriteCard(card.id)}
                          canDelete={true}
                          onDelete={() => handleRemoveFavoriteCard(card.id)}
                          isOwner={isOwner}
                        />
                      );
                    })}
                    {filteredFavoriteCards.length === 0 ? (
                      <Text style={[styles.emptyText, typography.styles.caption]}>{t('library.noFavorites', 'Henüz favori bulunmuyor')}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </PagerView>

      {/* Card Detail Modal */}
      <Modal
        visible={cardDetailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCardDetailModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              onPress={() => setCardDetailModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Iconify icon="mdi:arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text, flex: 1, textAlign: 'center' }]}>
              {t('cardDetail.cardDetail', 'Kart Detayı')}
            </Text>
            {selectedCard && (
              <TouchableOpacity
                onPress={() => handleToggleFavoriteCard(selectedCard.id)}
                activeOpacity={0.7}
                style={styles.modalFavoriteButton}
              >
                <Iconify
                  icon={favoriteCardIds.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                  size={24}
                  color={favoriteCardIds.includes(selectedCard.id) ? '#F98A21' : colors.text}
                />
              </TouchableOpacity>
            )}
            {!selectedCard && <View style={{ width: 28 }} />}
          </View>
          <View style={{ flex: 1 }}>
            {selectedCard && (
              <CardDetailView
                card={selectedCard}
                cards={filteredFavoriteCards}
                onSelectCard={(card) => setSelectedCard(card)}
                showCreatedAt={true}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* MyDecks Filter Modal */}
      <FilterModal
        visible={myDecksFilterModalVisible}
        onClose={() => setMyDecksFilterModalVisible(false)}
        currentSort={myDecksSort}
        currentCategories={myDecksSelectedCategories}
        onApply={(newSort, newCategories) => {
          setMyDecksSort(newSort);
          setMyDecksSelectedCategories(newCategories);
          setMyDecksFilterModalVisible(false);
        }}
        showSortOptions={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControlContainer: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  segmentedControlInner: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderBottomEndRadius: 70,
    borderBottomStartRadius: 70,
    overflow: 'hidden',
    shadowColor: '#333333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
    borderColor: '#333333',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  pillContainer: {
    borderWidth: 1,
    borderColor: '#444444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    height: 44,
    marginHorizontal: '17%',
    borderRadius: 25,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  pillIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 25,
  },
  pillTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  // My Decks list styles
  myDecksList: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    height: 235,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
  },
  favoriteSliderWrapper: {
    marginBottom: 12,
    paddingBottom: '25%',
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
    height: 215,
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
  favoriteSlideItem: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  favoriteSlideGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  // Search and filter styles removed
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  typeChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F98A21',
    zIndex: 10,
  },
  typeChipBottomLeft: {
    left: 16,
    bottom: 16,
  },
  typeChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
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
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalValue: {
    // typography.styles.body ve renk dışarıdan
  },
  modalFieldBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardFieldBox: {
    backgroundColor: '#fffefa',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ffe0c3',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
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
    left: -160, // İkonun yarısının taşması için
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
    top: 0
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
  // Fade efekti için stiller
  maskedView: {
    // flex: 1 kaldırıldı
  },
  maskGradient: {
    flexDirection: 'row',
    height: '100%',
  },
  // MyDecks Card styles
  myDecksCard: {
    marginTop: '21%',
  },
  myDecksCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 180,
  },
  myDecksContent: {
    flexDirection: 'row',

  },
  myDecksTextContainer: {
    flex: 1,
    marginRight: 15,
    gap: 5,
  },
  myDecksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: '5%',
  },
  myDecksImageContainer: {
    width: 150,
    height: 150,
    marginTop: 12,
  },
  myDecksImage: {
    width: 160,
    height: 160,
  },
  myDecksSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
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