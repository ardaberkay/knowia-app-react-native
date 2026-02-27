import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';

// --- FADE TEXT BİLEŞENİ ---
const FadeText = ({ text, style, maxChars = 15 }) => {
  if (!text) return null;
  
  const shouldFade = text.length > maxChars;
  
  if (!shouldFade) {
    return <Text style={style} numberOfLines={1}>{text}</Text>;
  }
  
  const fadeLength = 4;
  const visibleLength = maxChars - fadeLength;
  const visibleText = text.substring(0, visibleLength);
  const fadeText = text.substring(visibleLength, maxChars);
  
  const opacities = [0.7, 0.5, 0.3, 0.1];
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style || {});
  const isCentered = flatStyle.textAlign === 'center';
  
  return (
    <View style={{ flexDirection: 'row', overflow: 'hidden', justifyContent: isCentered ? 'center' : 'flex-start', alignSelf: isCentered ? 'center' : 'flex-start' }}>
      <Text style={style} numberOfLines={1}>{visibleText}</Text>
      {fadeText.split('').map((char, index) => (
        <Text 
          key={index} 
          style={[style, { opacity: opacities[index] || 0.1 }]}
        >
          {char}
        </Text>
      ))}
    </View>
  );
};

// --- YENİ EKLENEN OPTIMISTIC VE MEMOIZED KART BİLEŞENİ ---
const MyDeckCard = React.memo(({
  deck,
  isVertical,
  colors,
  cardHeight,
  marginStyle,
  iconDimensions,
  onPress,
  onToggleFavorite,
  onDelete
}) => {
  // 1. Optimistic UI için lokal state
  const [localFavorite, setLocalFavorite] = useState(deck.is_favorite);

  // 2. Üstten gelen favori değeri değişirse senkronize et
  useEffect(() => {
    setLocalFavorite(deck.is_favorite);
  }, [deck.is_favorite]);

  // 3. Kalbe tıklandığında anında tepki ver
  const handleFavoritePress = () => {
    triggerHaptic('medium'); 
    setLocalFavorite(!localFavorite); // Anında rengi değiştir
    onToggleFavorite(deck.id); // Arka planda DB işlemini yap
  };

  // Silme butonuna tıklandığında
  const handleDeletePress = () => {
    triggerHaptic('warning');
    onDelete(deck.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.93}
      onPress={onPress}
      style={[isVertical ? styles.myDeckCardVertical : styles.myDeckCardHorizontal, { height: cardHeight }, marginStyle]}
    >
      <LinearGradient
        colors={deck.gradientColors}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.myDeckGradient}
      >
        {/* Background Category Icon */}
        <View style={[styles.backgroundCategoryIcon, { left: isVertical ? iconDimensions.verticalIconLeft : iconDimensions.horizontalIconLeft, top: isVertical ? undefined : verticalScale(1) }]}>
          <Iconify
            icon={deck.categoryIcon}
            size={isVertical ? iconDimensions.verticalIconSize : iconDimensions.horizontalIconSize}
            color="rgba(0, 0, 0, 0.1)"
            style={styles.categoryIconStyle}
          />
        </View>

        {/* Kart Sayısı Rozeti */}
        <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12) }}>
          <View style={styles.deckCountBadge}>
            <Iconify icon="ri:stack-fill" size={moderateScale(18)} color="#fff" style={{ marginRight: scale(3) }} />
            <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: moderateScale(16) }]}>
              {deck.card_count || 0}
            </Text>
          </View>
        </View>

        {/* HIZLANDIRILMIŞ FAVORİ BUTONU */}
        <TouchableOpacity
          style={{ position: 'absolute', top: verticalScale(isVertical ? 10 : 8), right: scale(10), zIndex: 10, backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
          onPress={handleFavoritePress}
          activeOpacity={0.7}
        >
          <Iconify
            icon={localFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
            size={moderateScale(isVertical ? 21 : 22)}
            color={localFavorite ? '#F98A21' : colors.text}
          />
        </TouchableOpacity>

        {/* İsim Bölümü */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {deck.to_name ? (
            <>
              <FadeText 
                text={deck.name} 
                style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(isVertical ? 16 : 18), fontWeight: '800', textAlign: 'center' }]}
                maxChars={isVertical ? 16 : 20}
              />
              <View style={{ width: scale(isVertical ? 60 : 70), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: verticalScale(isVertical ? 8 : 10) }} />
              <FadeText 
                text={deck.to_name} 
                style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(isVertical ? 16 : 18), fontWeight: '800', textAlign: 'center' }]}
                maxChars={isVertical ? 16 : 20}
              />
            </>
          ) : (
            <FadeText 
              text={deck.name} 
              style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(isVertical ? 16 : 18), fontWeight: '800', textAlign: 'center' }]}
              maxChars={isVertical ? 16 : 20}
            />
          )}
        </View>

        {/* SİLME BUTONU */}
        <TouchableOpacity
          style={{ position: 'absolute', bottom: verticalScale(isVertical ? 7 : 8), right: scale(10), backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
          onPress={handleDeletePress}
          activeOpacity={0.7}
        >
          <Iconify icon="mdi:garbage" size={moderateScale(isVertical ? 21 : 22)} color="#E74C3C" />
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// --- ANA BİLEŞEN ---
const MyDecksList = ({
  decks,
  onToggleFavorite,
  onDeleteDeck,
  onPressDeck,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  const deckCardDimensions = useMemo(() => {
    const verticalHeight = isTablet ? height * 0.24 : height * 0.28;
    const horizontalHeight = isTablet ? height * 0.20 : height * 0.23;
    return { verticalHeight, horizontalHeight };
  }, [height, isTablet]);
  
  const DECK_CARD_VERTICAL_HEIGHT = deckCardDimensions.verticalHeight;
  const DECK_CARD_HORIZONTAL_HEIGHT = deckCardDimensions.horizontalHeight;
  
  const categoryIconDimensions = useMemo(() => {
    const verticalIconSize = isTablet ? scale(200) : scale(150);
    const verticalIconLeft = isTablet ? -verticalIconSize / 2 : scale(-75);
    const horizontalIconSize = isTablet ? scale(180) : scale(140);
    const horizontalIconLeft = -horizontalIconSize / 2;
    return { verticalIconSize, verticalIconLeft, horizontalIconSize, horizontalIconLeft };
  }, [isTablet]);
  
  const responsiveSpacing = useMemo(() => ({
    cardMargin: scale(5),
    listPaddingHorizontal: scale(12),
    listPaddingVertical: verticalScale(5),
  }), []);

  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    return ['#6F8EAD', '#3F5E78'];
  };

  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill",
      2: "clarity:atom-solid",
      3: "mdi:math-compass",
      4: "game-icons:tied-scroll",
      5: "arcticons:world-geography-alt",
      6: "map:museum",
      7: "ic:outline-self-improvement",
      8: "streamline-ultimate:module-puzzle-2-bold"
    };
    return icons[sortOrder] || "material-symbols:category";
  };

  const rows = useMemo(() => {
    const builtRows = [];
    let i = 0;
    const total = decks.length;

    while (i < total) {
      const remaining = total - i;

      if (remaining >= 3) {
        const wouldLeaveOne = (total - (i + 3)) === 1;
        const first = decks[i];
        const second = decks[i + 1];
        builtRows.push({ 
          type: 'double', 
          items: [first, second].filter(Boolean).map(deck => ({
            ...deck,
            gradientColors: getCategoryColors(deck.categories?.sort_order),
            categoryIcon: getCategoryIcon(deck.categories?.sort_order)
          }))
        });
        i += 2;
        if (!wouldLeaveOne) {
          const singleDeck = decks[i];
          builtRows.push({ 
            type: 'single', 
            item: {
              ...singleDeck,
              gradientColors: getCategoryColors(singleDeck.categories?.sort_order),
              categoryIcon: getCategoryIcon(singleDeck.categories?.sort_order)
            }
          });
          i += 1;
        }
        continue;
      }

      if (remaining === 2) {
        const first = decks[i];
        const second = decks[i + 1];
        builtRows.push({ 
          type: 'double', 
          items: [first, second].filter(Boolean).map(deck => ({
            ...deck,
            gradientColors: getCategoryColors(deck.categories?.sort_order),
            categoryIcon: getCategoryIcon(deck.categories?.sort_order)
          }))
        });
        i += 2;
        continue;
      }

      const singleDeck = decks[i];
      builtRows.push({ 
        type: 'singleVertical', 
        item: {
          ...singleDeck,
          gradientColors: getCategoryColors(singleDeck.categories?.sort_order),
          categoryIcon: getCategoryIcon(singleDeck.categories?.sort_order)
        }
      });
      i += 1;
    }

    return builtRows;
  }, [decks]);

  const renderSingleVerticalRow = (row) => {
    return renderDoubleRow({ ...row, items: [row.item] });
  };

  const renderDoubleRow = (row) => (
    <View style={[styles.myDecksList, styles.myDeckRow, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
      {row.items.map((deck, idx) => (
        <MyDeckCard
          key={`${deck.id}_${idx}`}
          deck={deck}
          isVertical={true}
          colors={colors}
          cardHeight={DECK_CARD_VERTICAL_HEIGHT}
          marginStyle={idx === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }}
          iconDimensions={categoryIconDimensions}
          onPress={() => onPressDeck(deck)}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDeleteDeck}
        />
      ))}
      {row.items.length === 1 && (
        <View style={{ flex: 1, marginLeft: responsiveSpacing.cardMargin }} />
      )}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={[styles.myDecksList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
      <MyDeckCard
        deck={row.item}
        isVertical={false}
        colors={colors}
        cardHeight={DECK_CARD_HORIZONTAL_HEIGHT}
        marginStyle={{}}
        iconDimensions={categoryIconDimensions}
        onPress={() => onPressDeck(row.item)}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDeleteDeck}
      />
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/deckbg.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={[styles.emptyText, { color: colors.text, opacity: 0.6 }]}>
        {t('library.createDeck', 'Bir deste oluştur')}
      </Text>
    </View>
  );

  // FlatList için optimize edilmiş render fonksiyonu
  const renderListItem = useCallback(({ item: row }) => {
    if (row.type === 'singleVertical') return renderSingleVerticalRow(row);
    if (row.type === 'single' && rows.length === 1) return renderSingleVerticalRow(row);
    if (row.type === 'double') return renderDoubleRow(row);
    return renderSingleRow(row);
  }, [colors, DECK_CARD_VERTICAL_HEIGHT, DECK_CARD_HORIZONTAL_HEIGHT, categoryIconDimensions, onPressDeck, onToggleFavorite, onDeleteDeck, responsiveSpacing]);

  return (
    <FlatList
      key={`mydecks-${decks.length}`}
      data={rows}
      keyExtractor={(_, idx) => `row_${idx}`}
      contentContainerStyle={{ paddingBottom: '25%', paddingTop: '25%' }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={renderListItem}
      ListEmptyComponent={renderEmptyComponent}
      showsVerticalScrollIndicator={false}
      
      // --- PERFORMANS AYARLARI ---
      removeClippedSubviews={true} 
      initialNumToRender={6} 
      maxToRenderPerBatch={4} 
      windowSize={5} 
      
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.buttonColor}
          colors={[colors.buttonColor]}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  myDecksList: {
    // paddingHorizontal ve paddingVertical dinamik olarak uygulanacak
  },
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
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
    // left dinamik olarak uygulanacak (categoryIconDimensions)
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start', // Sola hizala (tablet için iconun yarısı gözüksün)
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
});

export default React.memo(MyDecksList);

