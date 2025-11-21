import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';
import CardDetailView from '../../components/layout/CardDetailView';

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
  const { t } = useTranslation();

  useEffect(() => {
    fetchChapterCards();
    fetchFavoriteCards();
  }, [chapter.id]);

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

  const renderCardItem = ({ item: card }) => {
    const status = cardStatusMap.get(card.id) || 'new';
    let statusIcon = 'streamline-freehand:view-eye-off'; // default: new
    
    if (status === 'learning') {
      statusIcon = 'mdi:fire';
    } else if (status === 'learned') {
      statusIcon = 'dashicons:welcome-learn-more';
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.cardItem,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          },
        ]}
        onPress={() => handleCardPress(card)}
        activeOpacity={0.85}
      >
        <View style={styles.cardContent}>
          {/* Sol bölüm - 3/4 genişlik */}
          <View style={[
            styles.leftSection,
            {
              borderRightColor: colors.cardBorder,
            }
          ]}>
            <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
              {card.question}
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
            <Text style={[styles.answer, typography.styles.body, { color: colors.cardAnswerText }]} numberOfLines={1}>
              {card.answer}
            </Text>
          </View>
          
          {/* Sağ bölüm - 1/4 genişlik, daha koyu renk */}
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
            <Text style={[styles.loadingText, typography.styles.body, { color: colors.text }]}>
              {t('common.loading', 'Yükleniyor...')}
            </Text>
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
        <View style={styles.deckInfoCard}>
          {/* Bölüm Başlığı */}
          <View style={styles.chapterHeader}>
            <Iconify 
              icon="streamline-freehand:plugin-jigsaw-puzzle" 
              size={28} 
              color={colors.buttonColor} 
            />
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
              <Iconify icon="streamline-freehand:view-eye-off" size={18} color={colors.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.statText, { color: colors.text }]}>
                {chapterStats.new}
              </Text>
            </View>
            
            {/* Learning */}
            <View style={styles.statItem}>
              <Iconify icon="mdi:fire" size={18} color={colors.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.statText, { color: colors.text }]}>
                {chapterStats.learning}
              </Text>
            </View>
            
            {/* Learned */}
            <View style={styles.statItem}>
              <Iconify icon="dashicons:welcome-learn-more" size={18} color={colors.buttonColor} style={{ marginRight: 6 }} />
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
              contentContainerStyle={styles.cardsList}
            />
          )}
        </View>
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
  deckInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    marginBottom: 20,
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
    borderRightWidth: 2,
    minHeight: 110,
  },
  rightSection: {
    flex: 1,
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
  },
  loadingText: {
    fontSize: 16,
  },
});
