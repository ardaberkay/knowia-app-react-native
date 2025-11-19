import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, FlatList, TextInput } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

export default function ChapterCardsScreen({ route, navigation }) {
  const { chapter, deck } = route.params;
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
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
      style={[styles.cardItem, { backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow }]}
      onPress={() => handleCardPress(card)}
      activeOpacity={0.8}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardTextContainer}>
          <Text style={[styles.cardQuestion, typography.styles.body, { color: colors.text }]} numberOfLines={2}>
            {card.question}
          </Text>
          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.cardAnswer, typography.styles.caption, { color: colors.subtext }]} numberOfLines={2}>
            {card.answer}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => handleToggleFavoriteCard(card.id)}
        >
          <MaterialCommunityIcons
            name={favoriteCards.includes(card.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={favoriteCards.includes(card.id) ? '#F98A21' : colors.muted}
          />
        </TouchableOpacity>
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
          <View style={[styles.searchBar, { backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow }]}>
            <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('chapterCards.searchPlaceholder', 'Kartlarda ara...')}
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
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
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  cardsList: {
    paddingBottom: 20,
  },
  cardItem: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  cardQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  cardDivider: {
    height: 1,
    marginVertical: 8,
    borderRadius: 1,
  },
  cardAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 20,
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
