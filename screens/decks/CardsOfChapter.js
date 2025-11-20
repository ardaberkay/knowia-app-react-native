import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import SearchBar from '../../components/tools/SearchBar';

export default function ChapterCardsScreen({ route, navigation }) {
  const { chapter, deck } = route.params;
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
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
        .select('id, question, answer, image, example, note, created_at')
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
    } catch (error) {
      console.error('Error fetching chapter cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
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
    // Kart detay modalını aç
    // Bu kısım DeckDetailScreen'deki gibi implement edilebilir
  };

  const renderCardItem = ({ item: card }) => (
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
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
            {card.question}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
          <Text style={[styles.answer, typography.styles.body, { color: colors.cardAnswerText }]} numberOfLines={1}>
            {card.answer}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.deckInfoCard}>
          <Text style={[styles.deckName, typography.styles.h2, { color: colors.headText }]} numberOfLines={1}>
            {deck.name}
          </Text>
          <Text style={[styles.chapterName, typography.styles.body, { color: colors.buttonColor }]} numberOfLines={1}>
            {chapter.name}
          </Text>
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
              <MaterialCommunityIcons 
                name="cards-outline" 
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
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 20,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  deckName: {
    textAlign: 'center',
    marginBottom: 4,
  },
  chapterName: {
    textAlign: 'center',
    fontWeight: '500',
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
    padding: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  textCol: {
    width: '100%',
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
