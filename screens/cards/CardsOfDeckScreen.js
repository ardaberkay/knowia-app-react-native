import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Platform, BackHandler, Alert, Dimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Iconify } from 'react-native-iconify';

import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { useTranslation } from 'react-i18next';
import CardListItem from '../../components/lists/CardList';
import SearchBar from '../../components/tools/SearchBar';
import FilterIcon from '../../components/tools/FilterIcon';
import CardDetailView from '../../components/layout/CardDetailView';
import CardActionMenu from '../../components/modals/CardActionSheet';

export default function DeckCardsScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [cardSort, setCardSort] = useState('original');
  const [originalCards, setOriginalCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
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

  useEffect(() => {
    if (selectedCard && !editMode) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => setCardMenuVisible(true)} style={{ marginRight: 8 }}>
            <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={28} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [selectedCard, editMode, colors.text, navigation]);

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

  const handleBackFromDetail = () => {
    setSelectedCard(null);
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
        <CardActionMenu
          visible={cardMenuVisible}
          onClose={() => setCardMenuVisible(false)}
          card={selectedCard}
          deck={deck}
          currentUserId={currentUserId}
          isFavorite={favoriteCards.includes(selectedCard.id)}
          onToggleFavorite={async () => {
            setFavLoading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (favoriteCards.includes(selectedCard.id)) {
                await supabase
                  .from('favorite_cards')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('card_id', selectedCard.id);
                setFavoriteCards(favoriteCards.filter(id => id !== selectedCard.id));
              } else {
                await supabase
                  .from('favorite_cards')
                  .insert({ user_id: user.id, card_id: selectedCard.id });
                setFavoriteCards([...favoriteCards, selectedCard.id]);
              }
            } catch (e) {}
            setFavLoading(false);
            setCardMenuVisible(false);
          }}
          onEdit={() => setEditMode(true)}
          onDelete={async () => {
            await supabase
              .from('cards')
              .delete()
              .eq('id', selectedCard.id);
            setCards(cards.filter(c => c.id !== selectedCard.id));
            setOriginalCards(originalCards.filter(c => c.id !== selectedCard.id));
            setSelectedCard(null);
            setCardMenuVisible(false);
          }}
          favLoading={favLoading}
        />
      </>
    ) : (
             <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 18, paddingTop: 18 }}>
        {!selectedCard && (
          <>
            {/* Search Bar & Filter */}
            <View style={[styles.cardsSearchBarRow, { marginBottom: 12 }]}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t("common.searchPlaceholder", "Kartlarda ara...")}
                style={{ marginRight: 0, marginBottom: 0 }}
              />
              <FilterIcon
                style={{ marginLeft: 8 }}
                value={cardSort}
                onChange={setCardSort}
              />
            </View>
            {/* Filter Modal is managed inside FilterIcon */}
          </>
        )}
        {/* Kartlar Listesi veya Detay */}
        <View style={{ flex: 1, minHeight: 0 }}>
          {selectedCard ? (
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
             contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, paddingTop: 8 }}
                         ListEmptyComponent={
               loading ? (
                 <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', height: 400}}>
                   <ActivityIndicator size="large" color={colors.text} style={{ marginBottom: 16 }} />
                   <Text style={[styles.loadingText, { color: colors.text }]}>{t('common.loading', 'Yükleniyor')}</Text>
                 </View>
               ) : (
                 <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', height: 400}}>
                   <Text style={[typography.styles.caption, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>{t('deckDetail.addToDeck', 'Desteye bir kart ekle')}</Text>
                 </View>
               )
             }
                         renderItem={({ item }) => (
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
                          await supabase
                            .from('cards')
                            .delete()
                            .eq('id', item.id);
                          setCards(cards.filter(c => c.id !== item.id));
                          setOriginalCards(originalCards.filter(c => c.id !== item.id));
                        }
                      }
                    ]
                  );
                }}
                canDelete={currentUserId && deck.user_id === currentUserId}
              />
            )}
          />
        )}
      </View>
    </View>
    )
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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

  cardItemGlass: {
    width: '100%',
    minHeight: 110,
    backgroundColor: '#E8E4DD', // Light theme için varsayılan
    borderRadius: 30,
    marginBottom: 12,
    padding: 20,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardQuestion: {
    fontWeight: '600',
    fontSize: 17,
    color: '#1C1C1C', // Light theme için varsayılan
    marginBottom: 8,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  cardDivider: {
    height: 2,
    backgroundColor: '#F98A21', // Light theme için varsayılan
    alignSelf: 'stretch',
    marginVertical: 8,
    borderRadius: 2,
  },
  cardAnswer: {
    fontSize: 15,
    color: '#4A4A4A', // Light theme için varsayılan
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',

  },
  cardTextCol: {
    width: '80%',
    maxWidth: 320,
  },
  cardFavIconBtn: {
    padding: 8,
    backgroundColor: '#ffffff', // Light theme için varsayılan
    borderRadius: 12,
    marginBottom: 4,
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
  cardDetailBody: {
    marginBottom: 0,
    width: '100%',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 



