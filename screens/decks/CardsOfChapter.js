import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import CardDetailView from '../../components/layout/CardDetailView';
import { listChapters, distributeUnassignedEvenly } from '../../services/ChapterService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import ChapterSelector from '../../components/modals/ChapterSelector';

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
  const [isOwner, setIsOwner] = useState(false);
  const [distLoading, setDistLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const { t } = useTranslation();

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
    if (!chapter?.id && currentUserId && deck?.user_id === currentUserId && !deck?.is_shared) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              setEditMode(!editMode);
              if (editMode) {
                setSelectedCards(new Set());
              }
            }}
            style={{ marginRight: 16 }}
            activeOpacity={0.7}
          >
            <Iconify 
              icon={editMode ? "mingcute:close-fill" : "lucide:edit"} 
              size={22} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => null,
      });
    }
  }, [navigation, chapter?.id, currentUserId, deck?.user_id, deck?.is_shared, editMode]);

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

  const handleCardPress = (card) => {
    setSelectedCard(card);
  };

  const handleDistribute = async () => {
    if (!deck?.id) return;
    if (!chapters?.length) {
      Alert.alert(t('common.error', 'Hata'), t('chapters.needChapters', 'Dağıtım için en az bir bölüm oluşturmalısın.'));
      return;
    }
    setDistLoading(true);
    try {
      await distributeUnassignedEvenly(deck.id, chapters.map(c => c.id));
      Alert.alert(t('common.success', 'Başarılı'), t('chapters.distributed', 'Atanmamış kartlar bölümlere dağıtıldı.'));
      // Kartları yeniden yükle
      await fetchChapterCards();
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapters.distributeError', 'Dağıtım yapılamadı.'));
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
      Alert.alert(t('common.error', 'Hata'), t('chapterCards.noCardsSelected', 'Lütfen en az bir kart seçin.'));
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
      
      Alert.alert(
        t('common.success', 'Başarılı'),
        t('chapterCards.cardsMoved', '{{count}} kart bölüme taşındı.', { count: selectedCards.size })
      );
      
      // Seçimleri temizle ve kartları yeniden yükle
      setSelectedCards(new Set());
      setEditMode(false);
      setShowChapterModal(false);
      await fetchChapterCards();
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapterCards.moveError', 'Kartlar taşınamadı.'));
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
              size={50} 
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
            <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
            <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Kart detay görünümü gösteriliyorsa
  if (selectedCard) {
    return (
      <CardDetailView 
        card={selectedCard} 
        cards={cards} 
        onSelectCard={setSelectedCard}
        showCreatedAt={true}
      />
    );
  }

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Sabit Header Container */}
        <View style={[styles.fixedHeaderContainer, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.deckInfoCard}>
            {/* Bölüm Başlığı */}
            <View style={styles.chapterHeader}>
              {chapter?.id ? (
                <Iconify 
                  icon="streamline-freehand:plugin-jigsaw-puzzle" 
                  size={28} 
                  color={colors.buttonColor} 
                />
              ) : (
                <MaterialCommunityIcons 
                  name="alert-circle-outline" 
                  size={28} 
                  color={colors.buttonColor} 
                />
              )}
              <Text style={[styles.chapterName, typography.styles.h2, { color: colors.headText }]} numberOfLines={1}>
                {chapter.name}
              </Text>
            </View>
            
            {/* İstatistikler */}
            <View style={[styles.statsRow, { borderTopColor: colors.border || 'rgba(255,255,255,0.1)' }]}>
              {/* Total */}
              <View style={styles.statItem}>
                <Iconify icon="ri:stack-fill" size={18} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.total}
                </Text>
              </View>
              
              {/* New */}
              <View style={styles.statItem}>
                <Iconify icon="basil:eye-closed-outline" size={22} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.new}
                </Text>
              </View>
              
              {/* Learning */}
              <View style={styles.statItem}>
                <Iconify icon="mdi:fire" size={20} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learning}
                </Text>
              </View>
              
              {/* Learned */}
              <View style={styles.statItem}>
                <Iconify icon="dashicons:welcome-learn-more" size={20} color={colors.buttonColor} style={{ marginRight: 6 }} />
                <Text style={[styles.statText, { color: colors.text }]}>
                  {chapterStats.learned}
                </Text>
              </View>
            </View>
          </View>

          {/* Arama Çubuğu */}
          <View style={styles.searchContainer}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={t('chapterCards.searchPlaceholder', 'Kartlarda ara...')}
              style={{ flex: 1 }}
            />
          </View>

          {/* Edit mode'da seçim butonları */}
          {editMode && (
            <View style={[styles.editModeBar, { backgroundColor: 'transparent' }]}>
              <TouchableOpacity
                onPress={handleSelectAll}
                style={styles.editModeButton}
                activeOpacity={0.7}
              >
                <Text style={[styles.editModeButtonText, { color: colors.buttonColor }]}>
                  {selectedCards.size === filteredCards.length 
                    ? t('chapterCards.deselectAll', 'Tümünü Kaldır')
                    : t('chapterCards.selectAll', 'Tümünü Seç')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.editModeText, { color: colors.text }]}>
                {selectedCards.size} {t('chapterCards.selected', 'seçili')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowChapterModal(true)}
                style={[
                  styles.moveButton, 
                  { 
                    backgroundColor: colors.buttonColor,
                    opacity: selectedCards.size > 0 ? 1 : 0,
                  }
                ]}
                activeOpacity={0.7}
                disabled={selectedCards.size === 0}
                pointerEvents={selectedCards.size > 0 ? 'auto' : 'none'}
              >
                <Iconify icon="ion:chevron-forward" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.moveButtonText, { color: '#FFFFFF' }]}>
                  {t('chapterCards.move', 'Taşı')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {cards.length === 0 ? (
            <View style={styles.emptyState}>
              <Iconify 
                icon="ph:cards-three" 
                size={64} 
                color={colors.muted} 
              />
              <Text style={[styles.emptyStateTitle, typography.styles.h3, { color: colors.text }]}>
                {t('chapterCards.noCards', 'Henüz Kart Yok')}
              </Text>
              <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext }]}>
                {t('chapterCards.noCardsDesc', 'Bu bölümde henüz kart oluşturulmamış.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredCards}
              renderItem={renderCardItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.cardsList, { paddingBottom: Dimensions.get('window').height * 0.11 }]}
            />
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
                <Iconify icon="fluent:arrow-shuffle-24-filled" size={28} color="#FFFFFF" />
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
      </SafeAreaView>
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
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerTitle: {
    textAlign: 'center',
  },
  fixedHeaderContainer: {
    borderRadius: 44,
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  deckInfoCard: {
    backgroundColor: 'transparent',
    padding: 20,
    paddingBottom: 0,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
  },
  chapterName: {
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: 'row',
    width: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  cardsList: {
    paddingBottom: 20,
  },
  cardItem: {
    width: '100%',
    minHeight: 110,
    borderRadius: 30,
    marginBottom: 12,
    padding: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 110,
    alignSelf: 'stretch',
  },
  leftSection: {
    flex: 3,
    padding: 20,
    justifyContent: 'center',
    borderRightWidth: 5,
    minHeight: 110,
  },
  rightSection: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 110,
  },
  question: {
    fontWeight: '600',
    fontSize: 17,
    marginBottom: 8,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  divider: {
    height: 2,
    alignSelf: 'stretch',
    marginVertical: 8,
    borderRadius: 2,
  },
  answer: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    gap: -65,
  },
  loadingText: {
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
  },
  checkboxContainer: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editModeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editModeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  moveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
