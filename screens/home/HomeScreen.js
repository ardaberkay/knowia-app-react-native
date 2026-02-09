import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions, ActivityIndicator, Image, RefreshControl, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getDecksByCategory, getPopularDecks } from '../../services/DeckService';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import { getCurrentUserProfile, updateLastActiveAt } from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import { supabase } from '../../lib/supabase';
import { getFavoriteDecks } from '../../services/FavoriteService';
import { cacheProfile, getCachedProfile, cacheProfileImage, getCachedProfileImage } from '../../services/CacheService';
import DeckSkeleton from '../../components/skeleton/DeckSkeleton';
import { useTranslation } from 'react-i18next';
import DeckCard from '../../components/ui/DeckUi';



// Kategoriye göre ikon seçen yardımcı fonksiyon
function getCategoryIcon(category) {
  switch (category) {
    case 'inProgressDecks': return 'dashicons:welcome-learn-more';
    case 'defaultDecks': return 'mdi:resource-description-framework';
    case 'communityDecks': return 'fluent:people-community-20-filled';
    default: return 'solar:user-bold';
  }
}

// Scale animasyonlu kart bileşeni
const AnimatedPressable = ({ onPress, children, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function HomeScreen() {
  useAuth();
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive empty deck kart boyutları - useMemo ile optimize edilmiş
  const emptyDeckCardDimensions = useMemo(() => {
    const { DECK_CARD } = RESPONSIVE_CONSTANTS;
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    // scale() ile referans değer
    const scaledWidth = scale(DECK_CARD.REFERENCE_WIDTH);
    
    // Küçük telefonlarda biraz daha küçük yap
    let maxWidth;
    if (isSmallPhone) {
      maxWidth = width * 0.36;
    } else if (isTablet) {
      maxWidth = width * 0.20;
    } else {
      maxWidth = width * 0.34;
    }
    
    const cardWidth = Math.min(scaledWidth, maxWidth);
    const cardHeight = cardWidth * DECK_CARD.ASPECT_RATIO;
    
    return { width: cardWidth, height: cardHeight };
  }, [width, isTablet]);
  
  const [decks, setDecks] = useState({});
  const [loading, setLoading] = useState(true);
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
      
      // Önce kullanıcı ID'sini al
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setProfile(null);
        return;
      }
      
      // Cache'den profil bilgilerini yükle
      const cachedProfile = await getCachedProfile(user.id);
      if (cachedProfile) {
        setProfile(cachedProfile);
        setProfileLoading(false);
        
        // Arka planda güncel veriyi çek ve cache'le
        try {
          const freshData = await getCurrentUserProfile();
          setProfile(freshData);
          await cacheProfile(user.id, freshData);
          // Profil görselini de cache'le
          if (freshData?.image_url) {
            await cacheProfileImage(user.id, freshData.image_url);
          }
        } catch (err) {
          // Hata durumunda cache'deki veriyi kullanmaya devam et
          console.error('Error fetching fresh profile:', err);
        }
        return;
      }
      
      // Cache yoksa API'den çek
      const data = await getCurrentUserProfile();
      setProfile(data);
      
      // Cache'le
      await cacheProfile(user.id, data);
      if (data?.image_url) {
        await cacheProfileImage(user.id, data.image_url);
      }
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
      <View style={[styles.popularDecksCard, { backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)' }]}>
        {/* Başlık - Tam genişlik, kendi satırında */}
        <View style={styles.popularDecksTitleContainer}>
          <Iconify icon="fluent:arrow-trending-sparkle-24-filled" size={moderateScale(26)} color="#F98A21" style={{ marginRight: scale(6) }} />
          <Text style={[typography.styles.h2, { color: colors.text, flex: 1 }]}>
            {t('home.popularDecks', 'Popüler Desteler')}
          </Text>
        </View>
        
        {/* Açıklama metni + Buton (sol) ve Görsel (sağ) */}
        <View style={styles.popularDecksContent}>
          <View style={styles.popularDecksTextContainer}>
            <Text style={[typography.styles.caption, { color: colors.muted, marginBottom: verticalScale(12), marginTop: verticalScale(8), lineHeight: moderateScale(20) }]}>
              {t('home.popularDecksSubtitle', 'En popüler ve trend destelerle bilginizi pekiştirin')}
            </Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              activeOpacity={0.8}
              onPress={() => {
                navigation.navigate('Discover');
              }}
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
                <Iconify icon="streamline:trending-content-remix" size={moderateScale(16)} color="#FFFFFF" style={{ marginLeft: scale(6) }} />
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
      </View>
    );
  };

  const renderDeckSection = (category) => {
    const categoryDecks = decks[category];
    const limitedDecks = categoryDecks || []; // Tüm desteler gösterilecek
    const isCategoryLoading = loading || categoryDecks === undefined;

    const handleSeeAll = () => {
      // Favori deck ID'lerini çıkar
      const favoriteDeckIds = (favoriteDecks || []).map(deck => deck.id);
      navigation.navigate('CategoryDeckList', {
        category,
        title: DECK_CATEGORIES[category],
        decks: categoryDecks || [],
        favoriteDecks: favoriteDeckIds,
      });
    };

    const handleEmptyDeckPress = () => {
      // Placeholder kart tıklandığında her zaman Ready Decks (defaultDecks) kategorisine git
      const favoriteDeckIds = (favoriteDecks || []).map(deck => deck.id);
      const defaultDecksList = decks['defaultDecks'] || [];
      navigation.navigate('CategoryDeckList', {
        category: 'defaultDecks',
        title: DECK_CATEGORIES['defaultDecks'],
        decks: defaultDecksList,
        favoriteDecks: favoriteDeckIds,
      });
    };

    const showEndIcon = (categoryDecks?.length || 0) > 10;

    return (
      <AnimatedPressable 
        onPress={handleSeeAll}
        style={[styles.glassCard, { backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)' }]}
      >
          <View style={styles.sectionHeaderGradient}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Iconify icon={getCategoryIcon(category)} size={moderateScale(26)} color="#F98A21" style={{ marginRight: scale(8), marginTop: moderateScale(1) }} />
              <Text style={[typography.styles.h2, { color: colors.text }]}>{DECK_CATEGORIES[category]}</Text>
            </View>
            <View>
              <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(20)} color="#007AFF" />
            </View>
          </View>
          {isCategoryLoading ? (
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksContainer}
              decelerationRate="fast"
              snapToInterval={emptyDeckCardDimensions.width + scale(10)}
              snapToAlignment="start"
            >
              {[...Array(4)].map((_, i) => (
                <DeckSkeleton key={i} />
              ))}
            </ScrollView>
          ) : !loading && categoryDecks !== undefined && limitedDecks.length === 0 ? (
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksContainer}
              decelerationRate="fast"
              snapToInterval={emptyDeckCardDimensions.width + scale(10)}
              snapToAlignment="start"
            >
              <TouchableOpacity
                onPress={handleEmptyDeckPress}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.emptyDeckCard, 
                  { 
                    width: emptyDeckCardDimensions.width,
                    height: emptyDeckCardDimensions.height,
                    backgroundColor: isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(240, 240, 240, 0.5)',
                    borderColor: isDarkMode ? 'rgba(150, 150, 150, 0.25)' : 'rgba(200, 200, 200, 0.4)',
                    shadowColor: isDarkMode ? '#000' : '#000',
                  }
                ]}>
                  <View style={styles.emptyDeckCardContent}>
                    <View style={[
                      styles.emptyDeckPlusContainer,
                      {
                        backgroundColor: isDarkMode ? 'rgba(150, 150, 150, 0.08)' : 'rgba(200, 200, 200, 0.3)',
                        borderColor: isDarkMode ? 'rgba(150, 150, 150, 0.2)' : 'rgba(180, 180, 180, 0.4)',
                      }
                    ]}>
                      <Iconify 
                        icon="ic:round-plus" 
                        size={moderateScale(42)} 
                        color={isDarkMode ? 'rgba(150, 150, 150, 0.5)' : 'rgba(140, 140, 140, 0.5)'} 
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.decksContainer}
              decelerationRate="fast"
              snapToInterval={emptyDeckCardDimensions.width + scale(10)}
              snapToAlignment="start"
            >
              {limitedDecks.map((deck) => {
                // is_admin_created kontrolü - tüm kategoriler için geçerli
                const modifiedDeck = deck.is_admin_created
                  ? {
                      ...deck,
                      profiles: {
                        ...deck.profiles,
                        username: 'Knowia',
                        image_url: null, // logoasil.png kullanılacak
                      },
                    }
                  : deck;
                
                return (
                  <DeckCard
                    key={`deck-${deck.id}`}
                    deck={modifiedDeck}
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
                );
              })}
              {showEndIcon && (
                <View style={[styles.endIconContainer, { height: emptyDeckCardDimensions.height }]}>
                  <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(35)} color="#F98A21" style={{ marginLeft: scale(2), marginTop: moderateScale(1) }} />
                </View>
              )}
            </ScrollView>
          )}
      </AnimatedPressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={[styles.header, { backgroundColor: colors.appbar, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
          <Image
            source={ require('../../assets/home-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[typography.styles.body, { color: colors.text, fontSize: moderateScale(24), letterSpacing: moderateScale(-1) }]}>Knowia</Text>
          </View>
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
                // Cache'den görsel yüklendiğinde otomatik olarak React Native Image component cache'i kullanır
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
    padding: moderateScale(5),
    paddingTop: verticalScale(55),
    paddingBottom: verticalScale(10),
    marginRight: scale(12),
    marginLeft: scale(12),
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
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: '25%',
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(8),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  decksContainer: {
    paddingBottom: verticalScale(8),
  },
  emptyText: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: verticalScale(20),
  },
  endIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(44),
    marginLeft: scale(4),
    marginRight: scale(8),
  },
  profileAvatarButton: {
    marginLeft: scale(12),
    width: scale(47),
    height: scale(47),
    borderRadius: moderateScale(22),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  profileAvatar: {
    width: scale(47),
    height: scale(47),
    borderRadius: moderateScale(22),
    resizeMode: 'cover',
    backgroundColor: '#fff',
  },
  logoImage: {
    width: scale(44),
    height: scale(44),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCard: {
    borderRadius: moderateScale(36),
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    minHeight: verticalScale(180),
    overflow: 'hidden',
  },
  popularDecksCard: {
    borderRadius: moderateScale(36),
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    marginTop: verticalScale(16),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    overflow: 'hidden',
    paddingBottom: verticalScale(6),
    paddingTop: verticalScale(20),
  },
  popularDecksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%', // Tam genişlik
  },
  popularDecksContent: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Açıklama metni ve görsel üstten hizalı
  },
  popularDecksTextContainer: {
    flex: 1,
    marginRight: scale(2),
  },
  popularDecksImageContainer: {
    width: moderateScale(160, 0.3), // Görsel boyutu optimize edildi
    height: moderateScale(160, 0.3),
    flexShrink: 0, // Görsel küçülmesin
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularDecksImage: {
    width: moderateScale(160, 0.3), // Görsel boyutu optimize edildi
    height: moderateScale(160, 0.3),
    top: verticalScale(-20),
  },
  exploreButton: {
    borderRadius: moderateScale(99),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: moderateScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: 1,
    alignSelf: 'flex-start',
    minWidth: moderateScale(160, 0.3), // Buton genişliği optimize edildi
  },
  gradientButton: {
    paddingVertical: moderateScale(10, 0.3), // Buton padding optimize edildi
    paddingHorizontal: moderateScale(20, 0.3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(99),
  },
  exploreButtonText: {
    fontSize: moderateScale(17, 0.3), // Buton text boyutu optimize edildi
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: moderateScale(4, 0.3),
  },
  emptyDeckCard: {
    borderRadius: moderateScale(18),
    marginRight: scale(10),
    marginBottom: verticalScale(8),
    overflow: 'hidden',
    borderWidth: moderateScale(1.5),
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(8),
    elevation: 2,
  },
  emptyDeckCardContent: {
    flex: 1,
    padding: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDeckPlusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(32),
    borderWidth: moderateScale(1.5),
  },
}); 