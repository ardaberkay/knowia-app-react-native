import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';

const DECK_CATEGORIES = {
  myDecks: 'Kendi Destelerim',
  defaultDecks: 'Hazır Desteler',
  communityDecks: 'Topluluk Desteleri',
  inProgressDecks: 'Çalıştığım Desteler'
};

export default function HomeScreen() {
  const { logout } = useAuth();
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

  const handleDeckPress = (deckId) => {
    // Deste detay sayfasına yönlendirme yapılacak
    console.log('Deste tıklandı:', deckId);
  };

  const renderDeckSection = (category) => {
    const categoryDecks = decks[category] || [];
    
    if (loading) {
      return (
        <>
          <Text style={styles.sectionTitle}>{DECK_CATEGORIES[category]}</Text>
          <ActivityIndicator size="small" color="#007AFF" />
        </>
      );
    }

    if (categoryDecks.length === 0) {
      return (
        <>
          <Text style={styles.sectionTitle}>{DECK_CATEGORIES[category]}</Text>
          <Text style={styles.emptyText}>Henüz deste bulunmuyor</Text>
        </>
      );
    }

    return (
      <>
        <Text style={styles.sectionTitle}>{DECK_CATEGORIES[category]}</Text>
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
              onPress={() => handleDeckPress(deck.id)}
              activeOpacity={0.9}
            >
              <View style={styles.deckCardContent}>
                <View style={styles.deckHeader}>
                  <Text style={styles.deckTitle} numberOfLines={2}>
                    {deck.name}
                  </Text>
                </View>
                
                <View style={styles.deckStats}>
                  <Text style={styles.deckCount}>
                    {deck.card_count || 0} kart
                  </Text>
                  {deck.description && (
                    <Text style={styles.deckDescription} numberOfLines={2}>
                      {deck.description}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowia</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 10,
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
}); 