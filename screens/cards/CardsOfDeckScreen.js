import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
import FilterIcon from '../../components/modals/CardFilterIcon';
import CardDetailView from '../../components/layout/CardDetailView';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { useFocusEffect } from '@react-navigation/native';
import * as BlockService from '../../services/BlockService';
import ReportModal from '../../components/modals/ReportModal';
import { triggerHaptic } from '../../lib/hapticManager';


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
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const moreMenuRef = useRef(null);
  const dataFetchedRef = useRef(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportModalAlreadyCodes, setReportModalAlreadyCodes] = useState([]);
  const [reportCardId, setReportCardId] = useState(null);
  const { t } = useTranslation();
  

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
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
      dataFetchedRef.current = true;

      if (favoritesResult.error) throw favoritesResult.error;
      setFavoriteCards((favoritesResult.data || []).map(f => f.card_id));
    } catch (e) {
      setCards([]);
      setOriginalCards([]);
      setFavoriteCards([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    dataFetchedRef.current = false;
    fetchData();
  }, [deck.id, fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (dataFetchedRef.current) {
        fetchData(true);
      }
    }, [fetchData])
  );

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: scale(4) }}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                handleToggleFavoriteCard(selectedCard.id);
              }}
              activeOpacity={0.7}
              style={{ paddingHorizontal: scale(6) }}
              hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(24)}
                color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  requestAnimationFrame(() => {
                    openReportCardModal();
                  });
                }}
                activeOpacity={0.7}
                style={{ paddingHorizontal: scale(6) }}
                hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
              >
                <Iconify icon="ic:round-report-problem" size={moderateScale(24)} color='#FED7AA' />
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity
                ref={moreMenuRef}
                onPress={() => {
                  triggerHaptic('light');
                  requestAnimationFrame(() => {
                    openMoreMenu();
                  });
                }}
                activeOpacity={0.7}
                style={{ paddingHorizontal: scale(6) }}
                hitSlop={{ top: scale(15), bottom: scale(15), left: scale(8), right: scale(8) }}
              >
                <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={moderateScale(26)} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    } else {
      const isOwner = currentUserId && deck.user_id === currentUserId && !deck.is_shared;

      navigation.setOptions({
        headerRight: () => {
          if (!isOwner) {
            return null;
          }
          return (
            <TouchableOpacity
              // hitSlop: Butonun görsel boyutunu büyütmeden dokunmatik alanını genişletir. 
              // (Tıklamayı kaçırma/zor algılama hissini tamamen yok eder)
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6} // Tıklama hissiyatını netleştirir
              style={[styles.addCardIcon, { marginRight: scale(4) }]}
              onPress={() => {
                // 1. Arayüz tepkilerini ANINDA ver (Sıfır gecikme)
                triggerHaptic('selection');

                // 2. Yeni sayfayı çizmeyi (render) bir sonraki boyama karesine (frame) ertele.
                // Bu sayede butonun tıklanma animasyonu asla kilitlenmez.
                requestAnimationFrame(() => {
                  navigation.navigate('AddCard', { deck });
                });
              }}
            >
              <Iconify icon="ic:round-plus" size={moderateScale(28)} color={colors.text} />
            </TouchableOpacity>
          );
        },
      });
    }
  }, [loading, selectedCard, editMode, colors.text, navigation, deck, favoriteCards, currentUserId, handleToggleFavoriteCard, openMoreMenu, openReportCardModal]);

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
    }
    else if (type === 'learned') {
      return [...cardsList].filter(card => card.status === 'learned');
    } else {
      return [...originalCards];
    }
  };

  const openReportCardModal = useCallback(async () => {
    if (!currentUserId || !selectedCard) return;
    try {
      const codes = await BlockService.getMyReportReasonCodesForTarget(currentUserId, 'card', selectedCard.id);
      setReportModalAlreadyCodes(codes || []);
      setReportCardId(selectedCard.id);
      setReportModalVisible(true);
    } catch (e) {
      showError(t('moderation.alreadyReported', 'Zaten şikayet ettiniz') || e?.message);
    }
  }, [currentUserId, selectedCard, t, showError]);

  const handleReportModalSubmit = useCallback(async (reasonCode, reasonText) => {
    if (!currentUserId || !reportCardId) return;
    try {
      await BlockService.reportCard(currentUserId, reportCardId, reasonCode, reasonText);
      setReportModalVisible(false);
      setReportCardId(null);
      showSuccess(t('moderation.reportReceived', 'Şikayetiniz alındı'));
    } catch (e) {
      if (e?.code === '23505' || e?.message?.includes('unique') || e?.message?.includes('duplicate')) {
        showError(t('moderation.alreadyReportedWithThis', 'Zaten bu sebeple şikayet ettiniz'));
      } else {
        showError(e?.message || t('moderation.alreadyReported', 'Zaten şikayet ettiniz'));
      }
    }
  }, [currentUserId, reportCardId, t, showSuccess, showError]);

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
    } catch (e) { }
  };

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setEditMode(true);
    setMoreMenuVisible(false);
  };

  const handleDeleteSelectedCard = () => {
    if (!selectedCard) return;

    Alert.alert(
      t('cardDetail.warningTitle', 'Uyarı'),
      t('cardDetail.deleteConfirm', 'Kartı silmek istediğinize emin misiniz?'),
      [
        {
          text: t('common.cancel', 'İptal'),
          style: 'cancel',
          onPress: () => setMoreMenuVisible(false)
        },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cards')
                .delete()
                .eq('id', selectedCard.id);

              if (error) throw error;

              // --- EKRANDAN ATMAYI ENGELLEYEN YENİ MANTIK ---

              // 1. Silinen kartın index'ini bul
              const currentIndex = cards.findIndex(c => c.id === selectedCard.id);
              let nextCardToSelect = null;

              // 2. Eğer listede 1'den fazla kart varsa sıradaki kartı belirle
              if (cards.length > 1) {
                // Eğer en son kartı siliyorsak bir öncekini göster
                if (currentIndex === cards.length - 1) {
                  nextCardToSelect = cards[currentIndex - 1];
                }
                // Aksi halde bir sonrakini göster
                else {
                  nextCardToSelect = cards[currentIndex + 1];
                }
              }

              // 3. Listeleri güncelle
              setCards(cards.filter(c => c.id !== selectedCard.id));
              setOriginalCards(originalCards.filter(c => c.id !== selectedCard.id));

              // 4. Null yerine sıradaki kartı seç (Böylece bileşen kapanmaz, slider diğer karta geçer)
              setSelectedCard(nextCardToSelect);

              showSuccess(t('cardDetail.deleteSuccess', 'Kart başarıyla silindi'));
            } catch (e) {
              showError(t('cardDetail.deleteError', 'Kart silinemedi'));
            } finally {
              setMoreMenuVisible(false);
            }
          }
        }
      ]
    );
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
    <>
      {selectedCard && editMode ? (
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
                  right: scale(20),
                  top: Platform.OS === 'android' ? moreMenuPos.y + moreMenuPos.height + verticalScale(4) : moreMenuPos.y + moreMenuPos.height + verticalScale(8),
                  minWidth: scale(160),
                  backgroundColor: colors.cardBackground,
                  borderRadius: moderateScale(14),
                  paddingVertical: verticalScale(8),
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: verticalScale(2) },
                  shadowOpacity: 0.15,
                  shadowRadius: moderateScale(8),
                  elevation: 8,
                  borderWidth: moderateScale(1),
                  borderColor: colors.cardBorder,
                }}
              >
                <TouchableOpacity
                  onPress={handleEditSelectedCard}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.7}
                >
                  <Iconify icon="lucide:edit" size={moderateScale(20)} color={colors.text} style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: colors.text, fontSize: moderateScale(16) }]}>
                    {t('cardDetail.edit', 'Kartı Düzenle')}
                  </Text>
                </TouchableOpacity>
                <View style={{ height: verticalScale(1), backgroundColor: colors.border, marginVertical: verticalScale(4) }} />
                <TouchableOpacity
                  onPress={handleDeleteSelectedCard}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: verticalScale(12),
                    paddingHorizontal: scale(16),
                  }}
                  activeOpacity={0.7}
                >
                  <Iconify icon="mdi:garbage" size={moderateScale(20)} color="#E74C3C" style={{ marginRight: scale(12) }} />
                  <Text style={[typography.styles.body, { color: '#E74C3C', fontSize: moderateScale(16) }]}>
                    {t('cardDetail.delete', 'Kartı Sil')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      ) : (
        <>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Kartlar Listesi veya Detay */}
            <View style={{ flex: 1, minHeight: 0 }}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: scale(200), height: scale(200) }} />
                  <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100), height: scale(100) }} />
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
                  contentContainerStyle={{ flexGrow: 1, paddingBottom: verticalScale(24) }}
                  ListHeaderComponent={
                    !selectedCard && cards.length > 0 && (
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
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: verticalScale(400), marginTop: verticalScale(-250), pointerEvents: 'none' }}>
                      <Image
                        source={require('../../assets/cardbg.png')}
                        style={{ width: scale(500), height: scale(500), opacity: 0.2 }}
                        resizeMode="contain"
                      />
                      <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, fontSize: moderateScale(16), marginTop: verticalScale(-150) }]}>
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

        </>
      )}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => { setReportModalVisible(false); setReportCardId(null); }}
        reportType="card"
        alreadyReportedCodes={reportModalAlreadyCodes}
        onSubmit={handleReportModalSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  addCardIcon: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  cardsBlurSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(12),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(8),
  },
  cardListItem: {
    paddingHorizontal: scale(12),
    paddingVertical: 0,
  },
});



