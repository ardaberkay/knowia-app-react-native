import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import {
  scale,
  moderateScale,
  verticalScale,
  useWindowDimensions,
  getIsTablet,
} from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';
import CommunityDeckCard from '../ui/CommunityDeckCard';
import Svg, { Path } from 'react-native-svg';

const getInProgressGradient = (percent) => {
  if (percent >= 75) {
    return ['#FFCC70', '#FF7505', '#D74400'];
  }

  if (percent >= 50) {
    return ['#FFC888', '#FB7A0E', '#E0500A'];
  }

  if (percent >= 25) {
    return ['#FFC2A0', '#F28E2C', '#D45E16'];
  }

  return ['#FFB890', '#EA8F48', '#C66E30'];
};

const DeckCard = React.memo(
  ({
    deck,
    onPress,
    onToggleFavorite,
    isInitiallyFavorite,
    colors,
    variant = 'favorite',
    gradientColors,
    categoryIcon,
    cardStyle,
    height,
    marginStyle,
    iconDimensions,
    showPopularityBadge = false,
    onDeleteDeck,
  }) => {
    const [localFavorite, setLocalFavorite] = useState(
      isInitiallyFavorite
    );

    const progressValue = Math.max(
      0,
      Math.min(
        1,
        Number(deck?.deckProgress?.progress || 0)
      )
    );

    const progressPercent = Math.round(
      progressValue * 100
    );

    const isProgressCompleted =
      progressPercent >= 100;
    const chapterCount = deck.chapter_count || 0;
    const isProgressNearComplete =
      progressPercent >= 75 &&
      progressPercent < 100;

    const progressChipOverlap = scale(11);

    const progressFillMinWidth =
      progressPercent > 0 ? scale(4) : 0;

    const inProgressGradient =
      getInProgressGradient(progressPercent);

    useEffect(() => {
      setLocalFavorite(isInitiallyFavorite);
    }, [isInitiallyFavorite]);

    const handleFavoritePress = () => {
      triggerHaptic('medium');

      setLocalFavorite((prev) => !prev);

      onToggleFavorite(deck.id);
    };

    const handleDeletePress = () => {
      triggerHaptic('medium');

      if (onDeleteDeck) {
        onDeleteDeck(deck.id);
      }
    };

    const renderDeckText = (text) => {
      if (!text) {
        return null;
      }

      const isSingleWord =
        !text.trim().includes(' ');

      if (isSingleWord) {
        return (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              typography.styles.body,
              {
                color: colors.headText,
                fontSize: moderateScale(16),
                fontWeight: '800',
                textAlign: 'center',
              },
            ]}
          >
            {text}
          </Text>
        );
      }

      return (
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          textBreakStrategy="simple"
          style={[
            typography.styles.body,
            {
              color: colors.headText,
              fontSize: moderateScale(16),
              fontWeight: '800',
              textAlign: 'center',
              width: '100%',
            },
          ]}
        >
          {text}
        </Text>
      );
    };

    const renderCardCountBadge = () => {
      if (variant === 'myDecks') {
        return (
          <View style={styles.myDecksBadge}>
            <Svg
              width={scale(165)}
              height={verticalScale(36)}
              viewBox="0 0 165 36"
              style={StyleSheet.absoluteFill}
            >
              <Path
                d="
              M 0 0
              H 165
              C 162 11, 153 23, 140 31
              C 136 34, 131 35, 124 35
              H 41
              C 34 35, 29 34, 25 31
              C 12 23, 3 11, 0 0
              Z
            "
                fill="#FF8D1A"
              />
            </Svg>
            <View style={styles.myDecksBadgeContent}>
              <Iconify
                icon="ri:stack-fill"
                size={moderateScale(16)}
                color="#fff"
                style={{ marginRight: scale(3) }}
              />

              <Text style={styles.myDecksBadgeText}>
                {deck.card_count || 0}
              </Text>

              <View style={styles.myDecksDivider} />

              <Iconify
                icon="streamline-flex:module-puzzle-2"
                size={moderateScale(16)}
                color="#fff"
                style={{ marginRight: scale(3) }}
              />

              <Text style={styles.myDecksBadgeText}>
                {deck.chapter_count || 0}
              </Text>
            </View>
          </View>
        );
      }
      // NORMAL DECKLER — mevcut yapın aynen
      return (
        <View style={styles.deckCountBadge}>
          <View style={styles.cardCountContent}>
            <Iconify
              icon="ri:stack-fill"
              size={moderateScale(18)}
              color="#fff"
              style={{ marginRight: scale(3) }}
            />

            <Text
              style={[
                typography.styles.body,
                {
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: moderateScale(16),
                },
              ]}
            >
              {deck.card_count || 0}
            </Text>
          </View>
        </View>
      );
    };

    const renderProgressBadge = () => (
      <View
        style={[
          styles.deckCountBadge,
          styles.progressBottomBadge,
        ]}
      >
        <View
          style={[
            styles.progressPercentChip,
            isProgressNearComplete &&
            styles.progressPercentChipNearComplete,
            isProgressCompleted &&
            styles.progressPercentChipCompleted,
          ]}
        >
          <LinearGradient
            colors={
              isProgressCompleted
                ? [
                  '#FFCC70',
                  '#FF7505',
                  '#D74400',
                ]
                : inProgressGradient
            }
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={
              styles.progressPercentChipGradient
            }
          />

          <View
            style={styles.progressPercentChipInner}
          >
            {isProgressCompleted ? (
              <Iconify
                icon="streamline:check-solid"
                size={moderateScale(16)}
                color="#FFFFFF"
              />
            ) : (
              <>
                <Text
                  style={
                    styles.progressPercentChipNumber
                  }
                >
                  {progressPercent}
                </Text>

                <Text
                  style={styles.progressPercentSign}
                >
                  %
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.progressBarRow}>
          <View
            style={{
              width: progressChipOverlap,
            }}
          />

          <View
            style={styles.progressBottomTrack}
          >
            <View
              style={[
                styles.progressBottomFill,
                isProgressCompleted &&
                styles.progressBottomFillCompleted,
                {
                  width: `${progressPercent}%`,
                  minWidth: progressFillMinWidth,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
    const showProfile =
      variant === 'inProgress' ||
      variant === 'favorite';

    const showProgress =
      variant === 'inProgress' ||
      variant === 'myDecks';

    const showCardCount =
      variant === 'myDecks' ||
      variant === 'favorite';

    const showDelete =
      variant === 'myDecks';

    const cardCountPositionStyle =
      variant === 'myDecks'
        ? styles.cardCountTopLeft
        : styles.cardCountBottomLeft;

    return (
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={onPress}
        style={[
          cardStyle,
          {
            height,
          },
          marginStyle,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.deckGradient}
        >
          {/* Background Category Icon */}
          <View
            style={[
              styles.backgroundCategoryIcon,
              {
                left:
                  iconDimensions.verticalIconLeft,
              },
            ]}
          >
            <Iconify
              icon={categoryIcon}
              size={
                iconDimensions.verticalIconSize
              }
              color="rgba(0, 0, 0, 0.1)"
              style={styles.categoryIconStyle}
            />
          </View>

          {/* Profile */}
          {showProfile && (
            <View
              style={styles.deckProfileRow}
            >
              <Image
                source={
                  deck.is_admin_created
                    ? require('../../assets/app_icon.png')
                    : deck.profiles?.image_url
                      ? {
                        uri: deck.profiles
                          .image_url,
                      }
                      : require('../../assets/avatar_default.webp')
                }
                style={
                  styles.deckProfileAvatar
                }
              />

              <View
                style={{
                  flex: 1,
                  marginRight: scale(4),
                  paddingRight: showPopularityBadge ? scale(30) : 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    typography.styles.body,
                    styles.deckProfileUsername,
                  ]}
                >
                  {deck.profiles?.username ||
                    'Kullanıcı'}
                </Text>
              </View>
            </View>
          )}

          {/* Delete */}
          {showDelete &&
            onDeleteDeck && (
              <TouchableOpacity
                style={[
                  styles.deckDeleteButton,
                  {
                    backgroundColor:
                      colors.iconBackground,
                  },
                ]}
                onPress={
                  handleDeletePress
                }
                activeOpacity={0.7}
              >
                <Iconify
                  icon="mdi:garbage"
                  size={moderateScale(21)}
                  color="#E74C3C"
                />
              </TouchableOpacity>
            )}

          {/* Popularity */}
          {showPopularityBadge && (
            <View style={styles.popularityBadge}>
              <Iconify
                icon="mdi:fire"
                size={moderateScale(14)}
                color="#fff"
              />

              <Text style={styles.popularityBadgeText}>
                {Math.max(
                  1,
                  Math.round(Number(deck?.popularity_score) || 0)
                )}
              </Text>
            </View>
          )}
          {/* Bottom Left - Progress */}
          {showProgress && (
            <View
              style={
                styles.progressContainer
              }
            >
              {renderProgressBadge()}
            </View>
          )}

          {/* Bottom Left - Card Count */}
          {showCardCount && (
            <View
              style={[
                styles.cardCountContainer,
                cardCountPositionStyle,
              ]}
            >
              {renderCardCountBadge()}
            </View>
          )}

          {/* Favorite */}
          <TouchableOpacity
            style={[
              styles.favoriteButton,
              {
                backgroundColor:
                  colors.iconBackground,
              },
            ]}
            onPress={
              handleFavoritePress
            }
            activeOpacity={0.7}
          >
            <Iconify
              icon={
                localFavorite
                  ? 'solar:heart-bold'
                  : 'solar:heart-broken'
              }
              size={moderateScale(21)}
              color={
                localFavorite
                  ? '#F98A21'
                  : colors.headText
              }
            />
          </TouchableOpacity>

          {/* Deck Name */}
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              paddingHorizontal: scale(12),
            }}
          >
            {deck.to_name ? (
              <>
                {renderDeckText(deck.name)}

                <View
                  style={{
                    width: scale(60),
                    height: moderateScale(2),
                    backgroundColor:
                      colors.divider,
                    borderRadius:
                      moderateScale(1),
                    marginVertical:
                      verticalScale(8),
                  }}
                />

                {renderDeckText(
                  deck.to_name
                )}
              </>
            ) : (
              renderDeckText(deck.name)
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
);

const DeckList = ({
  decks,
  favoriteDecks,
  onToggleFavorite,
  onPressDeck,
  onDeleteDeck,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
  showPopularityBadge = false,
  layoutMode = 'double',
  cardVariant = 'favorite',
  loadingMore = false,
  contentPaddingTop = 0,
  contentPaddingBottom = '10%',
  progressViewOffset = 0,
  onScrollBeginDrag,
  onEndReached,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const isTablet = getIsTablet();

  const deckCardDimensions =
    useMemo(() => {
      const verticalHeight = isTablet
        ? height * 0.24
        : height * 0.27;

      return {
        verticalHeight,
      };
    }, [height, isTablet]);

  const DECK_CARD_VERTICAL_HEIGHT =
    deckCardDimensions.verticalHeight;

  const categoryIconDimensions =
    useMemo(() => {
      const verticalIconSize = isTablet
        ? scale(200)
        : scale(150);

      const verticalIconLeft = isTablet
        ? -verticalIconSize / 2
        : scale(-75);

      return {
        verticalIconSize,
        verticalIconLeft,
      };
    }, [isTablet]);

  const responsiveSpacing = useMemo(
    () => ({
      cardMargin: scale(6),
      listPaddingHorizontal: scale(12),
      listPaddingVertical: verticalScale(5),
    }),
    []
  );

  const isFavorite = useCallback(
    (deck) =>
      deck.is_favorite === true ||
      (Array.isArray(favoriteDecks) &&
        favoriteDecks.includes(deck.id)),
    [favoriteDecks]
  );

  const getCategoryColors = useCallback(
    (sortOrder) => {
      if (
        colors.categoryColors &&
        colors.categoryColors[sortOrder]
      ) {
        return colors.categoryColors[
          sortOrder
        ];
      }

      return ['#6F8EAD', '#3F5E78'];
    },
    [colors]
  );

  const getCategoryIcon = useCallback(
    (sortOrder) => {
      const icons = {
        1: 'hugeicons:language-skill',
        2: 'clarity:atom-solid',
        3: 'mdi:math-compass',
        4: 'game-icons:tied-scroll',
        5: 'arcticons:world-geography-alt',
        6: 'map:museum',
        7: 'ic:outline-self-improvement',
        8: 'streamline-ultimate:module-puzzle-2-bold',
      };

      return (
        icons[sortOrder] ||
        'hugeicons:language-skill'
      );
    },
    []
  );

  const rows = useMemo(() => {
    if (
      !Array.isArray(decks) ||
      decks.length === 0
    ) {
      return [];
    }

    const prepareDeck = (deck) => ({
      ...deck,

      gradientColors:
        getCategoryColors(
          deck.categories?.sort_order
        ),

      categoryIcon:
        getCategoryIcon(
          deck.categories?.sort_order
        ),
    });

    const builtRows = [];

    /*
     * 2 - 2 - 2 - 2...
     */
    if (layoutMode === 'double') {
      for (
        let i = 0;
        i < decks.length;
        i += 2
      ) {
        builtRows.push({
          type: 'double',
          items: decks
            .slice(i, i + 2)
            .map(prepareDeck),
        });
      }

      return builtRows;
    }

    /*
     * 2 - 3 - 2 - 3...
     */
    const pattern = [2, 3];

    let currentIndex = 0;
    let patternIndex = 0;

    while (
      currentIndex < decks.length
    ) {
      const rowSize =
        pattern[
        patternIndex %
        pattern.length
        ];

      const rowItems = decks
        .slice(
          currentIndex,
          currentIndex + rowSize
        )
        .map(prepareDeck);

      builtRows.push({
        type:
          rowSize === 2
            ? 'double'
            : 'triple',
        items: rowItems,
      });

      currentIndex += rowSize;
      patternIndex += 1;
    }

    return builtRows;
  }, [
    decks,
    layoutMode,
    getCategoryColors,
    getCategoryIcon,
  ]);

  const renderDoubleRow = useCallback(
    (row) => (
      <View
        style={[
          styles.deckList,
          styles.deckRow,
          {
            paddingHorizontal:
              responsiveSpacing.listPaddingHorizontal,

            paddingVertical:
              responsiveSpacing.listPaddingVertical,
          },
        ]}
      >
        {row.items.map(
          (deck, idx) => (
            <DeckCard
              key={`${deck.id}_${idx}`}
              deck={deck}
              onPress={() =>
                onPressDeck(deck)
              }
              onToggleFavorite={
                onToggleFavorite
              }
              isInitiallyFavorite={
                isFavorite(deck)
              }
              colors={colors}
              variant={cardVariant}
              gradientColors={
                deck.gradientColors
              }
              categoryIcon={
                deck.categoryIcon
              }
              cardStyle={
                styles.deckCardVertical
              }
              height={
                DECK_CARD_VERTICAL_HEIGHT
              }
              marginStyle={
                row.items.length === 1
                  ? undefined
                  : idx === 0
                    ? {
                      marginRight:
                        responsiveSpacing.cardMargin,
                    }
                    : {
                      marginLeft:
                        responsiveSpacing.cardMargin,
                    }
              }
              iconDimensions={
                categoryIconDimensions
              }
              showPopularityBadge={
                showPopularityBadge
              }
              onDeleteDeck={
                onDeleteDeck
              }
            />
          )
        )}

        {row.items.length === 1 && (
          <View
            style={{
              flex: 1,
              marginLeft:
                responsiveSpacing.cardMargin,
            }}
          />
        )}
      </View>
    ),
    [
      responsiveSpacing,
      onPressDeck,
      onToggleFavorite,
      isFavorite,
      colors,
      cardVariant,
      DECK_CARD_VERTICAL_HEIGHT,
      categoryIconDimensions,
      showPopularityBadge,
      onDeleteDeck,
    ]
  );

  const renderTripleRow = useCallback(
    (row) => (
      <View
        style={styles.communityList}
      >
        {row.items.map((deck) => (
          <CommunityDeckCard
            key={deck.id}
            deck={deck}
            colors={colors}
            typography={typography}
            onPress={onPressDeck}
            onToggleFavorite={
              onToggleFavorite
            }
            isFavorite={isFavorite(deck)}
          />
        ))}
      </View>
    ),
    [
      colors,
      onPressDeck,
      onToggleFavorite,
      isFavorite,
    ]
  );

  const renderListItem =
    useCallback(
      ({ item: row }) => {
        if (row.type === 'double') {
          return renderDoubleRow(
            row
          );
        }

        if (row.type === 'triple') {
          return renderTripleRow(
            row
          );
        }

        return null;
      },
      [
        renderDoubleRow,
        renderTripleRow,
      ]
    );

  return (
    <FlatList
      data={rows}
      keyExtractor={(_, idx) =>
        `row_${idx}`
      }
      contentContainerStyle={{
        paddingBottom:
          contentPaddingBottom,
        paddingTop:
          contentPaddingTop,
      }}
      ListHeaderComponent={
        ListHeaderComponent
      }
      removeClippedSubviews={true}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      windowSize={5}
      renderItem={renderListItem}
      ListEmptyComponent={
        <View
          style={styles.noDecksEmpty}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image
              source={require('../../assets/deckbg.webp')}
              style={{
                position: 'absolute',
                alignSelf: 'center',
                width: moderateScale(
                  300,
                  0.3
                ),
                height: moderateScale(
                  300,
                  0.3
                ),
                opacity: 0.2,
              }}
              resizeMode="contain"
            />
          </View>

          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={[
                typography.styles.body,
                {
                  color:
                    colors.border,
                  textAlign: 'center',
                  fontSize:
                    moderateScale(16),
                  marginTop:
                    verticalScale(20),
                },
              ]}
            >
              {t(
                'discover.noDecks',
                'Deste Bulunamadı'
              )}
            </Text>
          </View>
        </View>
      }
      showsVerticalScrollIndicator={
        false
      }
      onScrollBeginDrag={
        onScrollBeginDrag
      }
      onEndReached={
        onEndReached
      }
      onEndReachedThreshold={
        onEndReached
          ? 0.5
          : undefined
      }
      ListFooterComponent={
        loadingMore ? (
          <View
            style={{
              paddingVertical:
                verticalScale(16),
              alignItems: 'center',
              justifyContent:
                'center',
            }}
          >
            <ActivityIndicator
              size="small"
              color={
                colors.text
              }
            />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={progressViewOffset}
          tintColor={
            colors.text
          }
          colors={[
            colors.buttonColor,
          ]}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  deckList: {},

  deckRow: {
    flexDirection: 'row',
  },

  deckCardVertical: {
    flex: 1,
    borderRadius:
      moderateScale(18),
    overflow: 'hidden',
  },

  deckGradient: {
    flex: 1,
    borderRadius:
      moderateScale(18),
    padding: scale(16),
    justifyContent: 'center',
  },

  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    marginRight: scale(2),
  },
  cardCountContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myDecksBadge: {
    width: scale(165),
    height: verticalScale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },

  myDecksBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  myDecksBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(15),
  },

  myDecksDivider: {
    width: 1,
    height: verticalScale(20),
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: scale(9),
  },
  chapterCountContainer: {
    marginLeft: scale(7),
    alignSelf: 'stretch',
    paddingHorizontal: scale(7),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: scale(99),
    gap: scale(2)
  },
  chapterCountText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    bottom:
      verticalScale(16),
    left: scale(16),
    right: scale(60),
    zIndex: 10,
  },

  cardCountContainer: {
    position: 'absolute',
    zIndex: 10,

  },

  cardCountTopLeft: {
    top: verticalScale(0), left: 0, right: 0, alignItems: 'center',
  },

  cardCountBottomLeft: {
    bottom: verticalScale(12),
    left: scale(12),
  },

  progressBottomBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius:
      moderateScale(999),
    paddingLeft: scale(24),
    paddingRight: scale(6),
    paddingVertical:
      verticalScale(6),
    overflow: 'visible',
  },

  progressBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  progressPercentChip: {
    width: scale(40),
    height: scale(40),
    borderRadius:
      moderateScale(999),
    backgroundColor: '#F98A21',
    position: 'absolute',
    left: scale(-8),
    top: '50%',
    transform: [
      {
        translateY:
          -scale(20),
      },
    ],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
    borderWidth:
      moderateScale(1.5),
    borderColor:
      'rgba(255, 255, 255, 0.38)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: verticalScale(2),
    },
    shadowOpacity: 0.22,
    shadowRadius:
      moderateScale(4),
    elevation: 3,
  },

  progressPercentChipGradient: {
    position: 'absolute',
    top: -scale(2),
    left: -scale(2),
    right: -scale(2),
    bottom: -scale(2),
    borderRadius:
      moderateScale(999),
  },

  progressPercentChipInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    zIndex: 1,
  },

  progressPercentChipNumber: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize:
      moderateScale(15.5),
    letterSpacing:
      moderateScale(-0.38),
  },

  progressPercentSign: {
    fontSize:
      moderateScale(10.25),
    fontWeight: '700',
    color:
      'rgba(255, 255, 255, 0.92)',
    marginLeft: 0,
    marginBottom:
      verticalScale(2),
  },

  progressBottomTrack: {
    flex: 1,
    minWidth: 0,
    height:
      verticalScale(4),
    borderRadius:
      moderateScale(999),
    backgroundColor:
      'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginRight: scale(2),
  },

  progressBottomFill: {
    height: '100%',
    borderRadius:
      moderateScale(999),
    backgroundColor:
      'rgba(255, 255, 255, 0.95)',
  },

  progressBottomFillCompleted: {
    backgroundColor: '#FFFFFF',
  },

  progressPercentChipNearComplete: {
    shadowColor: '#FB7B0B',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.45,
    shadowRadius:
      moderateScale(7),
    elevation: 4,
    borderColor:
      'rgba(255, 255, 255, 0.45)',
  },

  progressPercentChipCompleted: {
    shadowColor: '#FF7505',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.9,
    shadowRadius:
      moderateScale(12),
    elevation: 7,
    borderColor:
      'rgba(255, 255, 255, 0.6)',
  },

  backgroundCategoryIcon: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 0,
    overflow: 'hidden',
  },

  categoryIconStyle: {
    opacity: 0.8,
  },

  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    top: verticalScale(8),
    left: scale(10),
  },

  deckProfileAvatar: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 99,
    marginRight: scale(6),
  },

  deckProfileUsername: {
    fontSize:
      moderateScale(15),
    color: '#BDBDBD',
    fontWeight: '700',
    width: '95%',
  },

  favoriteButton: {
    position: 'absolute',
    bottom:
      verticalScale(8),
    right: scale(10),
    zIndex: 10,
    padding:
      moderateScale(8),
    borderRadius: 999,
  },

  deckDeleteButton: {
    position: 'absolute',
    top:
      verticalScale(10),
    right: scale(10),
    zIndex: 10,
    padding:
      moderateScale(8),
    borderRadius: 999,
  },

  popularityContainer: {
    position: 'absolute',
    bottom:
      verticalScale(12),
    left: scale(12),
    zIndex: 10,
  },
  popularityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: scale(62),
    height: verticalScale(28),
    backgroundColor: '#FF6B35',
    borderBottomLeftRadius: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },

  popularityBadgeText: {
    color: '#fff',
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginLeft: scale(4),
    textAlign: 'center',
  },
  noDecksEmpty: {
    height:
      verticalScale(200),
    borderRadius:
      moderateScale(18),
    justifyContent:
      'center',
    alignItems: 'center',
    marginHorizontal:
      scale(16),
    backgroundColor:
      'transparent',
    flexDirection:
      'column',
    gap:
      verticalScale(10),
    marginTop:
      verticalScale(150),
  },

  communityList: {
    marginTop:
      verticalScale(16),
    marginBottom:
      verticalScale(8),
    marginHorizontal:
      scale(2),
  },
});

export default React.memo(DeckList);