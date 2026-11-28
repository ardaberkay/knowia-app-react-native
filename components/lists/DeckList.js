import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, RefreshControl, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from '../ui/AppImage';
import { Text } from '../ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { triggerHaptic } from '../../lib/hapticManager';
import CommunityDeckCard from '../ui/CommunityDeckCard';
import { getCategoryColors } from '../../theme/colors';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from '../ui/PhosphorIcon';

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

// Progress chip: a soft orange in the bar's own hue while in progress; the
// deep orange + ✓ at 100 %.
const PROGRESS_CHIP_GRADIENT = ['#FFCC70', '#FF7505', '#D74400'];
const PROGRESS_CHIP_SOFT = ['#FFB466', '#FF9A3D', '#F7852A'];

// 1234 → "1,2B" (TR) / "1.2K": the corner badge and the counts pill keep a fixed size.
const compactCount = (value, lang) => {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  const short = (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '');
  return lang?.startsWith('tr') ? `${short.replace('.', ',')}B` : `${short}K`;
};

// Frosted look shared by the counts pill and the ranking circle.
const FROSTED = { backgroundColor: 'rgba(255, 255, 255, 0.22)', borderColor: 'rgba(255, 255, 255, 0.35)' };

// Badge in the card's top-right corner showing what Discover sorts by.
// Returns { icon, value } or null (counts of 0 show no badge).
function getRankingBadge(mode, deck) {
  if (!mode) return null;
  if (mode === true || mode === 'trend') {
    return { icon: ICONS.trending, value: Math.max(1, Math.round(Number(deck?.popularity_score) || 0)) };
  }
  const count = Number(mode === 'likes' ? deck?.favorite_count : deck?.unique_started_count) || 0;
  if (count <= 0) return null;
  return { icon: mode === 'likes' ? ICONS.favorite : ICONS.community, value: count };
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

    const progressChipOverlap = 11;

    const progressFillMinWidth =
      progressPercent > 0 ? 4 : 0;


    useEffect(() => {
      setLocalFavorite(isInitiallyFavorite);
    }, [isInitiallyFavorite]);

    const handleFavoritePress = () => {
      triggerHaptic('medium');

      setLocalFavorite((prev) => !prev);

      onToggleFavorite(deck.id);
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
        // fixed-size pill, top centre: cards | chapters
        return (
          <View style={styles.countsPill}>
            <View style={styles.countsHalf}>
              <PhosphorIcon icon={ICONS.stack} size={14} color="#fff" />
              <Text style={styles.countsText}>{compactCount(deck.card_count, i18n.language)}</Text>
            </View>
            <View style={styles.countsDivider} />
            <View style={styles.countsHalf}>
              <PhosphorIcon icon={ICONS.chapter} size={14} color="#fff" />
              <Text style={styles.countsText}>{compactCount(deck.chapter_count, i18n.language)}</Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.deckCountBadge}>
          <View style={styles.cardCountContent}>
            <PhosphorIcon
              icon={ICONS.stack}
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
            isProgressCompleted &&
            styles.progressPercentChipCompleted,
          ]}
        >
          <LinearGradient
            colors={isProgressCompleted ? PROGRESS_CHIP_GRADIENT : PROGRESS_CHIP_SOFT}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressPercentChipGradient}
          />

          <View
            style={styles.progressPercentChipInner}
          >
            {isProgressCompleted ? (
              <PhosphorIcon
                icon={ICONS.check}
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
            <PhosphorIcon
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
                    ? require('../../assets/images/app_icon.png')
                    : deck.profiles?.image_url
                      ? {
                        uri: deck.profiles
                          .image_url,
                      }
                      : require('../../assets/images/avatar_default.webp')
                }
                style={
                  styles.deckProfileAvatar
                }
              />

              <View
                style={{
                  flex: 1,
                  marginRight: 4,
                  paddingRight: badge ? 40 : 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.deckProfileUsername}
                >
                  {deck.profiles?.username ||
                    'Kullanıcı'}
                </Text>
              </View>
            </View>
          )}

          {/* Ranking badge: fixed 40 circle in the top-right (what the list is
              sorted by: trend / people / likes icon + the number). */}
          {badge && (
            <View style={styles.cornerBadge} pointerEvents="none">
              <PhosphorIcon icon={badge.icon} size={12} color="#fff" />
              <Text style={styles.cornerBadgeText}>{compactCount(badge.value, i18n.language)}</Text>
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
            <PhosphorIcon
              icon={localFavorite ? ICONS.favorite : ICONS.favoriteOff}
              size={20}
              color={
                localFavorite
                  ? '#F98A21'
                  : colors.headText
              }
            />
          </TouchableOpacity>

          {/* Deck name: with a to_name the divider sits exactly in the middle
              (name above it, to_name below), whatever their line counts. */}
          <View style={styles.titleArea}>
            {deck.to_name ? (
              <>
                <View style={styles.titleHalfTop}>{renderDeckText(deck.name)}</View>
                <View style={[styles.titleDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.titleHalfBottom}>{renderDeckText(deck.to_name)}</View>
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
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
  showPopularityBadge = false,
  // 'double': 2-column grid of vertical cards; 'horizontal': wide cards, one per row
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

    // 'horizontal': one wide card per row (community decks)
    decks.forEach((deck) => builtRows.push({ type: 'horizontal', items: [prepareDeck(deck)] }));

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
    ]
  );

  const renderHorizontalRow = useCallback(
    (row) => (
      <View
        style={styles.horizontalRow}
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

        if (row.type === 'horizontal') {
          return renderHorizontalRow(
            row
          );
        }

        return null;
      },
      [
        renderDoubleRow,
        renderHorizontalRow,
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
      keyExtractor={(row, idx) =>
        row?.items?.length ? row.items.map((item) => item.id).join('_') : `row_${idx}`
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
              source={require('../../assets/images/deckbg.webp')}
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
  // own decks: cards | chapters, fixed size, top centre
  countsPill: {
    width: 112,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    ...FROSTED,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countsHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  countsText: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSizes.footnote },
  countsDivider: { width: 1, height: 14, backgroundColor: 'rgba(255, 255, 255, 0.4)' },

  titleArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  titleHalfTop: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  titleHalfBottom: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-start' },
  titleDivider: { width: 60, height: 2, borderRadius: 1, marginVertical: 8 },
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
    top: 8, left: 0, right: 0, alignItems: 'center',
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
    left: 8,
    right: 8,
  },

  deckProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },

  deckProfileUsername: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.semibold,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  favoriteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 44 circle centred on the card's corner arc (radius 18): it spills out of
  // the corner and the card cuts it with a concentric curve
  cornerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    ...FROSTED,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  cornerBadgeText: {
    color: '#fff',
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
    lineHeight: 14,
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

  horizontalRow: {
    marginHorizontal: 4,
  },
});

export default React.memo(DeckList);