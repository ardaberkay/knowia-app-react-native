import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Modal, FlatList, TextInput, Pressable, Image, Switch } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { setDeckStarted } from '../../services/DeckService';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
 
import { Iconify } from 'react-native-iconify';
import { Alert as RNAlert } from 'react-native';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../../components/ui/CircularProgress';
import CreateButton from '../../components/tools/CreateButton';

export default function DeckDetailScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [isStarted, setIsStarted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
  const [learnedCardsCount, setLearnedCardsCount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardSort, setCardSort] = useState('original'); // 'original', 'az', 'fav'
  const [originalCards, setOriginalCards] = useState([]);
  const filterIconRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [shareComponentVisible, setShareComponentVisible] = useState(false);
  const [cardsModalVisible, setCardsModalVisible] = useState(false);
  const [searchBarShouldFocus, setSearchBarShouldFocus] = useState(false);
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [shareLoading, setShareLoading] = useState(false);
  const [categoryInfo, setCategoryInfo] = useState(deck.categories || null);
  const { t } = useTranslation();

  // Header scroll affordance states
  const nameScrollRef = useRef(null);
  const [nameHasOverflow, setNameHasOverflow] = useState(false);
  const [nameContainerWidth, setNameContainerWidth] = useState(0);
  const [nameContentWidth, setNameContentWidth] = useState(0);
  const [showNameScrollbar, setShowNameScrollbar] = useState(false);

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>{t('deckDetail.errorMessage', 'Deste bilgisi bulunamadı.')}</Text>
      </SafeAreaView>
    );
  }

  const fetchProgress = async () => {
    setProgressLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Bu destedeki toplam kart sayısını çek
      const { data: totalCards, error: totalError } = await supabase
        .from('cards')
        .select('id')
        .eq('deck_id', deck.id);
      
      if (totalError) throw totalError;
      const total = totalCards ? totalCards.length : 0;
      
      // Bu destedeki kart ID'lerini al
      const cardIds = totalCards.map(card => card.id);
      
      // Kullanıcının bu destedeki öğrendiği kart sayısını çek
      const { data: progressData, error } = await supabase
        .from('user_card_progress')
        .select('card_id, status')
        .eq('user_id', user.id)
        .in('card_id', cardIds)
        .eq('status', 'learned');
      
      if (error) throw error;
      const learned = progressData ? progressData.length : 0;
      
      setProgress(total > 0 ? learned / total : 0);
      setLearnedCardsCount(learned);
    } catch (e) {
      console.error('Progress fetch error:', e);
      setProgress(0);
    } finally {
      setProgressLoading(false);
    }
  };

  // Progress'i hemen yüklemeye başla (deck varsa)
  useEffect(() => {
    if (deck?.id) {
      fetchProgress();
    }
  }, [deck?.id]); // deck.id varsa hemen başla

  // Sayfa focus olduğunda progress ve deck verisini güncelle
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      // Progress'i güncelle
      fetchProgress();
      
      // Deck verisini güncelle (kategori bilgisi dahil)
      try {
        const { data, error } = await supabase
          .from('decks')
          .select('*, profiles:profiles(username, image_url), categories:categories(id, name, sort_order)')
          .eq('id', deck.id)
          .single();
        
        if (error) throw error;
        
        // Deck verisini güncelle
        if (data) {
          // Route params'ı güncelle
          route.params.deck = data;
          // Category info'yu güncelle
          setCategoryInfo(data.categories);
        }
      } catch (e) {
        console.error('Deck verisi güncellenemedi:', e);
      }
    });

    return unsubscribe;
  }, [navigation, deck.id]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const { data, error } = await supabase
          .from('cards')
          .select('id, question, answer, image, example, note, created_at')
          .eq('deck_id', deck.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCards(data || []);
        setOriginalCards(data || []);
      } catch (e) {
        setCards([]);
        setOriginalCards([]);
      }
    };
    fetchCards();
  }, [deck.id]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredCards(cards);
    } else {
      const s = search.trim().toLowerCase();
      setFilteredCards(
        cards.filter(
          c => (c.question && c.question.toLowerCase().includes(s)) || (c.answer && c.answer.toLowerCase().includes(s))
        )
      );
    }
  }, [search, cards]);

  useEffect(() => {
    const fetchFavoriteCards = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('favorite_cards')
          .select('card_id')
          .eq('user_id', user.id);
        if (error) throw error;
        setFavoriteCards((data || []).map(f => f.card_id));
      } catch (e) {
        setFavoriteCards([]);
      }
    };
    fetchFavoriteCards();
  }, [deck.id]);

  useEffect(() => {
    setFilteredCards(sortCards(cardSort, cards));
  }, [cardSort, cards, originalCards, favoriteCards]);

  useEffect(() => {
    // Kullanıcı id'sini çek
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      // Eğer kullanıcı deste sahibi ise share component'i göster
      if (user?.id && deck.user_id === user.id) {
        setShareComponentVisible(true);
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (cardsModalVisible) {
      setSearchBarShouldFocus(true);
    } else {
      setSearchBarShouldFocus(false);
    }
  }, [cardsModalVisible]);


  const handleStart = async () => {
    try {
      await setDeckStarted(deck.id);
      setIsStarted(true);
      navigation.navigate('SwipeDeck', { deck });
    } catch (error) {
      Alert.alert(t('deckDetail.error', 'Hata'), t('deckDetail.errorMessageDeck', 'Deste başlatılamadı.'));
    }
  };

  // Favori kontrolü ve ekleme
  const checkFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('favorite_decks')
      .select('id')
      .eq('user_id', user.id)
      .eq('deck_id', deck.id)
      .single();
    setIsFavorite(!!data);
  };

  React.useEffect(() => {
    checkFavorite();
  }, [deck.id]);

  const handleAddFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Önceden favori mi kontrol et
      const { data: existing } = await supabase
        .from('favorite_decks')
        .select('id')
        .eq('user_id', user.id)
        .eq('deck_id', deck.id)
        .single();
      if (existing) {
        // Favoriden çıkar
        await handleRemoveFavorite();
        return;
      }
      const { error } = await supabase
        .from('favorite_decks')
        .insert({ user_id: user.id, deck_id: deck.id });
      if (error) throw error;
      setIsFavorite(true);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  const handleRemoveFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('favorite_decks')
        .delete()
        .eq('user_id', user.id)
        .eq('deck_id', deck.id);
      if (error) throw error;
      setIsFavorite(false);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  const handleToggleFavoriteCard = async (cardId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (favoriteCards.includes(cardId)) {
        // Favoriden çıkar
        await supabase
          .from('favorite_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId);
        setFavoriteCards(favoriteCards.filter(id => id !== cardId));
      } else {
        // Favoriye ekle
        await supabase
          .from('favorite_cards')
          .insert({ user_id: user.id, card_id: cardId });
        setFavoriteCards([...favoriteCards, cardId]);
      }
    } catch (e) {
      // Alert kaldırıldı
    }
  };

  const updateShareSetting = async (newValue) => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('decks')
        .update({ is_shared: newValue })
        .eq('id', deck.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setIsShared(newValue);
      deck.is_shared = newValue;
      Alert.alert(t('common.success', 'Success'), t('deckDetail.shareUpdated', 'Sharing settings updated'));
    } catch (e) {
      Alert.alert(t('common.error', 'Error'), t('deckDetail.shareUpdateError', 'Sharing settings could not be updated'));
    } finally {
      setShareLoading(false);
    }
  };

  const handleToggleShare = (nextValue) => {
    if (shareLoading) return;
    if (nextValue) {
      Alert.alert(
        t('common.warning', 'Uyarı'),
        t(
          'deckDetail.shareConfirmMessage',
          'Desteyi toplulukta paylaştıktan sonra bölümlerde herhangi bir değisiklik yapamayacaksın. Onaylıyor musun?'
        ),
        [
          { text: t('common.no', 'Hayır'), style: 'cancel' },
          { text: t('common.yes', 'Evet'), onPress: () => updateShareSetting(true) },
        ],
        { cancelable: true }
      );
    } else {
      updateShareSetting(false);
    }
  };

  const handleShowShareDetails = () => {
    Alert.alert(
      t('deckDetail.shareDetails', 'Community Sharing Details'),
      t('deckDetail.shareDetailsText', 'When this deck is shared with the community, it can be viewed and used by other users. You can disable sharing at any time.')
    );
  };

  // Header'a yatay kebab ekle
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ marginRight: 8 }}
        >
          <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={28} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.text]);

  const sortCards = (type, cardsList) => {
    if (type === 'az') {
      return [...cardsList].sort((a, b) => (a.question || '').localeCompare(b.question || '', 'tr'));
    } else if (type === 'fav') {
      return [...cardsList].filter(card => favoriteCards.includes(card.id));
    } else {
      return [...originalCards];
    }
  };

  const handleBackFromDetail = () => {
    setSelectedCard(null);
    setSearchBarShouldFocus(false);
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "famicons:language", // Dil
      2: "material-symbols:science", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "hugeicons:knowledge-01" // Genel Kültür
    };
    return icons[sortOrder] || "material-symbols:category-outline-rounded";
  };

  // Kategori rengine göre renk belirle
  const getCategoryColor = (sortOrder) => {
    const palette = {
      1: '#3B82F6', // Dil - mavi
      2: '#10B981', // Bilim - yeşil
      3: '#8B5CF6', // Matematik - mor
      4: '#F59E0B', // Tarih - amber
      5: '#06B6D4', // Coğrafya - camgöbeği
      6: '#EF4444', // Sanat ve Kültür - kırmızı
      7: '#F472B6', // Kişisel Gelişim - pembe
      8: '#6366F1', // Genel Kültür - indigo
    };
    return palette[sortOrder] || colors.buttonColor;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Birleşik Deck Info Kartı */}
        <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 12, paddingVertical: 20 }]}>
          
          {/* Unified Deck Header Section */}
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
            <View
              style={[styles.unifiedDeckHeader, { 
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadowColor,
              }]}
            >
              {/* Left Side - Category Icon */}
              {categoryInfo && (
                <View style={styles.leftSection}>
                  <LinearGradient
                    colors={[getCategoryColor(categoryInfo.sort_order) + '25', getCategoryColor(categoryInfo.sort_order) + '15']}
                    style={[styles.categoryIconSection, { 
                      borderColor: getCategoryColor(categoryInfo.sort_order),
                    }]}
                  >
                    <Iconify 
                      icon={getCategoryIcon(categoryInfo.sort_order)} 
                      size={50} 
                      color={getCategoryColor(categoryInfo.sort_order)} 
                    />
                  </LinearGradient>
                </View>
              )}
              
              {/* Center Divider */}
              <View style={[styles.centerDivider, { backgroundColor: colors.progressBar || '#e0e0e0' }]} />
              
              {/* Right Side - Deck Names (horizontal scroll when overflow) */}
              <View style={styles.rightSection} onLayout={(e) => setNameContainerWidth(e.nativeEvent.layout.width)}>
                <ScrollView
                  horizontal
                  ref={nameScrollRef}
                  showsHorizontalScrollIndicator={showNameScrollbar && nameHasOverflow}
                  contentContainerStyle={{ alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 0 }}
                  style={{ width: '100%' }}
                  onContentSizeChange={(w) => {
                    setNameContentWidth(w);
                    const overflow = w > nameContainerWidth + 2;
                    if (overflow && !nameHasOverflow) {
                      setNameHasOverflow(true);
                      // Show scrollbar briefly, then perform a small nudge
                      setShowNameScrollbar(true);
                      setTimeout(() => setShowNameScrollbar(false), 1800);
                      requestAnimationFrame(() => {
                        if (nameScrollRef.current) {
                          try {
                            nameScrollRef.current.scrollTo({ x: 18, animated: true });
                            setTimeout(() => {
                              nameScrollRef.current && nameScrollRef.current.scrollTo({ x: 0, animated: true });
                            }, 700);
                          } catch {}
                        }
                      });
                    }
                  }}
                >
                  <View style={{ alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 4 }}>
                    <Text style={[styles.deckTitleUnified, { color: colors.cardQuestionText }]} numberOfLines={1}>{deck.name}</Text>
                    {deck.to_name && (
                      <>
                        <View style={[styles.miniDivider, { backgroundColor: colors.cardDivider }]} />
                        <Text style={[styles.deckSubtitleUnified, { color: colors.cardQuestionText }]} numberOfLines={1}>{deck.to_name}</Text>
                      </>
                    )}
                  </View>
                </ScrollView>
                {/* Right-edge hint removed to avoid magnifier effect */}
              </View>
            </View>
          </View>

          {/* Progress Section - Compact */}
          <View style={{ marginBottom: 15, alignItems: 'center', position: 'relative' }}>
            {/* Card Count - Top Right */}
            <View style={[styles.cardCountTopRight, { backgroundColor: colors.buttonColor }]}>
              <Iconify icon="ri:stack-fill" size={17} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.caption, styles.cardCountTextTopRight]}>{deck.card_count || 0}</Text>
            </View>
            
            {/* Learned Cards Count - Top Left */}
            <View style={[styles.learnedCardsTopLeft, { backgroundColor: colors.secondary }]}>
              <Iconify icon="dashicons:welcome-learn-more" size={17} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.caption, styles.learnedCardsTextTopLeft]}>{learnedCardsCount}</Text>
            </View>
            
            <CircularProgress 
              progress={progress} 
              size={185} 
              strokeWidth={22}
              showText={!progressLoading}
              containerStyle={{ marginTop: 25 }}
              shouldAnimate={!progressLoading}
            fullCircle={true}
            />
          </View>

          {/* Details Section - Prominent */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Iconify icon="mage:checklist-note" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText, fontSize: 18 }]}>{t('deckDetail.details', 'Detaylar')}</Text>
            </View>
            {deck.description && deck.description.trim().length > 0 ? (
              <ScrollView style={{ maxHeight: 70 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                <Text style={[styles.deckDescription, typography.styles.body, { color: colors.cardAnswerText, fontSize: 16, lineHeight: 24 }]}>{deck.description}</Text>
              </ScrollView>
            ) : (
              <View style={{ height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, padding: 16 }}>
                <Text style={[styles.deckDescription, typography.styles.body, { color: colors.muted, textAlign: 'center', fontSize: 16 }]}>
                  {t('deckDetail.noDescription', 'Deste için detay verilmemiş.')}
                </Text>
              </View>
            )}
          </View>

        </View>
        {/* Kartlar ve Bölümler */}
        <View style={[styles.cardsHeaderCard,  { backgroundColor:  colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation }]}>
          <TouchableOpacity onPress={() => navigation.navigate('DeckCards', { deck })} activeOpacity={0.8} style={styles.sectionButton}>
            <View style={[styles.cardsHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Iconify icon="ph:cards-three" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
                <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.cards', 'Kartlar')}</Text>
              </View>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={23} color={colors.headText} />
            </View>
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: -5 }]} />
          
          <TouchableOpacity onPress={() => navigation.navigate('Chapters', { deck })} activeOpacity={0.8} style={styles.sectionButton}>
            <View style={[styles.cardsHeaderRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Iconify icon="streamline-flex:module-puzzle-2" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
                <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.chapters', 'Bölümler')}</Text>
              </View>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={23} color={colors.headText} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ height: 12 }} />
        {/* Toplulukla Paylaş Kutusu (Glassmorphism) */}
        {shareComponentVisible && (
          <View 
            style={[
              styles.infoCardGlass, 
              { 
                backgroundColor: colors.cardBackground, 
                borderColor: colors.cardBorder, 
                shadowColor: colors.shadowColor, 
                shadowOffset: colors.shadowOffset, 
                shadowOpacity: colors.shadowOpacity, 
                shadowRadius: colors.shadowRadius, 
                elevation: colors.elevation, 
                width: '100%', 
                maxWidth: 440, 
                alignSelf: 'center', 
                paddingVertical: 10,
              }
            ]}
          >
            <View style={styles.switchRow}>
              <View style={styles.labelRow}>
                <Iconify icon="fluent:people-community-20-filled" size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, { color: colors.cardQuestionText }]}>{t('deckDetail.shareWithCommunity', 'Toplulukla Paylaş')}</Text>
                <TouchableOpacity onPress={handleShowShareDetails} activeOpacity={0.7} style={{ marginLeft: 8, marginTop: 2 }}>
                  <Iconify icon="material-symbols:info-outline" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Switch
                value={isShared}
                onValueChange={handleToggleShare}
                trackColor={{ false: '#e0e0e0', true: '#5AA3F0' }}
                thumbColor={isShared ? colors.secondary : '#f4f3f4'}
                disabled={shareLoading}
              />
            </View>
          </View>
        )}
      </ScrollView>
      {/* Sabit alt buton barı */}
      <View style={[styles.fixedButtonBarOuter, { shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation }]}>
        <View style={styles.fixedButtonBarInner}>
        <View style={styles.fixedButtonBarBlurContainer}>
        <BlurView intensity={8} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFillObject} />
            <View style={styles.buttonRowModern}>
              <TouchableOpacity
                style={[styles.secondaryButton, { 
                  flex: 1,
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.buttonColor,
                  shadowColor: colors.buttonColor,
                }]}
                onPress={() => navigation.navigate('AddCard', { deck })}
              >
                <Iconify icon="streamline-ultimate:card-add-1-bold" size={20} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[styles.secondaryButtonText, typography.styles.button, { color: colors.buttonColor }]}>{t('deckDetail.addCard', 'Kart Ekle')}</Text>
              </TouchableOpacity>
              <CreateButton
                onPress={handleStart}
                text={t('deckDetail.start', 'Başla')}
                style={{ flex: 1,}}
                showIcon={true}
                iconName="streamline:startup-solid"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Modal Bottom Sheet Menü */}
      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        />
        <View style={[styles.bottomSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          {/* Desteyi Düzenle sadece sahibi ise */}
          {currentUserId && deck.user_id === currentUserId && (
            <TouchableOpacity style={[styles.sheetItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate('DeckEdit', { deck }); }}>
              <Iconify icon="akar-icons:edit" size={22} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, styles.sheetItemText, { color: colors.text }]}>{t('deckDetail.edit', 'Desteyi Düzenle')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.sheetItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); handleAddFavorite(); }}>
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={22}
              color={isFavorite ? '#F98A21' : colors.text}
              style={{ marginRight: 12 }}
            />
            <Text style={[typography.styles.body, styles.sheetItemText, { color: isFavorite ? '#F98A21' : colors.text }]}>
              {isFavorite ? t('deckDetail.removeFavorite', 'Favorilerden Çıkar') : t('deckDetail.addFavorite', 'Favorilere Ekle')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sheetItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); /* Deste Sil fonksiyonu */ }}>
            <Iconify icon="mdi:garbage" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
            <Text style={[typography.styles.body, styles.sheetItemText, { color: '#E74C3C' }]}>{t('deckDetail.deleteDeck', 'Desteyi Sil')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sheetItem, { borderBottomColor: 'transparent' }]} onPress={() => setMenuVisible(false)}>
            <Iconify icon="material-symbols:close-rounded" size={22} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={[typography.styles.body, styles.sheetItemText, { color: colors.text }]}>{t('deckDetail.close', 'Kapat')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deckTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  deckDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  bottomButtonContainer: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#007AFF', // override with theme
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  favButton: {
    flex: 1,
    backgroundColor: '#fff', // override with theme
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  favButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonTextDisabled: {
    // color theme ile override edilecek
  },
  // Modern stiller
  headerCardModern: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  deckTitleModern: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F98A21',

    textAlign: 'center',
  },
  statsContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  statBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statBadgeTextModern: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelModern: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardModern: {
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
  },
  progressContainerModern: {
    marginTop: 8,
  },
  progressBarModern: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillModern: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  bottomButtonContainerModern: {
    padding: 18,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 'auto',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  favButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 5,
  },
  favButtonActive: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Glassmorphism + Floating Card stilleri
  bgGradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 32,
  },
  floatingCardWrapper: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 18,
  },
  floatingCard: {
    width: '88%',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  deckTitleGlass: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  statsRowGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statBadgeGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  statBadgeTextGlass: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelGlass: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardGlass: {
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 11,
    borderWidth: 1,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  progressContainerGlass: {
    marginTop: 8,
  },
  progressBarGlass: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffe0c3',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillGlass: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  buttonRowGlass: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 8,
  },
  favButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  favButtonActiveGlass: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fixedButtonBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  fixedButtonBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  fixedButtonBarInner: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
  },
  fixedButtonBarBlurContainer: {
    position: 'relative',
    paddingVertical: 18,
    backgroundColor: 'transparent',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardsHeaderCard: {
    borderRadius: 28,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 10,
  },
  cardsSearchBarWrapperModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 10,
  },
  cardsSearchIcon: {
    marginRight: 6,
  },
  cardsSearchBarModern: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    borderWidth: 0,
  },
  cardsFilterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffff',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F98A21',
    height: 48,
    aspectRatio: 1,
  },
  cardsListContainer: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  cardItemGlass: {
    width: '100%',
    minHeight: 110,
    backgroundColor: '#fff',
    borderRadius: 28,
    marginBottom: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F98A21',
    shadowColor: '#F98A21',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardQuestion: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#F98A21',
    marginBottom: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#ffe0c3',
    alignSelf: 'stretch',
    marginVertical: 6,
    borderRadius: 1,
  },
  cardAnswer: {
    fontSize: 15,
    color: '#333',
    marginTop: 2,
  },
  cardsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    width: '100%',
  },
  cardsHeaderIcon: {
    marginRight: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  cardTextCol: {
    width: '80%',
    maxWidth: 320,
  },
  cardFavIconBtn: {
    padding: 2,
  },
  cardDetailContainer: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  cardDetailHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  cardDetailImage: {
    width: 120,
    height: 160,
    maxWidth: '100%',
    borderRadius: 18,
    marginBottom: 14,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  cardDetailTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 18,
  },
  cardDetailText: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'normal',
  },
  cardDetailBody: {
    marginBottom: 0,
    width: '100%',
  },
  cardDetailDate: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  cardDetailCloseButton: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  cardDetailCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
    justifyContent: 'center',
  },
  cardDetailDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ffe0c3',
    borderRadius: 1,
    marginHorizontal: 14,
  },
  dividerLine: {
    width: '60%',
    height: 1,
    alignSelf: 'center',
    marginVertical: 6,
  },
  sectionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    width: '100%',
  },
  // Share with community styles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailsRow: {
    alignSelf: 'flex-end',
    paddingRight: 10,
    marginTop: -10,
  },
  detailsText: {
    textDecorationLine: 'underline',
  },
  // Unified Deck Header Styles
  unifiedDeckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 28,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 120,
  },
  leftSection: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconSection: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDivider: {
    width: 2,
    height: 60,
    borderRadius: 1,
    marginHorizontal: 16,
  },
  rightSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  deckTitleUnified: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  deckSubtitleUnified: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  miniDivider: {
    width: '60%',
    height: 1,
    borderRadius: 1,
    marginVertical: 4,
  },
  // Card Count Top Right Styles
  cardCountTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  cardCountTextTopRight: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  // Learned Cards Count Top Left Styles
  learnedCardsTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  learnedCardsTextTopLeft: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  // Secondary Button Styles
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    borderWidth: 2,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});