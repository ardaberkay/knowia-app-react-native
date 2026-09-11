import React, { useMemo, useState, useEffect, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  Keyboard,
  Platform,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// --- DECK KARTI ---

const MyDeckCard = React.memo(({
  deck,
  colors,
  cardHeight,
  marginStyle,
  iconDimensions,
  onPress,
  onToggleFavorite,
  onDelete,
  inProgress,
}) => {
  const [localFavorite, setLocalFavorite] = useState(
    deck.is_favorite
  );

  useEffect(() => {
    setLocalFavorite(deck.is_favorite);
  }, [deck.is_favorite]);

  const handleFavoritePress = () => {
    triggerHaptic('medium');

    setLocalFavorite(prev => !prev);

    onToggleFavorite(deck.id);
  };

  const handleDeletePress = () => {
    triggerHaptic('warning');

    onDelete(deck.id);
  };

  const renderDeckText = (text) => {
    if (!text) return null;

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

  return (
    <TouchableOpacity
      activeOpacity={0.93}
      onPress={onPress}
      style={[
        styles.myDeckCard,
        { height: cardHeight },
        marginStyle,
      ]}
    >
      <LinearGradient
        colors={deck.gradientColors}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.myDeckGradient}
      >

        {/* Background Category Icon */}

        <View
          style={[
            styles.backgroundCategoryIcon,
            {
              left: iconDimensions.verticalIconLeft,
            },
          ]}
        >
          <Iconify
            icon={deck.categoryIcon}
            size={iconDimensions.verticalIconSize}
            color="rgba(0, 0, 0, 0.1)"
            style={styles.categoryIconStyle}
          />
        </View>


        {/* Kart Sayısı Rozeti */}

        <View
          style={{
            position: 'absolute',
            bottom: verticalScale(12),
            left: scale(12),
          }}
        >
          <View style={styles.deckCountBadge}>
            <Iconify
              icon="ri:stack-fill"
              size={moderateScale(18)}
              color="#fff"
              style={{
                marginRight: scale(3),
              }}
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


        {/* Favori Butonu */}

        <TouchableOpacity
          style={{
            position: 'absolute',
            top: verticalScale(10),
            right: scale(10),
            zIndex: 10,
            backgroundColor: colors.iconBackground,
            padding: moderateScale(8),
            borderRadius: 999,
          }}
          onPress={handleFavoritePress}
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


        {/* İsim Bölümü */}

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
                  backgroundColor: colors.divider,
                  borderRadius: moderateScale(1),
                  marginVertical: verticalScale(8),
                }}
              />

              {renderDeckText(deck.to_name)}
            </>
          ) : (
            renderDeckText(deck.name)
          )}
        </View>


        {/* Silme Butonu */}

        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: verticalScale(7),
            right: scale(10),
            backgroundColor: colors.iconBackground,
            padding: moderateScale(8),
            borderRadius: 999,
          }}
          onPress={handleDeletePress}
          activeOpacity={0.7}
        >
          <Iconify
            icon="mdi:garbage"
            size={moderateScale(21)}
            color="#E74C3C"
          />
        </TouchableOpacity>

      </LinearGradient>
    </TouchableOpacity>
  );
});


// --- ANA BİLEŞEN ---

