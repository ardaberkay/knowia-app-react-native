import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Image, RefreshControl, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getDecksByCategory } from '../../services/DeckService';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { Iconify } from 'react-native-iconify';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';
import { getFavoriteDecks, addFavoriteDeck, removeFavoriteDeck } from '../../services/FavoriteService';
import { updateLastActiveAt, updateNotificationPreference } from '../../services/ProfileService';
import { registerForPushNotificationsAsync } from '../../services/NotificationService';
import * as Notifications from 'expo-notifications';
import DeckSkeleton from '../../components/skeleton/DeckSkeleton';
import CommunityDeckSkeleton from '../../components/skeleton/CommunityDeckSkeleton';
import { useTranslation } from 'react-i18next';
import DeckCard from '../../components/ui/DeckUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StandardCustomAppBar from '../../components/layout/StandardCustomAppBar';
import CommunityDeckCard from '../../components/ui/CommunityDeckCard';


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
  const { session } = useAuth();
  const userId = session?.user?.id;
  const navigation = useNavigation();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

  const emptyDeckCardDimensions = useMemo(() => {
    const { DECK_CARD } = RESPONSIVE_CONSTANTS;
    const scaledWidth = scale(DECK_CARD.REFERENCE_WIDTH);
    const maxWidth = isTablet ? width * 0.20 : width * 0.36;
    const cardWidth = Math.min(scaledWidth, maxWidth);
    const cardHeight = cardWidth * DECK_CARD.ASPECT_RATIO;

    return { width: cardWidth, height: cardHeight };
  }, [width, isTablet]);

  const [decks, setDecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const decksLoadedRef = useRef(false);
  const notificationSetupDoneRef = useRef(false);
  const processingDecksRef = useRef(new Set());
  const { t } = useTranslation();
  const scrollViewRef = useRef(null);

  const DECK_CATEGORIES = {
    inProgressDecks: t('home.inProgressDecks', 'Çalıştığım Desteler'),
    defaultDecks: t('home.defaultDecks', 'Hazır Desteler'),
    communityDecks: t('home.communityDecks', 'Topluluk Desteleri'),
  };

  useScrollToTop(scrollViewRef);

  useEffect(() => {
    loadDecks();
    setCurrentUserId(userId);
    if (userId) {
      getFavoriteDecks(userId).then(decks => setFavoriteDecks(decks || []));
    }
  }, []);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const decksData = {};

      // Tüm kategorilerdeki desteleri paralel olarak yükle
      await Promise.all(
        Object.keys(DECK_CATEGORIES).map(async (category) => {
          try {
            // Anasayfada 10 deste göster, 11. kayıt varsa devam işareti göster.
            const limit = category === 'communityDecks' ? 3 : 10;
            const community = category === 'communityDecks';
            const result = await getDecksByCategory(userId, category, { limit, includeHasMore: !community });
            decksData[category] = result || { decks: [], hasMore: false };
          } catch (err) {
            console.error(`Error loading ${category}:`, err);
            decksData[category] = { decks: [], hasMore: false };
          }
        })
      );

      setDecks(decksData);
      decksLoadedRef.current = true;
    } catch (err) {
      Alert.alert(t('home.errorMessage', 'Hata'), t('home.errorMessageDeck', 'Desteler yüklenirken bir hata oluştu'));
    } finally {
      setLoading(false);
    }
  };

  const loadInProgressDecks = useCallback(async () => {
    try {
      // Çalıştığım Desteler için de anasayfada yalnızca son 10 kayıt yeterli
      const data = await getDecksByCategory(userId, 'inProgressDecks', { limit: 10, includeHasMore: true });
      setDecks(prev => ({ ...prev, inProgressDecks: data || { decks: [], hasMore: false } }));
    } catch (err) {
      console.error('Error loading inProgressDecks:', err);
      setDecks(prev => ({ ...prev, inProgressDecks: { decks: [], hasMore: false } }));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (decksLoadedRef.current) {
        loadInProgressDecks();
      }

      if (!userId) return;

      (async () => {
        await updateLastActiveAt(userId);

        if (notificationSetupDoneRef.current) return;
        notificationSetupDoneRef.current = true;

        const token = await registerForPushNotificationsAsync(userId);

        if (token) {
          await updateNotificationPreference(userId, true);
        }
      })();
    }, [loadInProgressDecks, userId])
  );


  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadDecks(),
        userId ? getFavoriteDecks(userId).then(decks => setFavoriteDecks(decks || [])) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  const handleToggleFavorite = async (deckId) => {
    if (!userId) return;

    // 1. Hızlı tıklama kilidi: Bu deste için işlem sürüyorsa ikinci tıklamayı yoksay
    if (processingDecksRef.current.has(deckId)) return;

    // Kilidi koy
    processingDecksRef.current.add(deckId);

    try {
      // 2. Mevcut favori durumunu kontrol et
      const isFavorite = favoriteDecks.some((fav) => {
        if (typeof fav === 'object' && fav !== null) {
          return fav.id === deckId || fav.deck_id === deckId;
        }
        return fav === deckId;
      });

      // 3. Duruma göre ekle veya çıkar
      if (isFavorite) {
        await removeFavoriteDeck(userId, deckId);
      } else {
        await addFavoriteDeck(userId, deckId);
      }

      // 4. Güncel listeyi çekip state'e yaz
      const decks = await getFavoriteDecks(userId);
      setFavoriteDecks(decks || []);
    } catch (error) {
      console.error('Favori işlemi sırasında hata oluştu:', error);
    } finally {
      // 5. İşlem bittiğinde kilidi kaldır
      processingDecksRef.current.delete(deckId);
    }
  };

  const handleRemoveFavoriteDeck = async (deckId) => {
    if (!userId) return;
    await removeFavoriteDeck(userId, deckId);
    const decks = await getFavoriteDecks(userId);
    setFavoriteDecks(decks || []);
  };

  const renderHeroHeader = () => {
    const config = {
      gradient: ['#ffa726', '#ff6b35'],
    };

    return (
      <View style={styles.heroHeaderContainer}>
        <LinearGradient
          colors={[
            ...config.gradient,
            ...config.gradient.slice().reverse(),
          ]}
          style={styles.heroHeader}
          start={{ x: 1, y: 0.1 }}
          end={{ x: 0, y: 1 }}
        >
          <StandardCustomAppBar
            showLogo
            isHeroBackground
          />

          <View style={styles.heroContent}>
            <View style={styles.heroTextContent}>
              <View style={styles.heroTitleRow}>
                <Iconify
                  icon="fluent:arrow-trending-sparkle-24-filled"
                  size={24}
                  color="#FFFFFF"
                />

                <Text style={styles.heroTitle}>
                  Keşfet ve öğren
                </Text>
              </View>

              <Text style={styles.heroSubtitle}>
                {t(
                  'home.popularDecksSubtitle',
                  'En popüler ve trend destelerle bilginizi pekiştirin'
                )}
              </Text>

              <TouchableOpacity
                style={styles.heroButton}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Discover')}
              >
                <Iconify
                  icon="streamline:trending-content-remix"
                  size={17}
                  color="#ff6b35"
                />

                <Text style={styles.heroButtonText}>
                  {t('home.exploreButton', 'Keşfet')}
                </Text>

                <Iconify
                  icon="material-symbols:arrow-forward-ios-rounded"
                  size={16}
                  color="#ff6b35"
                />
              </TouchableOpacity>
            </View>

            <Image
              source={require('../../assets/item.webp')}
              style={styles.heroIllustration}
              fadeDuration={0}

            />
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderDeckSection = (category) => {
    const categoryData = decks[category];
    const categoryDecks = Array.isArray(categoryData) ? categoryData : categoryData?.decks;
    const hasMoreDecks = Array.isArray(categoryData) ? false : Boolean(categoryData?.hasMore);
    const totalActiveDeckCount = Array.isArray(categoryData) ? undefined : categoryData?.totalCount;
    const limitedDecks = categoryDecks || []; // Tüm desteler gösterilecek
    const isCategoryLoading = loading || categoryDecks === undefined;
    const isInProgressSection = category === 'inProgressDecks';
    const isDefaultDecksSection = category === 'defaultDecks';
    const isCommunityDecksSection = category === 'communityDecks';
    const activeDeckCount = isInProgressSection
      ? (totalActiveDeckCount ?? categoryDecks?.length ?? 0)
      : (categoryDecks?.length || 0);

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
      const defaultDecksData = decks['defaultDecks'];
      const defaultDecksList = Array.isArray(defaultDecksData) ? defaultDecksData : defaultDecksData?.decks || [];
      navigation.navigate('CategoryDeckList', {
        category: 'defaultDecks',
        title: DECK_CATEGORIES['defaultDecks'],
        decks: defaultDecksList,
        favoriteDecks: favoriteDeckIds,
      });
    };

    const showEndIcon = hasMoreDecks;
    const SectionWrapper = isInProgressSection ? AnimatedPressable : View;
    const HeaderWrapper = isInProgressSection ? View : TouchableOpacity;
    return (
      <SectionWrapper
        {...(isInProgressSection
          ? {
            onPress: handleSeeAll,
            style: [
              styles.glassCard,
              {
                backgroundColor: colors.homeCardBackground,
                borderColor: colors.cardBorder,
                borderWidth: 1,
              },
            ],
          }
          : {
            style: styles.deckSection,
          })}
      >
        <HeaderWrapper onPress={handleSeeAll} activeOpacity={0.9} style={[styles.sectionHeaderGradient, !isInProgressSection && styles.hairlineBorder, {
          marginHorizontal: isInProgressSection ? 0 : 8,
        }]}>
          <View style={styles.sectionHeaderLeft}>
            <Iconify
              icon={getCategoryIcon(category)}
              size={moderateScale(26)}
              color="#F98A21"
              style={{ marginRight: scale(8) }}
            />
            <View style={styles.sectionTitleBlock}>
              <Text style={[typography.styles.h2, { color: colors.text }]}>{DECK_CATEGORIES[category]}</Text>
              {isInProgressSection ? (
                <Text style={[typography.styles.caption, styles.inProgressMetaText, { color: colors.muted }]}>
                  {isCategoryLoading
                    ? t('common.loading', 'Yükleniyor...')
                    : activeDeckCount > 0
                      ? t('home.activeDeckCount', { count: activeDeckCount, defaultValue: '{{count}} aktif deste' })
                      : t('home.noActiveDecks', { defaultValue: 'Aktif deste yok' })}
                </Text>
              ) : null}
            </View>
          </View>
          <View>
            <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(20)} color="#007AFF" />
          </View>
        </HeaderWrapper>
        {isCategoryLoading ? (
          isCommunityDecksSection ? (
            // Topluluk Desteleri için Dikey Skeleton Dizilimi
            <View style={styles.verticalCommunitySkeletonContainer}>
              {[...Array(3)].map((_, i) => (
                <CommunityDeckSkeleton key={i} />
              ))}
            </View>
          ) : (
            // Diğer kategoriler için mevcut Yatay Skeleton
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.decksContainer, { paddingLeft: isInProgressSection ? 0 : 10 }]}
              decelerationRate="fast"
              snapToInterval={emptyDeckCardDimensions.width + scale(10)}
              snapToAlignment="start"
            >
              {[...Array(4)].map((_, i) => (
                <DeckSkeleton key={i} progressMode={isInProgressSection} />
              ))}
            </ScrollView>
          )
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
              activeOpacity={0.6}
              style={[
                styles.emptyDeckCard,
                {
                  width: emptyDeckCardDimensions.width,
                  height: emptyDeckCardDimensions.height,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', // Çok hafif transparan arka plan
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                }
              ]}
            >
              <View style={styles.emptyDeckCardContent}>
                <View style={[
                  styles.emptyDeckPlusContainer,
                  {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)', // Border yerine hafif bir dolgu
                  }
                ]}>
                  <Iconify
                    icon="ic:round-plus"
                    size={moderateScale(40)}
                    // İkon rengini temanın ana rengi (primary) yaparsan çok daha "tıklamaya davetkar" durur. 
                    // Şimdilik senin gri tonunu biraz daha canlandırarak bıraktım:
                    color={isDarkMode ? 'rgba(200, 200, 200, 0.8)' : 'rgba(100, 100, 100, 0.8)'}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            horizontal={!isCommunityDecksSection}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.decksContainer, { paddingLeft: isInProgressSection ? 0 : 10, paddingRight: isInProgressSection ? 0 : 0 }]}
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

              const isFav = favoriteDecks.some(
                (fav) => (fav.id || fav.deck_id || fav) === deck.id
              );

              return isCommunityDecksSection ? (
                <CommunityDeckCard
                  key={`community-deck-${deck.id}`}
                  deck={modifiedDeck}
                  colors={colors}
                  typography={typography}
                  onPress={handleDeckPress}
                  isFavorite={isFav}
                  onToggleFavorite={() => handleToggleFavorite(deck.id)}
                />
              ) : (
                <DeckCard
                  key={`deck-${deck.id}`}
                  deck={modifiedDeck}
                  colors={colors}
                  typography={typography}
                  variant={category === 'inProgressDecks' ? 'inProgress' : 'default'}
                  onPress={handleDeckPress}
                  isFavorite={isFav}
                  onToggleFavorite={() => handleToggleFavorite(deck.id)}
                />
              );
            })}
            {showEndIcon && (
              <View style={[styles.endIconContainer, { height: emptyDeckCardDimensions.height }]}>
                <View
                  style={[
                    styles.endIconPill,
                    {
                      borderColor: isDarkMode ? 'rgba(249, 138, 33, 0.5)' : 'rgba(249, 138, 33, 0.35)',
                      backgroundColor: isDarkMode ? 'rgba(249, 138, 33, 0.08)' : 'rgba(249, 138, 33, 0.05)',
                    },
                  ]}
                >
                  <Iconify icon="material-symbols:arrow-forward-ios-rounded" size={moderateScale(30)} color="#F98A21" style={{ marginLeft: scale(2), marginTop: moderateScale(1) }} />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SectionWrapper>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.content, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + verticalScale(120) }}
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
        {renderHeroHeader()}
        {Object.keys(DECK_CATEGORIES).map((category, index) => (
          <React.Fragment key={`category-${category}`}>
            {renderDeckSection(category)}
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: '35%',
  },
  sectionHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(8),
  },
  hairlineBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 99
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12
  },
  sectionTitleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  decksContainer: {
    paddingBottom: verticalScale(8),
  },
  inProgressMetaText: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    opacity: 0.9,
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
  endIconPill: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(21),
    borderWidth: 1,
  },
  glassCard: {
    borderRadius: moderateScale(40),
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(10),
    minHeight: verticalScale(180),
    overflow: 'hidden',
  },
  emptyDeckCard: {
    borderRadius: moderateScale(18),
    marginRight: scale(10),
    marginBottom: verticalScale(8),
    borderWidth: moderateScale(2),
  },
  emptyDeckCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDeckPlusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(32),
    // Kenarlık (borderWidth) yok, sadece arka plan rengi ile ayrışacak
  },
  heroHeaderContainer: {
    width: '100%',
    borderBottomRightRadius: 36,
    borderBottomLeftRadius: 36,
    marginBottom: verticalScale(24)
  },
  heroHeader: {
    width: '100%',
    minHeight: verticalScale(215),
    borderBottomRightRadius: 36,
    borderBottomLeftRadius: 36,
  },

  heroContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(24),
    justifyContent: 'center',
  },

  heroTextContent: {
    maxWidth: 225,
    zIndex: 2,
  },

  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },

  heroTitle: {
    flexShrink: 1,
    marginLeft: 8,
    fontSize: moderateScale(23),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  heroSubtitle: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
  },

  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(16),
    marginLeft: verticalScale(8),
    paddingHorizontal: 16,
    height: verticalScale(40),
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  heroButtonText: {
    marginHorizontal: 7,
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#ff6b35',
  },

  heroIllustration: {
    position: 'absolute',
    right: 8,
    bottom: -verticalScale(40),
    width: moderateScale(180),
    height: moderateScale(180),
    resizeMode: 'contain',
  },
  deckSection: {
    width: '100%',
    marginVertical: 8
  }
}); 