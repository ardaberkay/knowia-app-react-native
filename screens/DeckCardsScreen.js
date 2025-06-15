import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Image, Platform, BackHandler, Modal, Alert, StatusBar, Dimensions } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../lib/supabase';

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
  const filterIconRef = useRef(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

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
    if (selectedCard) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => setCardMenuVisible(true)} style={{ marginRight: 8 }}>
            <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [selectedCard, colors.text, navigation]);

  useEffect(() => {
    if (cardMenuVisible) {
      StatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('rgba(0,0,0,0.25)', true);
      }
    } else {
      StatusBar.setBarStyle('dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#fff', true);
      }
    }
  }, [cardMenuVisible]);

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
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 18, paddingTop: 18 }}>
      {!selectedCard && (
        <>
          {/* Search Bar & Filter */}
          <View style={[styles.cardsSearchBarRow, { marginBottom: 0 }]}>
            <View style={[styles.cardsSearchBarWrapperModern, { marginRight: 0, marginBottom: 0 }]}>
              <Ionicons name="search" size={20} color="#B0B0B0" style={[styles.cardsSearchIcon, { marginRight: 0 }]} />
              <TextInput
                style={[styles.cardsSearchBarModern, typography.styles.body]}
                placeholder="Kartlarda ara..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={colors.muted}
              />
            </View>
            <TouchableOpacity
              ref={filterIconRef}
              style={[styles.cardsFilterIconButton, { marginLeft: 8 }]}
              onPress={() => {
                if (filterIconRef.current) {
                  filterIconRef.current.measureInWindow((x, y, width, height) => {
                    setDropdownPos({ x, y, width, height });
                    setFilterModalVisible(true);
                  });
                }
              }}
            >
              <Ionicons name="filter" size={24} color="#F98A21" />
            </TouchableOpacity>
          </View>
          {/* Divider */}
          <View style={{ alignItems: 'center', marginTop: 15, marginBottom: 8 }}>
            <View style={{ width: '15%', height: 3, backgroundColor: '#E9E9E9', borderRadius: 1 }} />
          </View>
        </>
      )}
      {/* Kartlar Listesi veya Detay */}
      <View style={{ flex: 1, minHeight: 0 }}>
        {selectedCard ? (
          <>
            <ScrollView style={{ minHeight: screenHeight * 0.7, width: '100%' }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={true}>
              {selectedCard?.image ? (
                <Image source={{ uri: selectedCard.image }} style={styles.cardDetailImage} />
              ) : null}
              <View style={styles.cardDetailBody}>
                {/* Soru */}
                <View style={{
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#E9E9E9',
                  backgroundColor: '#fff',
                  shadowColor: '#F98A21',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.10,
                  shadowRadius: 8,
                  elevation: 4,
                  marginBottom: 14,
                }}>
                  <View style={styles.cardDetailTitleRow}>
                    <View style={styles.cardDetailDividerLine} />
                    <Text style={[typography.styles.subtitle, styles.cardDetailTitle, { color: colors.buttonColor }]}>Soru</Text>
                    <View style={styles.cardDetailDividerLine} />
                  </View>
                  <Text style={[typography.styles.body, styles.cardDetailText, { color: colors.text }]}>{selectedCard?.question}</Text>
                </View>
                {/* Cevap */}
                {selectedCard?.answer ? (
                  <View style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#E9E9E9',
                    backgroundColor: '#fff',
                    shadowColor: '#F98A21',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.10,
                    shadowRadius: 8,
                    elevation: 4,
                    marginBottom: 14,
                  }}>
                    <View style={styles.cardDetailTitleRow}>
                      <View style={styles.cardDetailDividerLine} />
                      <Text style={[typography.styles.subtitle, styles.cardDetailTitle, { color: colors.buttonColor }]}>Cevap</Text>
                      <View style={styles.cardDetailDividerLine} />
                    </View>
                    <Text style={[typography.styles.body, styles.cardDetailText, { color: colors.text }]}>{selectedCard.answer}</Text>
                  </View>
                ) : null}
                {/* Örnek */}
                {selectedCard?.example ? (
                  <View style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#E9E9E9',
                    backgroundColor: '#fff',
                    shadowColor: '#F98A21',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.10,
                    shadowRadius: 8,
                    elevation: 4,
                    marginBottom: 14,
                  }}>
                    <View style={styles.cardDetailTitleRow}>
                      <View style={styles.cardDetailDividerLine} />
                      <Text style={[typography.styles.subtitle, styles.cardDetailTitle, { color: colors.buttonColor }]}>Örnek</Text>
                      <View style={styles.cardDetailDividerLine} />
                    </View>
                    <Text style={[typography.styles.body, styles.cardDetailText, { color: colors.text }]}>{selectedCard.example}</Text>
                  </View>
                ) : null}
                {/* Not */}
                {selectedCard?.note ? (
                  <View style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#E9E9E9',
                    backgroundColor: '#fff',
                    shadowColor: '#F98A21',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.10,
                    shadowRadius: 8,
                    elevation: 4,
                    marginBottom: 14,
                  }}>
                    <View style={styles.cardDetailTitleRow}>
                      <View style={styles.cardDetailDividerLine} />
                      <Text style={[typography.styles.subtitle, styles.cardDetailTitle, { color: colors.buttonColor }]}>Not</Text>
                      <View style={styles.cardDetailDividerLine} />
                    </View>
                    <Text style={[typography.styles.body, styles.cardDetailText, { color: colors.text }]}>{selectedCard.note}</Text>
                  </View>
                ) : null}
              </View>
              {selectedCard?.created_at ? (
                <Text style={[typography.styles.caption, styles.cardDetailDate, { color: colors.muted, marginTop: 24, marginBottom: 8, textAlign: 'center' }]}>Oluşturulma {new Date(selectedCard.created_at).toLocaleString('tr-TR')}</Text>
              ) : null}
            </ScrollView>
            {/* Kart Detay Hamburger Menü Modal */}
            <Modal
              visible={cardMenuVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setCardMenuVisible(false)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}
                activeOpacity={1}
                onPress={() => setCardMenuVisible(false)}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16 }} />
                {/* Kartı Düzenle sadece kendi kartıysa */}
                {currentUserId && deck.user_id === currentUserId && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' }}
                    onPress={() => { setCardMenuVisible(false); navigation.navigate('EditCard', { card: selectedCard, deck }); }}
                  >
                    <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>Kartı Düzenle</Text>
                  </TouchableOpacity>
                )}
                {/* Favorilere Ekle/Çıkar */}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' }}
                  onPress={async () => {
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
                >
                  <MaterialCommunityIcons
                    name={favoriteCards.includes(selectedCard.id) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text }}>
                    {favoriteCards.includes(selectedCard.id) ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                  </Text>
                </TouchableOpacity>
                {/* Kartı Sil sadece kendi kartıysa */}
                {currentUserId && deck.user_id === currentUserId && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' }}
                    onPress={async () => {
                      Alert.alert('Kartı Sil', 'Bu kartı silmek istediğine emin misin?', [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Sil', style: 'destructive', onPress: async () => {
                            await supabase
                              .from('cards')
                              .delete()
                              .eq('id', selectedCard.id);
                            setCards(cards.filter(c => c.id !== selectedCard.id));
                            setOriginalCards(originalCards.filter(c => c.id !== selectedCard.id));
                            setSelectedCard(null);
                            setCardMenuVisible(false);
                          }
                        }
                      ]);
                    }}
                  >
                    <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>Kartı Sil</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setCardMenuVisible(false)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </Modal>
          </>
        ) : (
          <FlatList
            data={filteredCards}
            keyExtractor={item => item.id?.toString()}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
            ListEmptyComponent={<Text style={[typography.styles.caption, { color: colors.muted, marginLeft: 8, marginTop: 12 }]}>Bu destede henüz kart yok.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.cardItemGlass}
                activeOpacity={0.93}
                onPress={() => setSelectedCard(item)}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTextCol}>
                    <Text style={[styles.cardQuestion, typography.styles.body]} numberOfLines={1} ellipsizeMode="tail">
                      {item.question}
                    </Text>
                    <View style={styles.cardDivider} />
                    <Text style={[styles.cardAnswer, typography.styles.body]} numberOfLines={1} ellipsizeMode="tail">
                      {item.answer}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cardFavIconBtn}
                    onPress={() => handleToggleFavoriteCard(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name={favoriteCards.includes(item.id) ? 'heart' : 'heart-outline'}
                      size={22}
                      color={favoriteCards.includes(item.id) ? '#F98A21' : '#B0B0B0'}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
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
  cardItemGlass: {
    width: '100%',
    minHeight: 110,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F98A21',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
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
}); 