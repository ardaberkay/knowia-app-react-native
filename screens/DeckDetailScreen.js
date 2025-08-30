import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Modal, FlatList, TextInput, Pressable, Image, Switch } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { setDeckStarted } from '../services/DeckService';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
 
import { Iconify } from 'react-native-iconify';
import { Alert as RNAlert } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function DeckDetailScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [isStarted, setIsStarted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
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
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const [editToName, setEditToName] = useState(deck.to_name || '');
  const [editDescription, setEditDescription] = useState(deck.description || '');
  const [editLoading, setEditLoading] = useState(false);
  const [cardsModalVisible, setCardsModalVisible] = useState(false);
  const [searchBarShouldFocus, setSearchBarShouldFocus] = useState(false);
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [shareLoading, setShareLoading] = useState(false);
  const { t } = useTranslation();

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>{t('deckDetail.errorMessage', 'Deste bilgisi bulunamadı.')}</Text>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const fetchProgress = async () => {
      setProgressLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: progressData, error } = await supabase
          .from('user_card_progress')
          .select('card_id, status, cards(deck_id)')
          .eq('user_id', user.id)
          .eq('cards.deck_id', deck.id);
        if (error) throw error;
        const learned = (progressData || []).filter(p => p.status === 'learned').length;
        const total = deck.card_count || 0;
        setProgress(total > 0 ? learned / total : 0);
      } catch (e) {
        setProgress(0);
      } finally {
        setProgressLoading(false);
      }
    };
    fetchProgress();
  }, [deck.id]);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    
      <View style={{ flex: 1, paddingHorizontal: 18 }}>
        <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, alignItems: 'center', marginTop: 12, paddingVertical: 15, width: '100%', maxWidth: 440, alignSelf: 'center' }]}>
          <View style={{ width: '100%' }}>
            {editMode ? (
              <>
                <TextInput
                  style={[styles.deckTitleModern, { textAlign: 'center', alignSelf: 'center', width: '100%', fontWeight: 'bold', fontSize: 24, color: colors.cardQuestionText, backgroundColor: '#fff8f0', borderRadius: 8, marginBottom: 4, padding: 6 }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Deste Adı"
                  maxLength={60}
                />
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={styles.dividerLine} />
                  <TextInput
                    style={[styles.deckTitleModern, { textAlign: 'center', alignSelf: 'center', width: '100%', marginTop: 2, color: colors.cardAnswerText, backgroundColor: '#fff8f0', borderRadius: 8, padding: 6 }]}
                    value={editToName}
                    onChangeText={setEditToName}
                    placeholder="Hedef Dil/Alan (isteğe bağlı)"
                    maxLength={60}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.deckTitleModern, { textAlign: 'center', alignSelf: 'center', width: '100%', color: colors.cardQuestionText }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                {deck.to_name && (
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.cardDivider }]} />
                    <Text style={[styles.deckTitleModern, { textAlign: 'center', alignSelf: 'center', width: '100%', marginTop: 2, color: colors.cardAnswerText }]} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                  </View>
                )}
              </>
            )}
          </View>
          {editMode && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 10 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#F98A21', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18, marginRight: 6 }}
                disabled={editLoading}
                onPress={async () => {
                  setEditLoading(true);
                  try {
                    const { error } = await supabase
                      .from('decks')
                      .update({ name: editName.trim(), to_name: editToName.trim() || null, description: editDescription.trim() || null })
                      .eq('id', deck.id);
                    if (error) throw error;
                    deck.name = editName.trim();
                    deck.to_name = editToName.trim() || null;
                    deck.description = editDescription.trim() || null;
                    setEditMode(false);
                  } catch (e) {
                    Alert.alert(t('deckDetail.error', 'Hata'), t('deckDetail.errorMessageDeckUpdate', 'Deste güncellenemedi.'));
                  } finally {
                    setEditLoading(false);
                  }
                }}
              >
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#eee', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}
                disabled={editLoading}
                onPress={() => {
                  setEditMode(false);
                  setEditName(deck.name);
                  setEditToName(deck.to_name || '');
                  setEditDescription(deck.description || '');
                }}
              >
                <Text style={[typography.styles.body, { color: '#333', fontWeight: 'bold', fontSize: 16 }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* Açıklama Kutusu (Glassmorphism) */}
        <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, width: '100%', maxWidth: 440, alignSelf: 'center', height: 140 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Iconify icon="mage:checklist-note" size={20} color={colors.buttonColor} style={{ marginRight: 6 }} />
            <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.details', 'Detaylar')}</Text>
          </View>
          {editMode ? (
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.deckDescription, typography.styles.body, { color: colors.cardQuestionText, backgroundColor: '#fff8f0', borderRadius: 8, padding: 8, minHeight: 40, flex: 1, textAlignVertical: 'top' }]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Deste açıklaması..."
                multiline
                maxLength={300}
                scrollEnabled
              />
            </View>
          ) : deck.description && deck.description.trim().length > 0 ? (
            <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
              <Text style={[styles.deckDescription, typography.styles.body, { color: colors.cardAnswerText }]}>{deck.description}</Text>
            </ScrollView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={[styles.deckDescription, typography.styles.body, { color: colors.cardAnswerText, textAlign: 'center' }]}>
                {t('deckDetail.noDescription', 'Deste için detay verilmemiş.')}
              </Text>
            </View>
          )}
        </View>
        {/* İlerleme Kutusu (Glassmorphism) */}
        <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, width: '100%', maxWidth: 440, alignSelf: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Iconify icon="solar:chart-2-bold-duotone" size={20} color={colors.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[typography.styles.body, styles.sectionTitle, { color: colors.cardQuestionText }]}>{t('deckDetail.progress', 'İlerleme')}</Text>
            </View>
            <View style={[styles.statBadgeModern, { marginLeft: 8 }]}>
              <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={[typography.styles.body, styles.statBadgeTextModern]}>{deck.card_count || 0}</Text>
            </View>
          </View>
          <View style={styles.progressContainerModern}>
            <View style={[styles.progressBarModern, { backgroundColor: colors.progressBar }]}>
              <View style={[styles.progressFillModern, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            {progressLoading ? (
              <Text style={[styles.progressText, typography.styles.caption, { color: colors.muted }]}>{t('common.loading', 'Yükleniyor...')}</Text>
            ) : progress === 0 ? (
              <Text style={[styles.progressText, typography.styles.caption, { color: colors.cardAnswerText }]}>{t('common.notStarted', 'Henüz çalışılmadı')}</Text>
            ) : (
              <Text style={[typography.styles.body, styles.progressText, { color: colors.cardQuestionText }]}>%{Math.round(progress * 100)} {t('deckDetail.completed', 'Tamamlandı')}</Text>
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
        {currentUserId && deck.user_id === currentUserId && (
          <View style={[styles.infoCardGlass, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, shadowColor: colors.shadowColor, shadowOffset: colors.shadowOffset, shadowOpacity: colors.shadowOpacity, shadowRadius: colors.shadowRadius, elevation: colors.elevation, width: '100%', maxWidth: 440, alignSelf: 'center', paddingVertical: 10 }]}>
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
      </View>
      {/* Sabit alt buton barı */}
      <SafeAreaView style={[styles.fixedButtonBar, { borderTopLeftRadius: 18, borderTopRightRadius: 18, ...Platform.select({ android: { paddingBottom: 18 }, ios: {} }) }]} edges={['bottom']}>
        <View style={styles.buttonRowModern}>
          <TouchableOpacity
            style={[styles.favButtonModern, { flex: 1, minWidth: 0, marginRight: 10 }]}
            onPress={() => navigation.navigate('AddCard', { deck })}
          >
            <Iconify icon="streamline-ultimate:card-add-1-bold" size={22} color={colors.buttonColor} style={{ marginRight: 6 }} />
            <Text style={[styles.favButtonTextModern, typography.styles.button, { color: colors.buttonColor }]}>{t('deckDetail.addCard', 'Kart Ekle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startButtonModern, { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.buttonBorder || 'transparent' }]}
            onPress={handleStart}
          >
            <Iconify icon="mingcute:google-play-fill" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
            <Text style={[styles.startButtonTextModern, typography.styles.button, { color: colors.buttonText }]}>{t('deckDetail.start', 'Başla')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    borderRadius: 20,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 8,
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
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
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
    paddingVertical: 18,
    paddingHorizontal: 18,
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
    borderRadius: 18,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
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
    borderRadius: 24,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
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
});