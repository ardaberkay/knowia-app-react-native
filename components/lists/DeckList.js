import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, RefreshControl, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../lib/hapticManager';
import CommunityDeckCard from '../ui/CommunityDeckCard';
import Svg, { Path } from 'react-native-svg';
import { getCategoryColors, getCategoryIcon } from '../../theme/colors';

// Grid deck cards keep a fixed portrait ratio instead of a share of the screen
// height, so they never turn square on short phones or wide on tablets.
// 1.32 matches the original look on the reference phone (≈187×247).
const GRID_PADDING_HORIZONTAL = 12;
const GRID_CARD_GAP = 12;
const GRID_CARD_ASPECT_RATIO = 1.32;
export const useDeckGridCardHeight = () => {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const cardWidth = (width - GRID_PADDING_HORIZONTAL * 2 - GRID_CARD_GAP) / 2;
    return cardWidth * GRID_CARD_ASPECT_RATIO;
  }, [width]);
};

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

// Badge in the card's top-right corner showing what Discover sorts by.
// Returns { icon, value } or null (counts of 0 show no badge).
function getRankingBadge(mode, deck) {
  if (!mode) return null;
  if (mode === true || mode === 'trend') {
    return { icon: 'mdi:fire', value: Math.max(1, Math.round(Number(deck?.popularity_score) || 0)) };
  }
  const count = Number(mode === 'likes' ? deck?.favorite_count : deck?.unique_started_count) || 0;
  if (count <= 0) return null;
  return { icon: mode === 'likes' ? 'solar:heart-bold' : 'fluent:people-community-20-filled', value: count };
}

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

    // showPopularityBadge: true / 'trend' = popularity score, 'likes' =
    // favourite count, 'people' = how many people studied it.
    const badge = getRankingBadge(showPopularityBadge, deck);

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

    const progressChipOverlap = 11;

    const progressFillMinWidth =
      progressPercent > 0 ? 4 : 0;

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
              typography.styles.headline,
              {
                color: colors.headText,
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
            typography.styles.headline,
            {
              color: colors.headText,
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
              width={165}
              height={36}
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
                size={16}
                color="#fff"
                style={{ marginRight: 3 }}
              />

              <Text style={styles.myDecksBadgeText}>
                {deck.card_count || 0}
              </Text>

              <View style={styles.myDecksDivider} />

              <Iconify
                icon="streamline-flex:module-puzzle-2"
                size={16}
                color="#fff"
                style={{ marginRight: 3 }}
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
              size={18}
              color="#fff"
              style={{ marginRight: 3 }}
            />

            <Text
              style={[
                typography.styles.subhead,
                {
                  color: '#fff',
                  fontFamily: fonts.semibold,
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
                size={16}
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
                  marginRight: 4,
                  paddingRight: badge ? 30 : 0,
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
                  size={21}
                  color="#E74C3C"
                />
              </TouchableOpacity>
            )}

          {/* Ranking badge: what the list is sorted by (see BADGE_MODES). */}
          {badge && (
            <View style={styles.popularityBadge}>
              <Iconify
                icon={badge.icon}
                size={14}
                color="#fff"
              />

              <Text style={styles.popularityBadgeText}>
                {badge.value}
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
              size={21}
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
              paddingHorizontal: 12,
            }}
          >
            {deck.to_name ? (
              <>
                {renderDeckText(deck.name)}

                <View
                  style={{
                    width: 60,
                    height: 2,
                    backgroundColor:
                      colors.divider,
                    borderRadius:
                      1,
                    marginVertical:
                      8,
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
  // Optional Animated.event (native driver), e.g. for a collapsing header.
  onScroll,
  onEndReached,
  renderLeadingItem = null,
  // iOS: 'automatic' for a list under a see-through header (SCROLL_EDGE_HEADER).
  contentInsetAdjustmentBehavior = 'never',
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const DECK_CARD_VERTICAL_HEIGHT = useDeckGridCardHeight();

  const categoryIconDimensions =
    useMemo(() => {
      const verticalIconSize = 150;

      const verticalIconLeft = -75;

      return {
        verticalIconSize,
        verticalIconLeft,
      };
    }, []);

  const responsiveSpacing = useMemo(
    () => ({
      cardMargin: 6,
      listPaddingHorizontal: 12,
      listPaddingVertical: 5,
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
          colors, deck.categories?.sort_order
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
      // Optional leading cell (e.g. "create deck" card) occupies the first slot.
      const cells = renderLeadingItem
        ? [{ __leading: true, id: '__leading' }, ...decks.map(prepareDeck)]
        : decks.map(prepareDeck);

      for (
        let i = 0;
        i < cells.length;
        i += 2
      ) {
        builtRows.push({
          type: 'double',
          items: cells.slice(i, i + 2),
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
    renderLeadingItem,
    layoutMode,
    colors,
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
          (deck, idx) => deck.__leading ? (
            <React.Fragment key="__leading">
              {/* Same cardStyle / height / margin rules as DeckCard so the
                  leading cell is pixel-identical in size to deck cards. */}
              {renderLeadingItem({
                height: DECK_CARD_VERTICAL_HEIGHT,
                style: [
                  styles.deckCardVertical,
                  { height: DECK_CARD_VERTICAL_HEIGHT },
                  row.items.length === 1
                    ? undefined
                    : idx === 0
                      ? { marginRight: responsiveSpacing.cardMargin }
                      : { marginLeft: responsiveSpacing.cardMargin },
                ],
              })}
            </React.Fragment>
          ) : (
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
      renderLeadingItem,
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
    // Animated.FlatList behaves like FlatList; it also accepts a native
    // Animated.event as onScroll.
    <Animated.FlatList
      data={rows}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
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
                width: 300,
                height: 300,
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
                    fontSizes.body,
                  marginTop:
                    20,
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
                16,
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
      18,
    overflow: 'hidden',
  },

  deckGradient: {
    flex: 1,
    borderRadius:
      18,
    padding: 16,
    justifyContent: 'center',
  },

  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 2,
  },
  cardCountContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myDecksBadge: {
    width: 165,
    height: 36,
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
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
  },

  myDecksDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: 9,
  },
  chapterCountContainer: {
    marginLeft: 7,
    alignSelf: 'stretch',
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 99,
    gap: 2
  },
  chapterCountText: {
    color: '#fff',
    fontSize: fontSizes.footnote,
    fontFamily: fonts.semibold,
  },
  progressContainer: {
    position: 'absolute',
    bottom:
      16,
    left: 16,
    right: 60,
    zIndex: 10,
  },

  cardCountContainer: {
    position: 'absolute',
    zIndex: 10,

  },

  cardCountTopLeft: {
    top: 0, left: 0, right: 0, alignItems: 'center',
  },

  cardCountBottomLeft: {
    bottom: 12,
    left: 12,
  },

  progressBottomBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius:
      999,
    paddingLeft: 24,
    paddingRight: 6,
    paddingVertical:
      6,
    overflow: 'visible',
  },

  progressBarRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  progressPercentChip: {
    width: 40,
    height: 40,
    borderRadius:
      999,
    backgroundColor: '#F98A21',
    position: 'absolute',
    left: -8,
    top: '50%',
    transform: [
      {
        translateY:
          -20,
      },
    ],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
    borderWidth:
      1.5,
    borderColor:
      'rgba(255, 255, 255, 0.38)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.22,
    shadowRadius:
      4,
    elevation: 3,
  },

  progressPercentChipGradient: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius:
      999,
  },

  progressPercentChipInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    zIndex: 1,
  },

  progressPercentChipNumber: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize:
      fontSizes.body,
    letterSpacing:
      -0.38,
  },

  progressPercentSign: {
    fontSize:
      fontSizes.micro,
    fontFamily: fonts.bold,
    color:
      'rgba(255, 255, 255, 0.92)',
    marginLeft: 0,
    marginBottom:
      2,
  },

  progressBottomTrack: {
    flex: 1,
    minWidth: 0,
    height:
      4,
    borderRadius:
      999,
    backgroundColor:
      'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    marginRight: 2,
  },

  progressBottomFill: {
    height: '100%',
    borderRadius:
      999,
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
      7,
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
      12,
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
    top: 8,
    left: 10,
  },

  deckProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    marginRight: 6,
  },

  deckProfileUsername: {
    fontSize:
      fontSizes.body,
    color: '#BDBDBD',
    fontFamily: fonts.bold,
    width: '95%',
  },

  favoriteButton: {
    position: 'absolute',
    bottom:
      8,
    right: 10,
    zIndex: 10,
    padding:
      8,
    borderRadius: 999,
  },

  deckDeleteButton: {
    position: 'absolute',
    top:
      10,
    right: 10,
    zIndex: 10,
    padding:
      8,
    borderRadius: 999,
  },

  popularityContainer: {
    position: 'absolute',
    bottom:
      12,
    left: 12,
    zIndex: 10,
  },
  popularityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 62,
    height: 28,
    backgroundColor: '#FF6B35',
    borderBottomLeftRadius: 14,
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
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
    marginLeft: 4,
    textAlign: 'center',
  },
  noDecksEmpty: {
    height:
      200,
    borderRadius:
      18,
    justifyContent:
      'center',
    alignItems: 'center',
    marginHorizontal:
      16,
    backgroundColor:
      'transparent',
    flexDirection:
      'column',
    gap:
      10,
    marginTop:
      150,
  },

  communityList: {
    marginTop:
      16,
    marginBottom:
      8,
    marginHorizontal:
      2,
  },
});

export default React.memo(DeckList);