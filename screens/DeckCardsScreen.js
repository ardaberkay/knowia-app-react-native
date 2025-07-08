import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Image, Platform, BackHandler, Modal, Alert, Dimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import AddEditCardInlineForm from '../components/AddEditCardInlineForm';

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
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

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
            <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
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
      <LinearGradient
        colors={colors.deckGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 18, paddingBottom: 8, flexGrow: 1 }} showsVerticalScrollIndicator={true}>
          {/* Görsel */}
          {selectedCard?.image ? (
            <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
              <View style={detailStyles.labelRow}>
                <Ionicons name="image" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Kart Görseli</Text>
          </View>
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: selectedCard.image }} style={detailStyles.cardImage} />
          </View>
            </View>
              ) : null}
                {/* Soru */}
          <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={detailStyles.labelRow}>
              <Ionicons name="help-circle-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
              <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Soru</Text>
                  </View>
            <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard?.question}</Text>
          </View>
                {/* Cevap */}
                {selectedCard?.answer ? (
            <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
              <View style={detailStyles.labelRow}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Cevap</Text>
                    </View>
              <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.answer}</Text>
            </View>
                ) : null}
                {/* Örnek */}
                {selectedCard?.example ? (
            <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
              <View style={detailStyles.labelRow}>
                <Ionicons name="bulb-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Örnek</Text>
                    </View>
              <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.example}</Text>
            </View>
                ) : null}
                {/* Not */}
                {selectedCard?.note ? (
            <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
              <View style={detailStyles.labelRow}>
                <Ionicons name="document-text-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Not</Text>
              </View>
              <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.note}</Text>
            </View>
          ) : null}
          {/* Oluşturulma tarihi */}
              {selectedCard?.created_at ? (
            <Text style={[typography.styles.caption, { color: colors.muted, marginTop: 24, marginBottom: 8, textAlign: 'center', fontSize: 14 }]}>Oluşturulma {new Date(selectedCard.created_at).toLocaleString('tr-TR')}</Text>
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
                style={{ flex: 1, backgroundColor: 'transparent' }}
                activeOpacity={1}
                onPress={() => setCardMenuVisible(false)}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
                {/* Kartı Düzenle sadece kendi kartıysa */}
                {currentUserId && deck.user_id === currentUserId && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => { setCardMenuVisible(false); setEditMode(true); }}
                  >
                    <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>Kartı Düzenle</Text>
                  </TouchableOpacity>
                )}
                {/* Favorilere Ekle/Çıkar */}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
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
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
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
      </LinearGradient>
    ) : (
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
            {/* Filter Modal */}
            <Modal
              visible={filterModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setFilterModalVisible(false)}
            >
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
                <View style={{
                  position: 'absolute',
                  left: Math.max(8, dropdownPos.x + dropdownPos.width - 140),
                  top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + 4,
                  minWidth: 120,
                  maxWidth: 140,
                  backgroundColor: colors.background,
                  borderRadius: 14,
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.10,
                  shadowRadius: 8,
                  elevation: 8,
                  borderWidth: 1,
                  borderColor: '#F98A21',
                }}>
                  <TouchableOpacity onPress={() => { setCardSort('original'); setFilterModalVisible(false); }} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: cardSort === 'original' ? '#F98A21' : 'transparent', borderRadius: 8 }}>
                    <Text style={{ color: cardSort === 'original' ? '#fff' : colors.text, fontWeight: cardSort === 'original' ? 'bold' : 'normal', fontSize: 15 }}>Varsayılan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setCardSort('az'); setFilterModalVisible(false); }} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: cardSort === 'az' ? '#F98A21' : 'transparent', borderRadius: 8 }}>
                    <Text style={{ color: cardSort === 'az' ? '#fff' : colors.text, fontWeight: cardSort === 'az' ? 'bold' : 'normal', fontSize: 15 }}>A-Z</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setCardSort('fav'); setFilterModalVisible(false); }} style={{ paddingVertical: 8, paddingHorizontal: 14, backgroundColor: cardSort === 'fav' ? '#F98A21' : 'transparent', borderRadius: 8 }}>
                    <Text style={{ color: cardSort === 'fav' ? '#fff' : colors.text, fontWeight: cardSort === 'fav' ? 'bold' : 'normal', fontSize: 15 }}>Favoriler</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
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
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8, flexGrow: 1 }} showsVerticalScrollIndicator={true}>
                {/* Görsel */}
                {selectedCard?.image ? (
                  <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
                    <View style={detailStyles.labelRow}>
                      <Ionicons name="image" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                      <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Kart Görseli</Text>
                    </View>
                    <View style={{ alignItems: 'center', marginBottom: 8 }}>
                      <Image source={{ uri: selectedCard.image }} style={detailStyles.cardImage} />
                    </View>
                  </View>
                ) : null}
                {/* Soru */}
                <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
                  <View style={detailStyles.labelRow}>
                    <Ionicons name="help-circle-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                    <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Soru*</Text>
                  </View>
                  <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard?.question}</Text>
                </View>
                {/* Cevap */}
                {selectedCard?.answer ? (
                  <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
                    <View style={detailStyles.labelRow}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                      <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Cevap *</Text>
                    </View>
                    <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.answer}</Text>
                  </View>
                ) : null}
                {/* Örnek */}
                {selectedCard?.example ? (
                  <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
                    <View style={detailStyles.labelRow}>
                      <Ionicons name="bulb-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                      <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Örnek</Text>
                    </View>
                    <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.example}</Text>
                  </View>
                ) : null}
                {/* Not */}
                {selectedCard?.note ? (
                  <View style={[detailStyles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
                    <View style={detailStyles.labelRow}>
                      <Ionicons name="document-text-outline" size={20} color="#F98A21" style={detailStyles.labelIcon} />
                      <Text style={[detailStyles.label, typography.styles.body, {color: colors.text}]}>Not</Text>
                    </View>
                    <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{selectedCard.note}</Text>
                  </View>
                ) : null}
                {/* Oluşturulma tarihi */}
                {selectedCard?.created_at ? (
                  <Text style={[typography.styles.caption, { color: colors.muted, marginTop: 24, marginBottom: 8, textAlign: 'center', fontSize: 14 }]}>Oluşturulma {new Date(selectedCard.created_at).toLocaleString('tr-TR')}</Text>
                ) : null}
              </ScrollView>
            </LinearGradient>
        ) : (
          <FlatList
            data={filteredCards}
            keyExtractor={item => item.id?.toString()}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 24, paddingTop: 8 }}
            ListEmptyComponent={
              loading ? (
                <View style={{justifyContent: 'center', alignItems: 'center'}}>
                  <ActivityIndicator size="large" color={colors.text} style={{ marginBottom: 16 }} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>Yükleniyor</Text>
                </View>
              ) : (
                <View style={{justifyContent: 'center', alignItems: 'center'}}>
                  <Text style={[typography.styles.caption, { color: colors.text, textAlign: 'center', fontSize: 16 }]}>Desteye bir kart ekle</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cardItemGlass, {backgroundColor: colors.cards}]}
                activeOpacity={0.93}
                onPress={() => {
                  setEditMode(false);
                  setSelectedCard(item);
                }}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTextCol}>
                    <Text style={[styles.cardQuestion, typography.styles.body]} numberOfLines={1} ellipsizeMode="tail">
                      {item.question}
                    </Text>
                    <View style={styles.cardDivider} />
                    <Text style={[styles.cardAnswer, typography.styles.body, {color: colors.text}]} numberOfLines={1} ellipsizeMode="tail">
                      {item.answer}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
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
                    {/* Çöp kutusu ikonu sadece destenin sahibi ise */}
                    {currentUserId && deck.user_id === currentUserId && (
                      <TouchableOpacity
                        style={{ marginTop: 20 }}
                        onPress={() => {
                          Alert.alert('Kartı Sil', 'Bu kartı silmek istediğine emin misin?', [
                            { text: 'İptal', style: 'cancel' },
                            {
                              text: 'Sil', style: 'destructive', onPress: async () => {
                                await supabase
                                  .from('cards')
                                  .delete()
                                  .eq('id', item.id);
                                setCards(cards.filter(c => c.id !== item.id));
                                setOriginalCards(originalCards.filter(c => c.id !== item.id));
                              }
                            }
                          ]);
                        }}
                      >
                        <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
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


const detailStyles = StyleSheet.create({
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    marginHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    alignSelf: 'auto',
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
  cardImage: {
    width: 120,
    height: 160,
    borderRadius: 18,
    marginBottom: 8,
    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
    alignSelf: 'center',
  },
});
