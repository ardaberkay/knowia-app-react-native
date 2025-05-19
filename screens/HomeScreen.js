import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import React from 'react';

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
              <Text style={[styles.seeAllText, typography.styles.button, { color: colors.secondary }]}>Tümü</Text>
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
                    <Text style={[styles.deckCount, typography.styles.caption, { color: colors.subtext }]}>
                      {deck.card_count || 0} Adet
                    </Text>
                  </View>
                  <View style={styles.deckBottomStrip} />
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
  },
  decksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    width: 130,
    height: 180,
    borderWidth: 1,
    borderColor: '#ececec',
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
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  deckStats: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  deckCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  deckDescription: {
    fontSize: 12,
    marginTop: 4,
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
  deckBottomStrip: {
    height: 4,
    width: '100%',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#F98A21',
  },
  categoryDivider: {
    height: 1,
    marginHorizontal: 16,
    borderRadius: 1,
  },
}); 