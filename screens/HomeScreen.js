import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';

const DECK_CATEGORIES = {
  myDecks: 'Destelerim',
  defaultDecks: 'Hazır Desteler',
  communityDecks: 'Topluluk Desteleri',
  inProgressDecks: 'Çalıştığım Desteler'
};

// Kategoriye göre ikon seçen yardımcı fonksiyon
function getCategoryIcon(category) {
  switch (category) {
    case 'myDecks': return 'albums';
    case 'defaultDecks': return 'cube';
    case 'communityDecks': return 'people';
    case 'inProgressDecks': return 'book';
    default: return 'albums';
  }
}

export default function HomeScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [decks, setDecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const decksData = {};
      
      // Tüm kategorilerdeki desteleri paralel olarak yükle
      await Promise.all(
        Object.keys(DECK_CATEGORIES).map(async (category) => {
          try {
            decksData[category] = await getDecksByCategory(category);
          } catch (err) {
            console.error(`Error loading ${category}:`, err);
            decksData[category] = [];
          }
        })
      );
      
      setDecks(decksData);
    } catch (err) {
      setError(err.message);
      Alert.alert('Hata', 'Desteler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await logout();
      if (error) throw error;
    } catch (error) {
      Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu');
    }
  };

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  const renderDeckSection = (category) => {
    const categoryDecks = decks[category] || [];
    const limitedDecks = categoryDecks; // Tüm desteler gösterilecek

    const handleSeeAll = () => {
      navigation.navigate('CategoryDeckList', {
        category,
        title: DECK_CATEGORIES[category],
        decks: categoryDecks,
      });
    };

    const showEndIcon = categoryDecks.length > 10;

    return (
      <>
        <View style={styles.sectionHeaderGradient}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={getCategoryIcon(category)} size={22} color="#F98A21" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{DECK_CATEGORIES[category]}</Text>
          </View>
          <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAll} activeOpacity={0.7}>
            <View style={styles.seeAllContent}>
              <Text style={[styles.seeAllText, typography.styles.button, { color: colors.secondary }]}>Tümü</Text>
              <Ionicons name="chevron-forward" size={18} color="#007AFF" style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : limitedDecks.length === 0 ? (
          <Text style={[styles.emptyText, typography.styles.caption]}>Henüz deste bulunmuyor</Text>
        ) : (
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.decksContainer}
            decelerationRate="fast"
            snapToInterval={130}
            snapToAlignment="start"
          >
            {limitedDecks.map((deck) => (
              <TouchableOpacity
                key={`deck-${deck.id}`}
                style={styles.deckCardModern}
                onPress={() => handleDeckPress(deck)}
                activeOpacity={0.93}
              >
                <LinearGradient
                  colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.deckCardGradient}
                >
                  <View style={styles.deckCardContentModern}>
                    <View style={styles.deckHeaderModern}>
                      <Text style={styles.deckTitleModern} numberOfLines={2}>
                        {deck.name}
                      </Text>
                    </View>
                    <View style={styles.deckStatsModern}>
                      <View style={styles.deckCountBadge}>
                        <Ionicons name="layers" size={13} color="#fff" style={{ marginRight: 3 }} />
                        <Text style={styles.deckCountBadgeText}>{deck.card_count || 0}</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
            {showEndIcon && (
              <View style={styles.endIconContainer}>
                <Ionicons name="chevron-forward" size={32} color="#F98A21" />
              </View>
            )}
          </ScrollView>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, typography.styles.h1, { color: colors.text }]}>Knowia</Text>
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.buttonText }]}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}> 
        {Object.keys(DECK_CATEGORIES).map((category, index) => (
          <React.Fragment key={`category-${category}`}>
            {index > 0 && <View style={[styles.categoryDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.section}>
              {renderDeckSection(category)}
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ff3b30',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    marginVertical: 16,
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  decksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 16,
    marginBottom: 8,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
    borderWidth: 0,
    width: 130,
    height: 180,
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeaderModern: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F98A21',
    lineHeight: 20,
    marginTop: 2,
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    gap: 6,
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  seeAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryDivider: {
    height: 1,
    marginHorizontal: 16,
    borderRadius: 1,
  },
  endIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 180,
    marginLeft: 4,
    marginRight: 8,
  },
}); 