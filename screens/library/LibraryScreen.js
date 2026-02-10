import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, Alert, ActivityIndicator, Animated, ScrollView, RefreshControl, Image, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardListItem from '../../components/lists/CardList';
import LottieView from 'lottie-react-native';
import MyDecksList from '../../components/lists/MyDecksList';
import MyDecksSkeleton from '../../components/skeleton/MyDecksSkeleton';
import CardDetailView from '../../components/layout/CardDetailView';
import FilterModal, { FilterModalButton } from '../../components/modals/FilterModal';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileAvatarButton from '../../components/layout/ProfileAvatarButton';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import { getLanguages } from '../../services/LanguageService';

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

export default function LibraryScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const insets = useSafeAreaInsets();
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
  const [pillWidth, setPillWidth] = useState(() => Dimensions.get('window').width * 0.59);
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
  const [allLanguages, setAllLanguages] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  useEffect(() => {
    getLanguages().then(setAllLanguages);
  }, []);

  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = scale(16) * 2;
  const cardSpacing = scale(12);
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;
  
  // Responsive favorites sekmesi ScrollView paddingTop - useMemo ile optimize edilmiş
  const favoritesScrollViewPaddingTop = useMemo(() => {
    const isTablet = getIsTablet();
    return isTablet ? '25%' : '48%'; // Tablet: %5, diğerleri: %48
  }, [width, height]);
  
  // Responsive myDecks card top margin - useMemo ile optimize edilmiş
  const myDecksCardTopMargin = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    const isTablet = getIsTablet();
    
    // Tablet için üst boşluğu azalt
    if (isTablet) {
      return height * 0.01; // Tablet: ekran yüksekliğinin %4'ü
    }
    
    if (isSmallPhone) {
      return height * 0.07; // Küçük telefon: ekran yüksekliğinin %7'si
    } else if (isSmallScreen) {
      return height * 0.10; // Küçük ekran: ekran yüksekliğinin %10'u
    } else {
      return height * 0.08; // Normal ekranlar: ekran yüksekliğinin %8'i
    }
  }, [width, height]);
  
  // Responsive myDecks search container top margin - useMemo ile optimize edilmiş
  const myDecksSearchContainerTopMargin = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    
    if (isSmallPhone) {
      return verticalScale(2); // Küçük telefon: minimal boşluk
    } else if (isSmallScreen) {
      return verticalScale(4); // Küçük ekran: az boşluk
    } else if (isTablet) {
      return verticalScale(12); // Tablet: orta boşluk
    } else {
      return verticalScale(8); // Normal ekranlar: üstten boşluk
    }
  }, [width, height, isTablet]);
  
  // Responsive favorite slider deck boyutları - useMemo ile optimize edilmiş
  const favoriteSliderDimensions = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    
    // Slider height - referans: verticalScale(170) - minimal artırıldı
    let sliderHeight;
    if (isSmallPhone) {
      sliderHeight = height * 0.25; // Küçük telefon: ekran yüksekliğinin %25'i (önceki: %24)
    } else if (isSmallScreen) {
      sliderHeight = height * 0.23; // Küçük ekran: ekran yüksekliğinin %23'ü (önceki: %22)
    } else if (isTablet) {
      sliderHeight = height * 0.31; // Tablet: ekran yüksekliğinin %31'i (önceki: %30)
    } else {
      // Normal ve büyük ekranlar için
      const baseHeight = verticalScale(220); // Önceki: 200
      const maxHeight = height * 0.29; // Önceki: 0.28
      sliderHeight = Math.min(baseHeight, maxHeight);
    }
    
    // Padding değerleri
    const basePadding = isSmallPhone ? scale(12) : (isTablet ? scale(20) : scale(16));
    
    // Deck içi element boyutları
    return {
      sliderHeight,
      fontSize: isSmallPhone ? moderateScale(16) : (isTablet ? moderateScale(22) : moderateScale(20)),
      dividerMargin: isSmallPhone ? verticalScale(4) : (isTablet ? verticalScale(8) : verticalScale(5)), // Name ve to_name'in divider'a uzaklığı
      padding: basePadding,
      // Profile section için azaltılmış padding (left bottom)
      profileBottomPadding: basePadding * 0.7, // %50 azaltıldı
      profileLeftPadding: basePadding * 0.7, // %50 azaltıldı
      // Favorite button için azaltılmış padding (top right)
      favoriteButtonTopPadding: basePadding * 0.7, // %50 azaltıldı
      favoriteButtonRightPadding: basePadding * 0.7, // %50 azaltıldı
      // Badge için azaltılmış padding (right bottom)
      badgeBottomPadding: basePadding * 0.7, // %50 azaltıldı
      badgeRightPadding: basePadding * 0.5, // %50 azaltıldı
      profileAvatarSize: isSmallPhone ? scale(28) : (isTablet ? scale(40) : scale(36)),
      profileUsernameSize: isSmallPhone ? moderateScale(13) : (isTablet ? moderateScale(17) : moderateScale(16)),
      badgeIconSize: isSmallPhone ? moderateScale(16) : (isTablet ? moderateScale(22) : moderateScale(20)),
      badgeTextSize: isSmallPhone ? moderateScale(14) : (isTablet ? moderateScale(20) : moderateScale(18)),
      favoriteButtonSize: isSmallPhone ? moderateScale(20) : (isTablet ? moderateScale(28) : moderateScale(26)),
      favoriteButtonPadding: isSmallPhone ? moderateScale(6) : moderateScale(8),
      categoryIconSize: isSmallPhone ? moderateScale(105, 0.3) : (isTablet ? moderateScale(160, 0.3) : moderateScale(150, 0.3)), // İkon küçültüldü
      categoryIconLeft: isSmallPhone ? moderateScale(-50, 0.3) : (isTablet ? moderateScale(-75, 0.3) : moderateScale(-70, 0.3)), // İkonun yarısı gözükecek şekilde sola yapışık
    };
  }, [width, height, isTablet]);

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

  const fetchFavorites = async (silent = false) => {
    if (!silent) setFavoritesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id); // currentUserId'yi burada da set et
      const decks = await getFavoriteDecks(user.id);
      // is_admin_created kontrolü - tüm kategoriler için geçerli
      const modifiedDecks = (decks || []).map((deck) => {
        if (deck.is_admin_created) {
          return {
            ...deck,
            profiles: {
              ...deck.profiles,
              username: 'Knowia',
              image_url: null, // app-icon.png kullanılacak
            },
          };
        }
        return deck;
      });
      setFavoriteDecks(modifiedDecks);
      
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id));
  }, []);

  // Favoriler sekmesindeki birleşik liste kaldırıldı

  // Favorilerim sekmesindeki birleşik render kaldırıldı

  // Favori deste ekleme/çıkarma fonksiyonları
  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    // is_admin_created kontrolü - tüm kategoriler için geçerli
    const modifiedDecks = (decks || []).map((deck) => {
      if (deck.is_admin_created) {
        return {
          ...deck,
          profiles: {
            ...deck.profiles,
            username: 'Knowia',
            image_url: null, // app-icon.png kullanılacak
          },
        };
      }
      return deck;
    });
    setFavoriteDecks(modifiedDecks);
  };
  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    // is_admin_created kontrolü - tüm kategoriler için geçerli
    const modifiedDecks = (decks || []).map((deck) => {
      if (deck.is_admin_created) {
        return {
          ...deck,
          profiles: {
            ...deck.profiles,
            username: 'Knowia',
            image_url: null, // app-icon.png kullanılacak
          },
        };
      }
      return deck;
    });
    setFavoriteDecks(modifiedDecks);
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
            try {
              const { error } = await supabase.from('decks').delete().eq('id', deckId);
              
              if (error) {
                throw error;
              }
              
              setMyDecks(prev => prev.filter(deck => deck.id !== deckId));
              setFavoriteDecks(prev => prev.filter(deck => deck.id !== deckId));
              setActiveDeckMenuId(null);
              
              showSuccess(t('library.deleteDeckSuccess', 'Deste başarıyla silindi'));
            } catch (e) {
              showError(t('library.deleteDeckError', 'Deste silinemedi'));
            }
          }
        }
      ]
    );
  };

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
              const { error } = await supabase
                .from('cards')
                .delete()
                .eq('id', cardId);
              
              if (error) {
                throw error;
              }
              
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
                if (favCardsSort === 'az') {
                  remainingCards.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
                } else if (favCardsSort === 'unlearned') {
                  remainingCards = remainingCards.filter(c => c.status !== 'learned');
                } else if (favCardsSort !== 'fav') {
                  remainingCards.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
    } else if (favCardsSort === 'learned') {
      list = list.filter(c => c.status === 'learned');
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return list;
  }, [favoriteCards, favCardsQuery, favCardsSort]);

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
      list = list.filter(d => favoriteDecks.some(favDeck => 
        (typeof favDeck === 'object' ? favDeck.id : favDeck) === d.id
      ));
    }
  
    // 5. Apply sorting
    switch (myDecksSort) {
      case 'az':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'favorites':
        // Favoriler önce, sonra A-Z
        list.sort((a, b) => {
          const aIsFavorite = favoriteDecks.some(favDeck => (typeof favDeck === 'object' ? favDeck.id : favDeck) === a.id);
          const bIsFavorite = favoriteDecks.some(favDeck => (typeof favDeck === 'object' ? favDeck.id : favDeck) === b.id);
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
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        break;
      case 'default':
      default:
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
    }
  
    return list;
    // Bağımlılık listesi: Bu değişkenlerden biri değiştiğinde kod yeniden çalışır
  }, [myDecks, myDecksQuery, myDecksSelectedCategories, myDecksSort, favoriteDecks, selectedLanguages]);

  // MyDecks Card
  const renderMyDecksCard = () => {
    return (
      <View style={[styles.myDecksCard, styles.myDecksCardContainer, { backgroundColor: colors.cardBackground || colors.cardBackgroundTransparent || (isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)'), marginTop: myDecksCardTopMargin }]}>
        <View style={styles.myDecksContent}>
          <View style={styles.myDecksTextContainer}>
            <View style={styles.myDecksTitleContainer}>
              <Iconify icon="ph:cards-fill" size={moderateScale(26)} color="#F98A21" style={{ marginRight: scale(6) }} />
              <Text style={[typography.styles.h2, { color: colors.text}]}>
                {t('library.myDecksHeading', 'Destelerim')}
              </Text>
            </View>
            <Text style={[typography.styles.caption, { color: colors.muted, lineHeight: moderateScale(22), marginRight: scale(3) }]}>
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
        <View style={[styles.myDecksSearchContainer, { marginTop: myDecksSearchContainerTopMargin }]}>
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
      <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: moderateScale(200, 0.3), height: moderateScale(200, 0.3) }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: moderateScale(100, 0.3), height: moderateScale(100, 0.3) }} />
    </View>
  );


  return (
    <View style={[styles.container]}>
      {/* Header + Pill Tabs - Hafif saydam arka plan (BlurView kaldırıldı, geçişte dim sorununu önlemek için) */}
      <View style={[styles.segmentedControlContainer, { top: 0 }]} pointerEvents="box-none">
        <View
          style={[styles.segmentedControlInner, { paddingTop: insets.top, backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground || (isDarkMode ? 'rgba(50, 50, 50, 0.95)' : 'rgba(50, 50, 50, 0.1)') }]}
          pointerEvents="box-none"
        >
          {/* Header Content */}
          <View style={styles.headerContent}>
            <View style={styles.headerLeft} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('tabs.myLibrary', 'Kitaplığım')}
            </Text>
            <View style={{ marginRight: -36 }}>
              <ProfileAvatarButton />
            </View>
          </View>
          <View
            style={[styles.pillContainer, { borderColor: colors.cardBordaer || '#444444', backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)' }]}
            onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
          >
          <View style={styles.pillIndicatorWrapper}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pillIndicator,
                {
                  width: (pillWidth > 0 ? (pillWidth - 4) / 2 : 0),
                  transform: [
                    {
                      translateX: tabScroll.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (pillWidth > 0 ? (pillWidth - 4) / 2 : 0)],
                        extrapolate: 'clamp',
                      })
                    }
                  ],
                  backgroundColor: colors.buttonColor || '#F98A21',
                }
              ]}
            />
          </View>
          <TouchableOpacity style={[styles.pillTab, { width: '50%' }]} activeOpacity={0.8} onPress={() => handleSetPage(0)}>
            <Text style={[styles.pillLabel, { color: activeTab === 'myDecks' ? colors.text : (colors.border || '#666') }]}>
              {t('library.myDecks', 'Destelerim')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pillTab, { width: '50%' }]} activeOpacity={0.8} onPress={() => handleSetPage(1)}>
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
            <MyDecksSkeleton ListHeaderComponent={renderMyDecksCard} />
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
        <View key="favorites" style={{ flex: 1, marginHorizontal: scale(10) }}>
          {favoritesLoading ? (
            renderLoading()
          ) : (
            <ScrollView
              style={{ flex: 1, backgroundColor: colors.background }}
              contentContainerStyle={{ paddingBottom: '12%', paddingTop: favoritesScrollViewPaddingTop, flexGrow: 1, paddingHorizontal: scale(4) }}
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
                <View style={[styles.favoriteHeaderRow, (favoriteDecks?.length === 0 && { zIndex: 10, elevation: 10 })]}>
                  <View style={{ flex: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="ph:cards-fill" size={moderateScale(26)} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                      {t('library.favoriteDecksTitle', 'Favori Destelerim')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30', flexShrink: 0 }]} onPress={() => navigation.navigate('FavoriteDecks')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}>
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(15)} color={colors.secondary}/>
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
                                        ? require('../../assets/app-icon.png')
                                        : deck.profiles?.image_url 
                                          ? { uri: deck.profiles.image_url } 
                                          : require('../../assets/avatar-default.png')
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
                                  style={{ position: 'absolute', top: favoriteSliderDimensions.favoriteButtonTopPadding, right: favoriteSliderDimensions.favoriteButtonRightPadding, zIndex: 10, backgroundColor: colors.iconBackground, padding: favoriteSliderDimensions.favoriteButtonPadding, borderRadius: moderateScale(999) }}
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
                                        <View style={{ width: scale(70), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: favoriteSliderDimensions.dividerMargin, alignSelf: 'center' }} />
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
                                    <Iconify icon="ri:stack-fill" size={favoriteSliderDimensions.badgeIconSize} color="#fff" style={{ marginRight: scale(4) }} />
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
                  <View style={[styles.favoriteSliderEmpty, { pointerEvents: 'box-none' }]}>
                    <Image
                      source={require('../../assets/deckbg.png')}
                      style={{ position: 'absolute', alignSelf: 'center', width: moderateScale(300, 0.3), height: moderateScale(300, 0.3), opacity: 0.2 }}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* Favorite Cards Section Header + Controls */}
                <View style={[styles.favoriteHeaderRow, { marginTop: verticalScale(40) }]}> 
                  <View style={{ flex: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                    <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
                      <Iconify icon="mdi:cards" size={moderateScale(26)} color="#F98A21" />
                    </View>
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]} numberOfLines={1}> 
                      {t('library.favoriteCardsTitle', 'Favori Kartlarım')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary, backgroundColor: colors.secondary + '30', flexShrink: 0 }]} onPress={() => navigation.navigate('FavoriteCards')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}> 
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(15)} color={colors.secondary}  />
                  </TouchableOpacity>
                </View>
                <View style={{ marginVertical: verticalScale(5) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), width: '98%', alignSelf: 'center' }}>
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
                  <View style={{ marginTop: verticalScale(14), paddingHorizontal: scale(4), pointerEvents: filteredFavoriteCards.length > 0 ? 'auto' : 'none' }}>
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
                          onDelete={() => handleDeleteCard(card.id)}
                          isOwner={isOwner}
                        />
                      );
                    })}
                    {filteredFavoriteCards.length === 0 ? (
                      <View style={styles.favoriteCardsEmpty}>
                        <Image
                          source={require('../../assets/cardbg.png')}
                          style={{ width: moderateScale(400, 0.3), height: moderateScale(400, 0.3), opacity: 0.2 }}
                          resizeMode="contain"
                        />
                      </View>
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
              <Iconify icon="mdi:arrow-back" size={moderateScale(24)} color={colors.text} />
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
                  size={moderateScale(24)}
                  color={favoriteCardIds.includes(selectedCard.id) ? '#F98A21' : colors.text}
                />
              </TouchableOpacity>
            )}
            {!selectedCard && <View style={{ width: scale(28) }} />}
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
        onApply={(newSort, newCategories, newLanguages) => {
          setMyDecksSort(newSort);
          setMyDecksSelectedCategories(newCategories);
          setMyDecksFilterModalVisible(false);
          setSelectedLanguages(newLanguages || []);
        }}
        showSortOptions={true}
        languages={allLanguages}
        currentLanguages={selectedLanguages}
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
    zIndex: 10,
  },
  segmentedControlInner: {
    paddingHorizontal: scale(24),
    paddingBottom: verticalScale(16),
    borderBottomEndRadius: moderateScale(70),
    borderBottomStartRadius: moderateScale(70),
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: scale(44),
    marginBottom: verticalScale(12),
  },
  headerLeft: {
    width: scale(47),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  pillContainer: {
    borderWidth: 1,
    borderColor: '#444444',
    height: scale(44),
    marginHorizontal: '17%',
    borderRadius: moderateScale(25),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  pillIndicatorWrapper: {
    position: 'absolute',
    left: moderateScale(2),
    top: moderateScale(2),
    bottom: moderateScale(2),
    right: moderateScale(2),
    overflow: 'hidden',
    borderRadius: moderateScale(23),
  },
  pillIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: moderateScale(23),
  },
  pillTab: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  favoriteSliderWrapper: {
    marginBottom: verticalScale(12),
    paddingBottom: '25%',
  },
  favoriteHeaderRow: {
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(14),
    marginTop: verticalScale(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoriteHeaderTitle: {
    fontSize: moderateScale(21),
    fontWeight: '800',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderRadius: moderateScale(30),
  },
  favoriteSlider: {
    // height dinamik olarak uygulanacak
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  favoriteSliderEmpty: {
    height: verticalScale(200),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(16),
    backgroundColor: 'transparent',
  },
  favoriteCardsEmpty: {
    height: verticalScale(200),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: 'transparent',
  },
  favoriteSlideItem: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(4),
    paddingBottom: verticalScale(8),
  },
  favoriteSlideGradient: {
    flex: 1,
    borderRadius: moderateScale(18),
    // padding dinamik olarak uygulanacak
    justifyContent: 'center',
    overflow: 'hidden', // İkonun taşan kısmını gizlemek için
  },
  favoriteSliderDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(8),
    gap: scale(6),
  },
  favoriteDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#F98A21',
  },
  // Count badge used in Favorites slider
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    marginRight: scale(8),
  },
  seeAllText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: scale(120),
  },
  deckProfileAvatar: {
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(99),
    marginRight: scale(6),
  },
  deckProfileUsername: {
    fontSize: moderateScale(15),
    color: '#BDBDBD',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    gap: verticalScale(-65),
  },
  loadingText: {
    fontSize: moderateScale(18),
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
  // MyDecks Card styles
  myDecksCard: {
    // marginTop dinamik olarak uygulanacak
  },
  myDecksCardContainer: {
    borderRadius: moderateScale(28),
    overflow: 'hidden',
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(8),
    minHeight: verticalScale(180),
  },
  myDecksContent: {
    flexDirection: 'row',

  },
  myDecksTextContainer: {
    flex: 1,
    marginRight: scale(15),
    gap: verticalScale(5),
  },
  myDecksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: '5%',
  },
  myDecksImageContainer: {
    width: moderateScale(150, 0.3),
    height: moderateScale(150, 0.3),
    marginTop: verticalScale(20),
  },
  myDecksImage: {
    width: moderateScale(160, 0.3),
    height: moderateScale(160, 0.3),
  },
  myDecksSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    // marginTop dinamik olarak uygulanacak
    paddingTop: verticalScale(12),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  modalCloseButton: {
    width: scale(28),
    height: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(4),
  },
  modalFavoriteButton: {
    width: scale(28),
    height: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(6),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  iconBackground: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 