import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator, Image, Modal, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getDecksByCategory } from '../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUserProfile, updateLastActiveAt } from '../services/ProfileService';
import { registerForPushNotificationsAsync } from '../services/NotificationService';
import { supabase } from '../lib/supabase';
import { getFavoriteDecks } from '../services/FavoriteService';
import DeckSkeleton from '../components/DeckSkeleton';

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
  const { colors, isDarkMode } = useTheme();
  const [decks, setDecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeDeckMenuId, setActiveDeckMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favoriteDecks, setFavoriteDecks] = useState([]);

  useEffect(() => {
    loadDecks();
    loadProfile();
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id));
    // Favori desteleri de çek
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.id) {
        const decks = await getFavoriteDecks(user.id);
        setFavoriteDecks(decks || []);
      }
    });
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

  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  const handleDeleteDeck = (deckId) => {
    Alert.alert(
      'Deste Silinsin mi?',
      'Bu işlemi geri alamazsınız. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('decks').delete().eq('id', deckId);
            setDecks(prev => {
              const newDecks = { ...prev };
              Object.keys(newDecks).forEach(cat => {
                newDecks[cat] = newDecks[cat].filter(deck => deck.id !== deckId);
              });
              return newDecks;
            });
            setFavoriteDecks(prev => prev.filter(deck => deck.id !== deckId));
            setActiveDeckMenuId(null);
          }
        }
      ]
    );
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
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.decksContainer}
            decelerationRate="fast"
            snapToInterval={130}
            snapToAlignment="start"
          >
            {[...Array(4)].map((_, i) => (
              <DeckSkeleton key={i} />
            ))}
          </ScrollView>
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
                  colors={colors.deckGradient}
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
                  <TouchableOpacity
                    style={{ position: 'absolute', bottom: 8, right: 5, zIndex: 10 }}
                    onPress={() => setActiveDeckMenuId(deck.id)}
                  >
                    <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.orWhite} />
                  </TouchableOpacity>
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
      <View style={[styles.header, { backgroundColor: colors.appbar, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Image
            source={isDarkMode ? require('../assets/logo-white.png') : require('../assets/logo-black.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={[styles.profileAvatarButton, { position: 'absolute', right: 0 }]}
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
      {/* Bottom Sheet Modal - sadece bir kez, en dışta */}
      <Modal
        visible={!!activeDeckMenuId}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveDeckMenuId(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'transparent' }}
          activeOpacity={1}
          onPress={() => setActiveDeckMenuId(null)}
        />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
          {/* Seçili deste */}
          {(() => {
            const allDecks = Object.values(decks).flat();
            const selectedDeck = allDecks.find(d => d.id === activeDeckMenuId);
            if (!selectedDeck) return null;
            const isFavorite = favoriteDecks.some(fav => fav.id === selectedDeck.id);
            return <>
              {/* Düzenle en üstte, sadece kendi destesi ise */}
              {selectedDeck.user_id === currentUserId && (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => { setActiveDeckMenuId(null); navigation.navigate('DeckEdit', { deck: selectedDeck }); }}
                >
                  <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>Düzenle</Text>
                </TouchableOpacity>
              )}
              {/* Favorilere Ekle/Çıkar herkes için */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={async () => {
                  if (isFavorite) {
                    await handleRemoveFavoriteDeck(selectedDeck.id);
                  } else {
                    await handleAddFavoriteDeck(selectedDeck.id);
                  }
                  setActiveDeckMenuId(null);
                }}
              >
                <MaterialCommunityIcons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorite ? '#F98A21' : colors.text}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ fontSize: 16, fontWeight: '500', color: isFavorite ? '#F98A21' : colors.text }}>
                  {isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                </Text>
              </TouchableOpacity>
              {/* Desteyi Sil sadece kendi destesi ise */}
              {selectedDeck.user_id === currentUserId && (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => handleDeleteDeck(selectedDeck.id)}
                >
                  <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>Desteyi Sil</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setActiveDeckMenuId(null)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>Kapat</Text>
              </TouchableOpacity>
            </>;
          })()}
        </View>
      </Modal>
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
    padding: 5,
    paddingTop: 55,
    paddingBottom: 10,
    marginRight: 12,
    marginLeft: 12,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
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
  logoImage: {
    width: 120,
    height: 44,
  },
}); 