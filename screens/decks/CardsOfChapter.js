import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Dimensions, ActivityIndicator, Platform, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import CardDetailView from '../../components/layout/CardDetailView';
import AddEditCardInlineForm from '../../components/layout/EditCardForm';
import { listChapters, distributeUnassignedEvenly } from '../../services/ChapterService';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import ChapterSelector from '../../components/modals/ChapterSelector';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function ChapterCardsScreen({ route, navigation }) {
  const { chapter, deck } = route.params;
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [cardStatusMap, setCardStatusMap] = useState(new Map());
  const [chapterStats, setChapterStats] = useState({ total: 0, learning: 0, learned: 0, new: 0 });
  const [selectedCard, setSelectedCard] = useState(null);
  const [editCardMode, setEditCardMode] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [distLoading, setDistLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const { showSuccess, showError } = useSnackbarHelpers();
  const [moreMenuPos, setMoreMenuPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const moreMenuRef = useRef(null);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchChapterCards();
    fetchFavoriteCards();
    checkOwnerAndLoadChapters();
  }, [chapter.id, deck?.id]);

  const checkOwnerAndLoadChapters = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && deck) {
        setCurrentUserId(user.id);
        setIsOwner(user.id === deck.user_id && !deck.is_shared);
        // Bölümleri yükle (hem dağıtım hem de aktarım için)
        const data = await listChapters(deck.id);
        setChapters(data);
      }
    } catch (e) {
      // noop
    }
  };

  // Navigation header'a edit butonu ekle (sadece atanmamış kartlar için)
  useLayoutEffect(() => {
    const isOwnerUser = currentUserId && deck?.user_id === currentUserId && !deck?.is_shared;
    
    // Loading bitene kadar header ikonlarını gösterme (normal durum için)
    if (!selectedCard && loading) {
      navigation.setOptions({
        headerShown: true,
        headerTransparent: true,
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: '#fff',
        headerTitle: '',
        headerRight: () => null,
      });
      return;
    }
    
    if (selectedCard) {
      // Edit modunda header'da iconlar gözükmesin
      if (editCardMode) {
        navigation.setOptions({
          headerShown: true,
          headerTransparent: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitle: '',
          headerRight: () => null,
        });
        return;
      }
      
      // Normal kart detay görünümünde favori ve kebab iconları göster
      navigation.setOptions({
        headerShown: true,
        headerTransparent: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitle: '',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: scale(8) }}>
            <TouchableOpacity
              onPress={() => handleToggleFavoriteCard(selectedCard.id)}
              activeOpacity={0.7}
              style={{ paddingHorizontal: scale(6) }}
            >
              <Iconify
                icon={favoriteCards.includes(selectedCard.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(24)}
                color={favoriteCards.includes(selectedCard.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            {isOwnerUser && (
              <TouchableOpacity
                ref={moreMenuRef}
                onPress={openCardMenu}
                activeOpacity={0.7}
                style={{ paddingHorizontal: scale(6) }}
              >
                <Iconify icon="iconamoon:menu-kebab-horizontal-bold" size={moderateScale(26)} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
      return;
    }
    
    // Normal durumda header'ı şeffaf yap (appbar görünmesin)
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTintColor: '#fff',
      headerTitle: '',
      headerRight: isOwnerUser ? () => (
        <TouchableOpacity
          onPress={() => {
            setEditMode(!editMode);
            if (editMode) {
              setSelectedCards(new Set());
            }
          }}
          style={{ marginRight: scale(16) }}
          activeOpacity={0.7}
        >
          <Iconify 
            icon={editMode ? "mingcute:close-fill" : "lucide:edit"} 
            size={moderateScale(22)} 
            color="#FFFFFF" 
          />
        </TouchableOpacity>
      ) : () => null,
    });
  }, [loading, navigation, chapter?.id, currentUserId, deck?.user_id, deck?.is_shared, editMode, selectedCard, editCardMode, favoriteCards, colors.text, colors.background, openCardMenu]);

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

  const fetchChapterCards = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('cards')
        .select('id, question, answer, image, example, note, created_at, deck:decks(id, categories(sort_order))')
        .eq('deck_id', deck.id)
        .order('created_at', { ascending: false });
      if (chapter?.id) {
        query = query.eq('chapter_id', chapter.id);
      } else {
        query = query.is('chapter_id', null);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      setCards(data || []);
      
      // Kartları çektikten hemen sonra status'leri de çek
      if (data && data.length > 0) {
        await fetchCardStatusesForCards(data.map(c => c.id));
      } else {
        setCardStatusMap(new Map());
        setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
      }
    } catch (error) {
      console.error('Error fetching chapter cards:', error);
      setCards([]);
      setCardStatusMap(new Map());
    } finally {
      setLoading(false);
    }
  };

  const fetchCardStatusesForCards = async (cardIds) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !cardIds || cardIds.length === 0) {
        // Progress kaydı olmayan kartlar için 'new' varsay
        const statusMap = new Map();
        if (cardIds && cardIds.length > 0) {
          cardIds.forEach(cardId => {
            statusMap.set(cardId, 'new');
          });
          setCardStatusMap(statusMap);
          setChapterStats({ 
            total: cardIds.length, 
            learning: 0, 
            learned: 0, 
            new: cardIds.length 
          });
        } else {
          setCardStatusMap(new Map());
          setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
        }
        return;
      }
      
      // Kullanıcının bu kartlar için status bilgilerini al
      const { data: progressData, error: progressError } = await supabase
        .from('user_card_progress')
        .select('card_id, status')
        .eq('user_id', user.id)
        .in('card_id', cardIds);
      
      if (progressError) throw progressError;
      
      // Map oluştur: card_id -> status
      const statusMap = new Map();
      (progressData || []).forEach(item => {
        statusMap.set(item.card_id, item.status);
      });
      
      // Progress kaydı olmayan kartlar için 'new' varsay
      cardIds.forEach(cardId => {
        if (!statusMap.has(cardId)) {
          statusMap.set(cardId, 'new');
        }
      });
      
      setCardStatusMap(statusMap);
      
      // İstatistikleri hesapla
      if (cardIds && cardIds.length > 0) {
        const stats = {
          total: cardIds.length,
          learning: 0,
          learned: 0,
          new: 0,
        };
        statusMap.forEach((status) => {
          if (status === 'learning') stats.learning++;
          else if (status === 'learned') stats.learned++;
          else stats.new++;
        });
        setChapterStats(stats);
      } else {
        setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
      }
    } catch (error) {
      console.error('Error fetching card statuses:', error);
      // Hata durumunda da tüm kartları 'new' olarak işaretle
      if (cardIds && cardIds.length > 0) {
        const statusMap = new Map();
        cardIds.forEach(cardId => {
          statusMap.set(cardId, 'new');
        });
        setCardStatusMap(statusMap);
        setChapterStats({ 
          total: cardIds.length, 
          learning: 0, 
          learned: 0, 
          new: cardIds.length 
        });
      } else {
        setCardStatusMap(new Map());
        setChapterStats({ total: 0, learning: 0, learned: 0, new: 0 });
      }
    }
  };

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

  const handleEditSelectedCard = () => {
    if (!selectedCard) return;
    setMoreMenuVisible(false);
    setEditCardMode(true);
  };

  const handleDeleteSelectedCard = async () => {
    if (!selectedCard) return;
    try {
      await supabase.from('cards').delete().eq('id', selectedCard.id);
      setSelectedCard(null);
      setEditCardMode(false);
      await fetchChapterCards();
    } catch (e) {
      showError(t('cardDetail.deleteError', 'Kart silinirken bir hata oluştu.'));
    }
  };

  const openCardMenu = () => {
    if (!selectedCard) return;
    if (moreMenuRef.current && moreMenuRef.current.measureInWindow) {
      moreMenuRef.current.measureInWindow((x, y, width, height) => {
        setMoreMenuPos({ x, y, width, height });
        setMoreMenuVisible(true);
      });
    } else {
      setMoreMenuVisible(true);
    }
  };

  const handleCardPress = (card) => {
    setSelectedCard(card);
  };

  const handleDistribute = async () => {
    if (!deck?.id) return;
    if (!chapters?.length) {
      showError(t('chapters.needChapters', 'Dağıtım için en az bir bölüm oluşturmalısın.'));
      return;
    }
    setDistLoading(true);
    try {
      await distributeUnassignedEvenly(deck.id, chapters.map(c => c.id));
      showSuccess(t('chapters.distributed', 'Atanmamış kartlar bölümlere dağıtıldı.'));
      // Kartları yeniden yükle
      await fetchChapterCards();
    } catch (e) {
      showError(e.message || t('chapters.distributeError', 'Dağıtım yapılamadı.'));
    } finally {
      setDistLoading(false);
    }
  };

  const handleToggleCardSelection = (cardId) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCards.size === filteredCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredCards.map(c => c.id)));
    }
  };

  const handleMoveToChapter = async (targetChapterId) => {
    if (selectedCards.size === 0) {
      showError(t('chapterCards.noCardsSelected', 'Lütfen en az bir kart seçin.'));
      return;
    }
    setMoveLoading(true);
    try {
      const cardIds = Array.from(selectedCards);
      const { error } = await supabase
        .from('cards')
        .update({ chapter_id: targetChapterId || null })
        .in('id', cardIds);
      
      if (error) throw error;
      
      showSuccess(t('chapterCards.cardsMoved', '{{count}} kart bölüme taşındı.', { count: selectedCards.size }));
      
      // Seçimleri temizle ve kartları yeniden yükle
      setSelectedCards(new Set());
      setEditMode(false);
      setShowChapterModal(false);
      await fetchChapterCards();
    } catch (e) {
      showError(e.message || t('chapterCards.moveError', 'Kartlar taşınamadı.'));
    } finally {
      setMoveLoading(false);
    }
  };

  const renderCardItem = ({ item: card }) => {
    const status = cardStatusMap.get(card.id) || 'new';
    let statusIcon = 'streamline-freehand:view-eye-off'; // default: new
    
    if (status === 'learning') {
      statusIcon = 'mdi:fire';
    } else if (status === 'learned') {
      statusIcon = 'dashicons:welcome-learn-more';
    }

    const isSelected = selectedCards.has(card.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.cardItem,
          {
            backgroundColor: colors.cardBackground,
            borderColor: editMode && isSelected ? colors.buttonColor : colors.cardBorder,
            borderWidth: editMode && isSelected ? 2 : 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          },
        ]}
        onPress={() => {
          if (editMode) {
            handleToggleCardSelection(card.id);
          } else {
            handleCardPress(card);
          }
        }}
        activeOpacity={0.85}
      >
        <View style={styles.cardContent}>
          {/* Edit mode'da checkbox */}
          {editMode && (
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                onPress={() => handleToggleCardSelection(card.id)}
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? colors.buttonColor : 'transparent',
                    borderColor: colors.buttonColor,
                  }
                ]}
              >
                {isSelected && (
                  <Iconify icon="mingcute:close-fill" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
          
          {/* Sol bölüm - edit mode'da kısaltılmış genişlik */}
          <View style={[
            styles.leftSection,
            {
              borderRightColor: colors.cardBorder,
              flex: editMode ? 2 : 3,
            }
          ]}>
            <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
              {card.question}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
            <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
              {card.answer}
            </Text>
          </View>
          
          {/* Sağ bölüm - sabit genişlik, daha koyu renk */}
          <View style={[
            styles.rightSection,
            {
              backgroundColor: colors.cardBackground ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
            }
          ]}>
            <Iconify 
              icon={statusIcon} 
              size={scale(50)} 
              color={'#444444'} 
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
        <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={styles.loadingContainer}>
            <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: scale(200), height: scale(200) }} />
            <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: scale(100), height: scale(100) }} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Kart detay görünümü gösteriliyorsa
  if (selectedCard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {editCardMode ? (
          <AddEditCardInlineForm
            card={selectedCard}
            deck={deck}
            onSave={async (updatedCard) => {
              setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
              setSelectedCard(updatedCard);
              setEditCardMode(false);
              await fetchChapterCards();
            }}
            onCancel={() => {
              setEditCardMode(false);
            }}
          />
        ) : (
          <>
            <CardDetailView 
              card={selectedCard} 
              cards={cards} 
              onSelectCard={card => {
                setSelectedCard(card);
                setEditCardMode(false);
              }}
              showCreatedAt={true}
            />
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
        )}
      </SafeAreaView>
    );
  }

  // Header yüksekliği: status bar + header (yaklaşık 44-56px) + safe area top + ekstra boşluk
  const headerHeight = Platform.OS === 'ios' ? insets.top + 44 : 56;
  const chapterIcon = chapter?.id ? 'streamline-freehand:plugin-jigsaw-puzzle' : 'solar:calendar-minimalistic-bold';
  const chapterName = chapter?.name || t('chapterCards.noChapter', 'Atanmamış Kartlar');

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      {/* Fixed Header Section */}
      <View style={styles.fixedHeaderContainer}>
        <LinearGradient
          colors={[colors.cardBackground, colors.cardBackground]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fixedHeaderGradient, { paddingTop: headerHeight + verticalScale(32) }]}
        >
          <View style={styles.headerContent}>
            {/* Icon and Title Section */}
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: colors.buttonColor + '20' }]}>
                  <Iconify icon={chapterIcon} size={moderateScale(28)} color={colors.buttonColor} />
                </View>
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
                  {chapterName}
                </Text>
              </View>
            </View>

             {/* İstatistikler */}
             <View style={[styles.statsRow, { marginBottom: verticalScale(10) }]}>
              {/* Total */}
              <View style={styles.statItem}>
                <Iconify icon="ri:stack-fill" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.total}
                </Text>
              </View>
              
              {/* New */}
              <View style={styles.statItem}>
                <Iconify icon="basil:eye-closed-outline" size={moderateScale(22)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.new}
                </Text>
              </View>
              
              {/* Learning */}
              <View style={styles.statItem}>
                <Iconify icon="mdi:fire" size={moderateScale(20)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learning}
                </Text>
              </View>
              
              {/* Learned */}
              <View style={styles.statItem}>
                <Iconify icon="dashicons:welcome-learn-more" size={moderateScale(20)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learned}
                </Text>
              </View>
            </View>

            {/* Search Row */}
            <View style={styles.searchRow}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('chapterCards.searchPlaceholder', 'Kartlarda ara...')}
                style={styles.searchBar}
              />
            </View>

            {/* Edit mode'da seçim butonları */}
            {editMode && (
              <View style={[styles.editModeBar, { backgroundColor: 'transparent', marginTop: verticalScale(12) }]}>
                <TouchableOpacity
                  onPress={handleSelectAll}
                  style={styles.editModeButton}
                  activeOpacity={0.7}
                >
                  <Iconify icon={selectedCards.size === filteredCards.length ? "material-symbols:all-out-rounded" : "material-symbols:all-out-outline-rounded"} size={moderateScale(20)} color="#fff" />
                  <Text style={[styles.editModeButtonText, { color: '#fff' }]}>
                    {selectedCards.size === filteredCards.length 
                      ? t('chapterCards.deselectAll', 'Tümünü Kaldır')
                      : t('chapterCards.selectAll', 'Tümünü Seç')}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.editModeText, { color: '#fff' }]}>
                  {selectedCards.size} {t('chapterCards.selected', 'seçili')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowChapterModal(true)}
                  style={[
                    styles.moveButton, 
                    { 
                      backgroundColor: '#fff',
                      opacity: selectedCards.size > 0 ? 1 : 0,
                    }
                  ]}
                  activeOpacity={0.7}
                  disabled={selectedCards.size === 0}
                  pointerEvents={selectedCards.size > 0 ? 'auto' : 'none'}
                >
                  <Iconify icon="ion:chevron-forward" size={moderateScale(20)} color={colors.buttonColor} style={{ marginRight: scale(6) }} />
                  <Text style={[styles.moveButtonText, { color: colors.buttonColor }]}>
                    {t('chapterCards.move', 'Taşı')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* List Content */}
      <View style={[styles.listContainer, { backgroundColor: colors.background }]}>
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/cardbg.png')}
              style={{ width: 500, height: 500, opacity: 0.2 }}
              resizeMode="contain"
            />
            <Text style={[typography.styles.body, { color: colors.text, opacity: 0.6, textAlign: 'center', fontSize: 16, marginTop: -150 }]}>
              {t('chapterCards.noCardsDesc', 'Bu bölümde henüz kart oluşturulmamış.')}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 18 }}>
            <FlatList
              data={filteredCards}
              renderItem={renderCardItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.cardsList, { paddingBottom: Dimensions.get('window').height * 0.11, paddingTop: 20 }]}
            />
          </View>
        )}
      </View>
      
      {/* Floating Action Button - Atanmamış kartlar için dağıtım butonu */}
      {!chapter?.id && !editMode && currentUserId && deck?.user_id === currentUserId && !deck?.is_shared && (
          <TouchableOpacity
            onPress={handleDistribute}
            disabled={distLoading}
            activeOpacity={0.85}
            style={styles.fab}
          >
            <LinearGradient
              colors={['#F98A21', '#FF6B35']}
              locations={[0, 0.99]}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {distLoading ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <Iconify icon="fluent:arrow-shuffle-24-filled" size={moderateScale(28)} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

      {/* Bölüm Seçim Modal */}
      <ChapterSelector
        isVisible={showChapterModal}
        onClose={() => {
          setShowChapterModal(false);
          if (!moveLoading) {
            setSelectedCards(new Set());
            setEditMode(false);
          }
        }}
        chapters={chapters}
        onSelectChapter={(chapterId) => {
          handleMoveToChapter(chapterId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bgGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(16),
  },
  headerTitle: {
    textAlign: 'center',
  },
  fixedHeaderContainer: {
    zIndex: 1,
    overflow: 'hidden',
  },
  fixedHeaderGradient: {
    paddingBottom: verticalScale(12),
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(20),
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
  },
  heroIconContainer: {
    marginRight: scale(12),
  },
  iconCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(2),
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  heroTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.h2,
    fontSize: moderateScale(28),
    fontWeight: '900',
    marginBottom: verticalScale(6),
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.styles.caption,
    fontSize: moderateScale(15),
    fontWeight: '500',
    lineHeight: verticalScale(20),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: verticalScale(8),
  },
  searchBar: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    marginTop: verticalScale(-20),
    zIndex: 2,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    overflow: 'hidden',
  },
  cardsList: {
    paddingBottom: verticalScale(20),
  },
  cardItem: {
    width: '100%',
    minHeight: verticalScale(110),
    borderRadius: moderateScale(30),
    marginBottom: verticalScale(12),
    padding: 0,
    borderWidth: moderateScale(1),
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    width: '100%',
    minHeight: verticalScale(110),
    alignSelf: 'stretch',
  },
  leftSection: {
    flex: 3,
    padding: moderateScale(20),
    justifyContent: 'center',
    borderRightWidth: moderateScale(5),
    minHeight: verticalScale(110),
  },
  rightSection: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(20),
    minHeight: verticalScale(110),
  },
  question: {
    fontWeight: '600',
    fontSize: moderateScale(17),
    marginBottom: verticalScale(8),
    letterSpacing: 0.3,
    marginTop: verticalScale(4),
  },
  divider: {
    height: verticalScale(2),
    alignSelf: 'stretch',
    marginVertical: verticalScale(8),
    borderRadius: moderateScale(2),
  },
  answer: {
    fontSize: moderateScale(15),
    marginTop: verticalScale(4),
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  iconBtn: {
    padding: moderateScale(8),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(4),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(-250),
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
    fontSize: moderateScale(16),
  },
  fab: {
    position: 'absolute',
    right: scale(20),
    bottom: verticalScale(24),
    width: scale(70),
    height: scale(70),
    borderRadius: moderateScale(35),
    overflow: 'hidden',
    zIndex: 1000,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(35),
  },
  checkboxContainer: {
    padding: moderateScale(15),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: scale(24),
    height: scale(24),
    borderRadius: moderateScale(6),
    borderWidth: moderateScale(2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(12),
    marginHorizontal: scale(14),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(10),
    minHeight: verticalScale(48),
    borderRadius: moderateScale(12),
    borderWidth: moderateScale(1),
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingVertical: verticalScale(6),
  },
  editModeButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  editModeText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(20),
  },
  moveButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});
