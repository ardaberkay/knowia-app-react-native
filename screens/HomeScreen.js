import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';

const DECK_CATEGORIES = {
  myDecks: 'Destelerim',
  defaultDecks: 'Hazır Desteler',
  communityDecks: 'Topluluk Desteleri',
  inProgressDecks: 'Çalıştığım Desteler'
};

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

    const handleSeeAll = () => {
      navigation.navigate('CategoryDeckList', {
        category,
        title: DECK_CATEGORIES[category],
        decks: categoryDecks,
      });
    };

    return (
      <>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, typography.styles.subtitle]}>{DECK_CATEGORIES[category]}</Text>
          <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAll} activeOpacity={0.7}>
            <View style={styles.seeAllContent}>
              <Text style={[styles.seeAllText, typography.styles.button]}>Tümü</Text>
              <Ionicons name="chevron-forward" size={18} color="#007AFF" style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : categoryDecks.length === 0 ? (
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
            {categoryDecks.map((deck) => (
              <TouchableOpacity
                key={`deck-${deck.id}`}
                style={styles.deckCard}
                onPress={() => handleDeckPress(deck)}
                activeOpacity={0.9}
              >
                <View style={styles.deckCardContent}>
                  <View style={styles.deckHeader}>
                    <Text style={[styles.deckTitle, typography.styles.body]} numberOfLines={2}>
                      {deck.name}
                    </Text>
                  </View>
                  <View style={styles.deckStats}>
                    <Text style={[styles.deckCount, typography.styles.caption]}>
                      {deck.card_count || 0} Kart
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }] }>
        <Text style={[styles.title, typography.styles.h1, { color: colors.text }]}>Knowia</Text>
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.buttonText }]}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {Object.keys(DECK_CATEGORIES).map((category, index) => (
          <View key={`category-${category}`} style={styles.section}>
            {renderDeckSection(category)}
          </View>
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
    marginVertical: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },
  decksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: 120,
    height: 168,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deckCardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeader: {
    marginBottom: 8,
  },
  deckTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  deckStats: {
    marginTop: 'auto',
  },
  deckCount: {
    fontSize: 13,
    color: '#666',
  },
  deckDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
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
}); 