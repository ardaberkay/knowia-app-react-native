import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, Alert, ActivityIndicator, Animated, ScrollView, RefreshControl, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { getDecksByCategory } from '../../services/DeckService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

export default function LibraryScreen() {
  const { colors, isDark } = useTheme();
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
  const [myDecksQuery, setMyDecksQuery] = useState('');
  const [myDecksSort, setMyDecksSort] = useState('original');

  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

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
      const decks = await getFavoriteDecks(user.id);
      setFavoriteDecks(decks || []);
      const cards = await getFavoriteCards(user.id);
      setFavoriteCards(cards || []);
      setFavoritesFetched(true);
    } catch (e) {
      setFavoriteDecks([]);
      setFavoriteCards([]);
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
    const cards = await getFavoriteCards(user.id);
    setFavoriteCards(cards || []);
  };

  const filteredFavoriteCards = (() => {
    let list = favoriteCards.slice();
    if (favCardsQuery && favCardsQuery.trim()) {
      const q = favCardsQuery.toLowerCase();
      list = list.filter(c => (c.question || '').toLowerCase().includes(q) || (c.answer || '').toLowerCase().includes(q));
    }
    if (favCardsSort === 'az') {
      list.sort((a, b) => (a.question || '').localeCompare(b.question || ''));
    } else if (favCardsSort === 'fav') {
      // Favori kartlar zaten favori olduğu için burada bir değişiklik yapmıyoruz
      // Sadece orijinal sıralamayı koruyoruz
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  })();

  const filteredMyDecks = (() => {
    let list = myDecks.slice();
    if (myDecksQuery && myDecksQuery.trim()) {
      const q = myDecksQuery.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.to_name || '').toLowerCase().includes(q));
    }
    if (myDecksSort === 'az') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (myDecksSort === 'fav') {
      // Sadece favori desteleri göster
      list = list.filter(d => favoriteDecks.some(favDeck => favDeck.id === d.id));
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  })();

  // Yükleniyor ekranı
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/handAnimation.json')} autoPlay loop style={{ width: 300, height: 300 }} />
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
                backgroundColor: colors.libraryTab || '#F98A21',
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
            renderLoading()
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
              ListHeaderComponent={(
                <View style={{ backgroundColor: colors.background, marginTop: '22%'  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '93%', alignSelf: 'center', marginBottom: 5 }}>
                    <SearchBar
                      value={myDecksQuery}
                      onChangeText={setMyDecksQuery}
                      placeholder={t('common.searchPlaceholder', 'Destelerde ara...')}
                      style={{ flex: 1 }}
                    />
                    <FilterIcon
                      value={myDecksSort}
                      onChange={setMyDecksSort}
                    />
                  </View>
                </View>
              )}
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
              contentContainerStyle={{ paddingBottom: '22%', marginTop: '22%' }}
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
                    <Iconify icon="ph:cards-fill" size={26} color="#F98A21" />
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]}>
                      {t('library.favoriteDecksTitle', 'Favori Destelerim')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary }]} onPress={() => navigation.navigate('FavoriteDecks')}>
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
                                colors={colors.deckGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.favoriteSlideGradient}
                              >
                                <TouchableOpacity
                                  style={{ position: 'absolute', top: 13, right: 13, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
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
                                        <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                                        <View style={{ width: 70, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                                        <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                                      </>
                                    ) : (
                                      <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                                    )}
                                  </View>
                                </View>
                                <View style={{ position: 'absolute', left: 16, bottom: 16 }}>
                                  <View style={styles.deckCountBadge}>
                                    <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 18 }]}>{deck.card_count || 0}</Text>
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
                    <Iconify icon="mdi:cards" size={26} color="#F98A21" marginTop={3} />
                    <Text style={[styles.favoriteHeaderTitle, { color: colors.text }]}> 
                      {t('library.favoriteCardsTitle', 'Favori Kartlarım')}
                    </Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllButton, { borderColor: colors.secondary }]} onPress={() => navigation.navigate('FavoriteCards')}>
                    <Text style={[styles.seeAllText, { color: colors.secondary }]}> 
                      {t('library.all', 'Tümü')}
                    </Text>
                    <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color={colors.secondary}  />
                  </TouchableOpacity>
                </View>
                <View style={{ margin: 5 }}>
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
                    />
                  </View>
                  {/* Favorite Cards List */}
                  <View style={{ marginTop: 14, paddingHorizontal: 4 }}>
                    {filteredFavoriteCards.map((card) => (
                      <CardListItem
                        key={String(card.id)}
                        question={card.question}
                        answer={card.answer}
                        isFavorite={true}
                        onPress={() => navigation.navigate('CardDetail', { card, isOwner: myDecks.some(d => d.id === card.deck_id) })}
                        onToggleFavorite={() => handleRemoveFavoriteCard(card.id)}
                        canDelete={false}
                      />
                    ))}
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
    height: 200,
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
    borderRadius: 16,
    marginRight: 8,
  },
  deckProfileUsername: {
    fontSize: 16,
    fontWeight: '600',

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
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },


}); 