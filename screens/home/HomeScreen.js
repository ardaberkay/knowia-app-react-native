import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator, Image, Modal, Platform, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getDecksByCategory } from '../../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Iconify } from 'react-native-iconify';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import React from 'react';
import { getCurrentUserProfile, updateLastActiveAt } from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import { supabase } from '../../lib/supabase';
import { getFavoriteDecks } from '../../services/FavoriteService';
import DeckSkeleton from '../../components/skeleton/DeckSkeleton';
import { useTranslation } from 'react-i18next';
import DeckCard from '../../components/ui/DeckUi';
import GlassBlurCard from '../../components/ui/GlassBlurCard';



// Kategoriye göre ikon seçen yardımcı fonksiyon
function getCategoryIcon(category) {
  switch (category) {
    case 'inProgressDecks': return 'dashicons:welcome-learn-more';
    case 'defaultDecks': return 'mdi:resource-description-framework';
    case 'communityDecks': return 'fluent:people-community-20-filled';
    default: return 'solar:user-bold';
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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { t } = useTranslation();

const DECK_CATEGORIES = {
  inProgressDecks: t('home.inProgressDecks', 'Çalıştığım Desteler'),
  defaultDecks: t('home.defaultDecks', 'Hazır Desteler'),
  communityDecks: t('home.communityDecks', 'Topluluk Desteleri'),
};

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
    /*if (profile?.id) {
      registerForPushNotificationsAsync(profile.id);
      updateLastActiveAt(profile.id);
    }*/
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
        Alert.alert(t('home.errorMessage', 'Hata'), t('home.errorMessageDeck', 'Desteler yüklenirken bir hata oluştu'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadDecks(),
        loadProfile(),
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const decks = await getFavoriteDecks(user.id);
            setFavoriteDecks(decks || []);
          }
        })(),
      ]);
    } finally {
      setRefreshing(false);
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


  const renderPopularDecksCard = () => {
    return (
      <GlassBlurCard style={styles.popularDecksCard}>
        <View style={styles.popularDecksContent}>
          <View style={styles.popularDecksTextContainer}>
            <View style={styles.popularDecksTitleContainer}>
              <Iconify icon="fluent:arrow-trending-sparkle-24-filled" size={26} color="#F98A21" style={{ marginRight: 6 }} />
              <Text style={[typography.styles.h2, { color: colors.text}]}>
                {t('home.popularDecks', 'Popüler Desteler')}
              </Text>
            </View>
            <Text style={[typography.styles.caption, { color: colors.muted, marginBottom: 8, lineHeight: 22 }]}>
              {t('home.popularDecksSubtitle', 'En popüler ve trend destelerle bilginizi pekiştirin')}
            </Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.exploreButtonText}>
                  {t('home.exploreButton', 'Keşfet')}
                </Text>
                <Iconify icon="streamline:trending-content-remix" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View style={styles.popularDecksImageContainer}>
            <Image
              source={require('../../assets/item.png')}
              style={styles.popularDecksImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </GlassBlurCard>
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
      <GlassBlurCard style={styles.glassCard}>
        <View style={styles.sectionHeaderGradient}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Iconify icon={getCategoryIcon(category)} size={26} color="#F98A21" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[typography.styles.h2, { color: colors.text }]}>{DECK_CATEGORIES[category]}</Text>
          </View>
          <TouchableOpacity style={[styles.seeAllButton, { borderColor: colors.secondary }]} onPress={handleSeeAll} activeOpacity={0.7}>
            <View style={styles.seeAllContent}>
              <Text style={[styles.seeAllText, typography.styles.button, { color: colors.secondary }]}>{t('home.all', 'Tümü')}</Text>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color="#007AFF" style={{ marginLeft: 2, marginTop: 1 }} />
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
          <Text style={[styles.emptyText, typography.styles.caption]}>{t('home.noDecks', 'Henüz deste bulunmuyor')}</Text>
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
              <DeckCard
                key={`deck-${deck.id}`}
                deck={deck}
                colors={colors}
                typography={typography}
                onPress={handleDeckPress}
                onToggleFavorite={async (deckId) => {
                  const isFavorite = favoriteDecks.some(fav => fav.id === deckId);
                  if (isFavorite) {
                    await handleRemoveFavoriteDeck(deckId);
                  } else {
                    await handleAddFavoriteDeck(deckId);
                  }
                }}
                isFavorite={favoriteDecks.some(fav => fav.id === deck.id)}
              />
            ))}
            {showEndIcon && (
              <View style={styles.endIconContainer}>
                <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={15} color="#F98A21" style={{ marginLeft: 2, marginTop: 1 }} />
              </View>
            )}
          </ScrollView>
        )}
      </GlassBlurCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={[styles.header, { backgroundColor: colors.appbar, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Image
            source={isDarkMode ? require('../../assets/logo-white.png') : require('../../assets/logo-black.png')}
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
                source={profile?.image_url ? { uri: profile.image_url } : require('../../assets/avatar-default.png')}
                style={styles.profileAvatar}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView 
        style={[styles.content, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.buttonColor]}
          />
        }
      > 
        {renderPopularDecksCard()}
        {Object.keys(DECK_CATEGORIES).map((category, index) => (
          <React.Fragment key={`category-${category}`}>
            {renderDeckSection(category)}
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
  scrollContentContainer: {
    paddingBottom: '25%',
  },
  section: {
    marginVertical: 16,
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  decksContainer: {
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 30,
    backgroundColor: 'rgba(29, 71, 117, 0.6)',
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
  logoImage: {
    width: 120,
    height: 44,
  },
  glassCard: {
    // GlassBlurCard component handles its own margins
  },
  popularDecksCard: {
    marginTop: 16,
  },
  popularDecksContent: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  popularDecksTextContainer: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'space-between',
  },
  popularDecksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularDecksImageContainer: {
    width: 150,
    height: 150,
    marginTop: 12,
  },
  popularDecksImage: {
    width: 160,
    height: 160,
  },
  exploreButton: {
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    alignSelf: 'flex-start',
    minWidth: 110,
  },
  gradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  exploreButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
}); 