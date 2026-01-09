import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, BackHandler, Alert, Dimensions, Animated, Easing, ActivityIndicator, Modal, Image } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import LottieView from 'lottie-react-native';

import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { useTranslation } from 'react-i18next';
import CardListItem from '../../components/lists/CardList';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import CardDetailView from '../../components/layout/CardDetailView';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
 

export default function DeckCardsScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const { showSuccess, showError } = useSnackbarHelpers();
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [cardSort, setCardSort] = useState('original');
  const [originalCards, setOriginalCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favLoading, setFavLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const moreMenuRef = useRef(null);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const { t } = useTranslation();

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        // Fetch cards, favorite cards, and user progress in parallel
        const [cardsResult, favoritesResult, progressResult] = await Promise.all([
          supabase
            .from('cards')
            .select(`
              id, question, answer, image, example, note, created_at,
              deck:decks(
                id, name, user_id, categories:categories(id, name, sort_order)
              )
            `)
            .eq('deck_id', deck.id)
            .order('created_at', { ascending: false }),
          user ? supabase
            .from('favorite_cards')
            .select('card_id')
            .eq('user_id', user.id) : Promise.resolve({ data: [], error: null }),
          user ? supabase
            .from('user_card_progress')
            .select('card_id, status')
            .eq('user_id', user.id) : Promise.resolve({ data: [], error: null })
        ]);
        
        if (cardsResult.error) throw cardsResult.error;
        
        // Create a map of card statuses
        const statusMap = {};
        if (progressResult.data) {
          progressResult.data.forEach(p => {
            statusMap[p.card_id] = p.status;
          });
        }
        
        // Merge status into cards (default: 'new' if no progress record)
        const cardsWithProgress = (cardsResult.data || []).map(card => ({
          ...card,
          status: statusMap[card.id] || 'new'
        }));
        
        setCards(cardsWithProgress);
        setOriginalCards(cardsWithProgress);
        
        if (favoritesResult.error) throw favoritesResult.error;
        setFavoriteCards((favoritesResult.data || []).map(f => f.card_id));
      } catch (e) {
        setCards([]);
        setOriginalCards([]);
        setFavoriteCards([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
    setFilteredCards(sortCards(cardSort, cards));
  }, [cardSort, cards, originalCards, favoriteCards]);

  useEffect(() => {
    const onBackPress = () => {
      if (selectedCard) {
        setSelectedCard(null);
        return true; // Geri tuşunu burada tüket
      }
      return false; // Normal navigation geri çalışsın
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [selectedCard]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (selectedCard) {
        e.preventDefault();
        setSelectedCard(null);
      }
    });
    return unsubscribe;
  }, [navigation, selectedCard]);

  // Header'ı ayarla - selectedCard durumuna göre
  useLayoutEffect(() => {
    // Loading bitene kadar header ikonlarını gösterme
    if (loading) {
      navigation.setOptions({
        headerRight: () => null,
      });
      return;
    }

    const isOwner = currentUserId && deck.user_id === currentUserId;
    if (selectedCard && !editMode) {
      navigation.setOptions({
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <TouchableOpacity
              onPress={() => handleToggleFavoriteCard(selectedCard.id)}
              activeOpacity={0.7}
              style={{ paddingHorizontal: 6 }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={24}
                color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                ref={moreMenuRef}
                onPress={openMoreMenu}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 6 }}
              >
                <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={26} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    } else {
      const isOwner = currentUserId && deck.user_id === currentUserId;
      navigation.setOptions({
        headerRight: () => {
          if (!isOwner) {
            return null;
          }
          return (
            <TouchableOpacity 
              onPress={() => navigation.navigate('AddCard', { deck })} 
              style={{ marginRight: 8 }}
            >
              <Iconify icon="ic:round-plus" size={28} color={colors.text} />
            </TouchableOpacity>
          );
        },
      });
    }
  }, [loading, selectedCard, editMode, colors.text, navigation, deck, favoriteCards, currentUserId, handleToggleFavoriteCard, openMoreMenu]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [loading]);

  const sortCards = (type, cardsList) => {
    if (type === 'az') {
      return [...cardsList].sort((a, b) => (a.question || '').localeCompare(b.question || '', 'tr'));
    } else if (type === 'fav') {
      return [...cardsList].filter(card => favoriteCards.includes(card.id));
    } else if (type === 'unlearned') {
      return [...cardsList].filter(card => card.status !== 'learned');
    } else {
      return [...originalCards];
    }
  };

  const handleToggleFavoriteCard = async (cardId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (favoriteCards.includes(cardId)) {
        await supabase
          .from('favorite_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId);
        setFavoriteCards(favoriteCards.filter(id => id !== cardId));
      } else {
        await supabase
          .from('favorite_cards')
          .insert({ user_id: user.id, card_id: cardId });
        setFavoriteCards([...favoriteCards, cardId]);
      }
    } catch (e) {}
  };

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setEditMode(true);
    setMoreMenuVisible(false);
  };

  const handleDeleteSelectedCard = async () => {
    if (!selectedCard) return;
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', selectedCard.id);
      
      if (error) {
        throw error;
      }
      
      setCards(cards.filter(c => c.id !== selectedCard.id));
      setOriginalCards(originalCards.filter(c => c.id !== selectedCard.id));
      setSelectedCard(null);
      showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
    } catch (e) {
      showError(t('cardDetail.deleteError', 'Kart silinemedi'));
    } finally {
      setMoreMenuVisible(false);
    }
  };

  const openMoreMenu = () => {
    if (moreMenuRef.current && moreMenuRef.current.measureInWindow) {
      moreMenuRef.current.measureInWindow((x, y, width, height) => {
        setMoreMenuPos({ x, y, width, height });
        setMoreMenuVisible(true);
      });
    } else {
      setMoreMenuVisible(true);
    }
  };

  const handleBackFromDetail = () => {
    setSelectedCard(null);
    setMoreMenuVisible(false);
  };
  return (
    selectedCard && editMode ? (
      <AddEditCardInlineForm
        card={selectedCard}
        deck={deck}
        onSave={updatedCard => {
          setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
          setOriginalCards(originalCards.map(c => c.id === updatedCard.id ? updatedCard : c));
          setSelectedCard(updatedCard);
          setEditMode(false);
        }}
        onCancel={() => setEditMode(false)}
      />
    ) : selectedCard ? (
      <>
        <CardDetailView card={selectedCard} cards={cards} onSelectCard={setSelectedCard} />
        <Modal
          visible={moreMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMoreMenuVisible(false)}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setMoreMenuVisible(false)}
          >
            <View
              style={{
                position: 'absolute',
                right: 20,
                top: Platform.OS === 'android' ? moreMenuPos.y + moreMenuPos.height + 4 : moreMenuPos.y + moreMenuPos.height + 8,
                minWidth: 160,
                backgroundColor: colors.cardBackground,
                borderRadius: 14,
                paddingVertical: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <TouchableOpacity
                onPress={handleEditSelectedCard}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
                activeOpacity={0.7}
              >
                <Iconify icon="lucide:edit" size={20} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { color: colors.text, fontSize: 16 }]}>
                  {t('cardDetail.edit', 'Kartı Düzenle')}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <TouchableOpacity
                onPress={handleDeleteSelectedCard}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                }}
                activeOpacity={0.7}
              >
                <Iconify icon="mdi:garbage" size={20} color="#E74C3C" style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: 16 }]}>
                  {t('cardDetail.delete', 'Kartı Sil')}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    ) : (
             <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Kartlar Listesi veya Detay */}
        <View style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
              <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
            </View>
          ) : selectedCard ? (
            <LinearGradient
              colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            >
              <CardDetailView card={selectedCard} cards={cards} onSelectCard={setSelectedCard} />
            </LinearGradient>
        ) : (
                     <FlatList
             data={filteredCards}
             keyExtractor={item => item.id?.toString()}
             showsVerticalScrollIndicator={false}
             contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
             ListHeaderComponent={
               !selectedCard && filteredCards.length > 0 && (
                <View style={styles.cardsBlurSearchContainer}>
                  <SearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("common.searchPlaceholder", "Kartlarda ara...")}
                    style={{ flex: 1 }}
                  />
                  <FilterIcon
                    value={cardSort}
                    onChange={setCardSort}
                  />
                </View>
               )
             }
                         ListEmptyComponent={
                 <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', height: 400, marginTop: -250}}>
                   <Image
                     source={require('../../assets/cardbg.png')}
                     style={{ width: 500, height: 500, opacity: 0.2 }}
                     resizeMode="contain"
                   />
                   <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, fontSize: 16, marginTop: -150 }]}>
                     {t('cardDetail.addToDeck', 'Desteye bir kart ekle')}
                   </Text>
                 </View>
             }
                         renderItem={({ item }) => {
              const isOwner = currentUserId && (item.deck?.user_id || deck.user_id) === currentUserId;
              return (
                <View style={styles.cardListItem}>
                  <CardListItem
                    question={item.question}
                    answer={item.answer}
                    onPress={() => {
                      setEditMode(false);
                      setSelectedCard(item);
                    }}
                    onToggleFavorite={() => handleToggleFavoriteCard(item.id)}
                    isFavorite={favoriteCards.includes(item.id)}
                    onDelete={async () => {
                      Alert.alert(
                        t('cardDetail.deleteConfirmation', 'Kart Silinsin mi?'),
                        t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
                        [
                          { text: t('cardDetail.cancel', 'İptal'), style: 'cancel' },
                          {
                            text: t('cardDetail.delete', 'Sil'), style: 'destructive', onPress: async () => {
                              try {
                                const { error } = await supabase
                                  .from('cards')
                                  .delete()
                                  .eq('id', item.id);
                                
                                if (error) {
                                  throw error;
                                }
                                
                                setCards(cards.filter(c => c.id !== item.id));
                                setOriginalCards(originalCards.filter(c => c.id !== item.id));
                                showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
                              } catch (e) {
                                showError(t('cardDetail.deleteError', 'Kart silinemedi'));
                              }
                            }
                          }
                        ]
                      );
                    }}
                    canDelete={true}
                    isOwner={isOwner}
                  />
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
    )
  );
}

const styles = StyleSheet.create({
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
  
  cardsBlurSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  cardListItem: {
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
}); 