const MyDecksList = ({
  decks,
  onToggleFavorite,
  onDeleteDeck = false,
  onPressDeck,
  ListHeaderComponent = false,
  refreshing = false,
  onRefresh,
  onEndReached,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isTablet = getIsTablet();


  // --- KART YÜKSEKLİĞİ ---

  const DECK_CARD_VERTICAL_HEIGHT = useMemo(
    () => (
      isTablet
        ? height * 0.24
        : height * 0.28
    ),
    [height, isTablet]
  );


  // --- KATEGORİ İKON BOYUTLARI ---

  const categoryIconDimensions = useMemo(() => {
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


  // --- RESPONSIVE SPACING ---

  const responsiveSpacing = useMemo(
    () => ({
      cardMargin: scale(5),
      listPaddingHorizontal: scale(12),
      listPaddingVertical: verticalScale(5),
    }),
    []
  );


  // --- HEADER ALTINDAKİ BOŞLUK ---

  const listTopClearance = useMemo(
    () => height * 0.11,
    [height]
  );


  // --- KATEGORİ RENKLERİ ---

  const getCategoryColors = (sortOrder) => {
    if (
      colors.categoryColors &&
      colors.categoryColors[sortOrder]
    ) {
      return colors.categoryColors[sortOrder];
    }

    return ['#6F8EAD', '#3F5E78'];
  };


  // --- KATEGORİ İKONLARI ---

  const getCategoryIcon = (sortOrder) => {
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
      'material-symbols:category'
    );
  };


  // --- 2 KOLONLU SATIRLAR ---

  const rows = useMemo(() => {
    const builtRows = [];

    for (let i = 0; i < decks.length; i += 2) {
      const items = decks
        .slice(i, i + 2)
        .map(deck => ({
          ...deck,
          gradientColors: getCategoryColors(
            deck.categories?.sort_order
          ),
          categoryIcon: getCategoryIcon(
            deck.categories?.sort_order
          ),
        }));

      builtRows.push({
        key: `row_${items.map(item => item.id).join('_')}`,
        items,
      });
    }

    return builtRows;
  }, [decks, colors.categoryColors]);


  // --- SATIR RENDER ---

  const renderRow = (row) => (
    <View
      style={[
        styles.myDeckRow,
        {
          paddingHorizontal:
            responsiveSpacing.listPaddingHorizontal,

          paddingVertical:
            responsiveSpacing.listPaddingVertical,
        },
      ]}
    >
      {row.items.map((deck, idx) => (
        <MyDeckCard
          key={`${deck.id}_${idx}`}
          deck={deck}
          colors={colors}
          cardHeight={DECK_CARD_VERTICAL_HEIGHT}
          marginStyle={
            idx === 0
              ? {
                marginRight:
                  responsiveSpacing.cardMargin,
              }
              : {
                marginLeft:
                  responsiveSpacing.cardMargin,
              }
          }
          iconDimensions={categoryIconDimensions}
          onPress={() => onPressDeck(deck)}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDeleteDeck}
        />
      ))}

      {/* Son satırda tek kart varsa ikinci kolon boş kalır */}

      {row.items.length === 1 && (
        <View
          style={{
            flex: 1,
            marginLeft: responsiveSpacing.cardMargin,
          }}
        />
      )}
    </View>
  );


  // --- EMPTY STATE ---

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/deckbg.webp')}
        style={styles.emptyImage}
        resizeMode="contain"
        fadeDuration={0}
      />

      <Text
        style={[
          styles.emptyText,
          {
            color: colors.text,
            opacity: 0.6,
          },
        ]}
      >
        {t('library.createDeck', 'Bir deste oluştur')}
      </Text>
    </View>
  );


  // --- FLATLIST ITEM RENDER ---

  const renderListItem = useCallback(
    ({ item: row }) => renderRow(row),
    [
      colors,
      DECK_CARD_VERTICAL_HEIGHT,
      categoryIconDimensions,
      onPressDeck,
      onToggleFavorite,
      onDeleteDeck,
      responsiveSpacing,
    ]
  );


  // --- HEADER ---

  const listHeader =
    ListHeaderComponent == null
      ? null
      : React.isValidElement(ListHeaderComponent)
        ? ListHeaderComponent
        : <ListHeaderComponent />;


  // --- ALT BOŞLUK ---

  const listBottomPadding =
    Platform.OS === 'android'
      ? insets.bottom + verticalScale(120)
      : '35%';


  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: listTopClearance,
        },
      ]}
    >

      {listHeader}

      <FlatList
        style={styles.decksFlatList}

        data={rows}

        keyExtractor={(row, idx) =>
          row?.key || `row_${idx}`
        }

        contentContainerStyle={[
          styles.decksListContent,
          {
            paddingBottom: listBottomPadding,
          },
        ]}

        renderItem={renderListItem}

        ListEmptyComponent={renderEmptyComponent}

        showsVerticalScrollIndicator={false}

        removeClippedSubviews={true}

        initialNumToRender={6}

        maxToRenderPerBatch={4}

        windowSize={5}

        keyboardDismissMode="on-drag"

        keyboardShouldPersistTaps="handled"

        onScrollBeginDrag={() => Keyboard.dismiss()}

        onEndReached={onEndReached}

        onEndReachedThreshold={
          onEndReached ? 0.5 : undefined
        }

        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.buttonColor}
              colors={[colors.buttonColor]}
            />
          ) : undefined
        }
      />

    </View>
  );
};


// --- STYLES ---

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  decksFlatList: {
    flex: 1,
  },

  decksListContent: {
    flexGrow: 1,
    paddingTop: verticalScale(4),
  },

  myDeckRow: {
    flexDirection: 'row',
  },

  myDeckCard: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },

  myDeckGradient: {
    flex: 1,
    borderRadius: moderateScale(18),
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
    marginRight: scale(8),
  },

  emptyContainer: {
    height: verticalScale(300),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(16),
    backgroundColor: 'transparent',
  },

  emptyImage: {
    position: 'absolute',
    alignSelf: 'center',
    width: scale(300),
    height: verticalScale(300),
    opacity: 0.2,
    top: 0,
  },

  emptyText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(280),
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

});

export default React.memo(MyDecksList);