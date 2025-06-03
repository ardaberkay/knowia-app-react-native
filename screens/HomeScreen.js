import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserProfile, updateLastActiveAt } from '../services/ProfileService';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

const DECK_CATEGORIES = {
  inProgressDecks: 'Çalıştığım Desteler',
  defaultDecks: 'Hazır Desteler',
  communityDecks: 'Topluluk Desteleri',
};

// Kategoriye göre ikon seçen yardımcı fonksiyon
function getCategoryIcon(category) {
  switch (category) {
    case 'inProgressDecks': return 'book';
    case 'defaultDecks': return 'cube';
    case 'communityDecks': return 'people';
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
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    loadDecks();
    loadProfile();
  }, []);

  // Profil yüklendiğinde push bildirim izni iste ve token'ı kaydet + last_active_at güncelle
  useEffect(() => {
    if (profile?.id) {
      registerForPushNotificationsAsync(profile.id);
      updateLastActiveAt(profile.id);
    }
  }, [profile]);

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

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const data = await getCurrentUserProfile();
      setProfile(data);
    } catch (err) {
      setProfile(null);
    } finally {
      setProfileLoading(false);
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
                    <View style={styles.deckProfileRow}>
                      <Image
                        source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../assets/avatar-default.png')}
                        style={styles.deckProfileAvatar}
                      />
                      <Text style={styles.deckProfileUsername} numberOfLines={1} ellipsizeMode="tail">
                        {deck.profiles?.username || 'Kullanıcı'}
                      </Text>
                    </View>
                    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                      <View style={styles.deckHeaderModern}>
                        {deck.to_name ? (
                          <>
                            <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                            <View style={{ width: 60, height: 2, backgroundColor: '#fff', borderRadius: 1, marginVertical: 10 }} />
                            <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                          </>
                        ) : (
                          <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                        )}
                      </View>
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
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={{ flex: 1 }} />
          <Text style={[styles.title, typography.styles.h1, styles.centeredTitle]}>Knowia</Text>
          <TouchableOpacity
            style={styles.profileAvatarButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {profileLoading ? (
              <ActivityIndicator size="small" color={colors.buttonColor} />
            ) : (
              <Image
                source={profile?.image_url ? { uri: profile.image_url } : require('../assets/avatar-default.png')}
                style={styles.profileAvatar}
              />
            )}
          </TouchableOpacity>
        </View>
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
    paddingTop: 40,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 18,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 8,
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
    padding: 8,
    justifyContent: 'space-between',
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeaderModern: {
    alignItems: 'center',
  },
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F98A21',
    lineHeight: 20,
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
    gap: 6,
    marginLeft: 3,
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
  profileAvatarButton: {
    marginLeft: 12,
    width: 47,
    height: 47,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  profileAvatar: {
    width: 47,
    height: 47,
    borderRadius: 22,
    resizeMode: 'cover',
    backgroundColor: '#fff',
  },
  centeredTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#222',
    zIndex: 1,
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: 120,
  },
  deckProfileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 11,
    marginRight: 6,
  },
  deckProfileUsername: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    paddingRight: 40,
  },
}); 