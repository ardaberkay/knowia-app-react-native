import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';

// Fade efekti - karakter bazlı opacity (MaskedView sorunlarından kaçınır)
const FadeText = ({ text, style, maxChars = 15 }) => {
  if (!text) return null;
  
  const shouldFade = text.length > maxChars;
  
  if (!shouldFade) {
    return <Text style={style} numberOfLines={1}>{text}</Text>;
  }
  
  // Görünür kısım + fade kısmı
  const fadeLength = 4; // Son 4 karakter fade olacak
  const visibleLength = maxChars - fadeLength;
  const visibleText = text.substring(0, visibleLength);
  const fadeText = text.substring(visibleLength, maxChars);
  
  // Fade karakterleri için opacity değerleri
  const opacities = [0.7, 0.5, 0.3, 0.1];
  
  // Style'dan textAlign kontrolü
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

export default function DeckList({
  decks,
  favoriteDecks,
  onToggleFavorite,
  onPressDeck,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
  showPopularityBadge = false,
  loading = false,
  contentPaddingTop = 0,
  onScrollBeginDrag,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  const deckCardDimensions = useMemo(() => {
    const verticalHeight = isTablet ? height * 0.24 : height * 0.28;
    const horizontalHeight = isTablet ? height * 0.20 : height * 0.23;
    
    return { verticalHeight, horizontalHeight };
  }, [height, isTablet]);
  
  const DECK_CARD_VERTICAL_HEIGHT = deckCardDimensions.verticalHeight;
  const DECK_CARD_HORIZONTAL_HEIGHT = deckCardDimensions.horizontalHeight;
  
  // Tablet için kategori icon boyutları ve left değerleri - useMemo ile optimize edilmiş
  const categoryIconDimensions = useMemo(() => {
    // Vertical cards için: icon boyutu ve left değeri
    const verticalIconSize = isTablet ? scale(200) : scale(150);
    const verticalIconLeft = isTablet ? -verticalIconSize / 2 : scale(-75);
    
    // Horizontal row için: icon boyutu ve left değeri
    const horizontalIconSize = isTablet ? scale(180) : scale(140);
    // Tekli yatay kartlarda iconun yarısı görünecek şekilde sola sabitle
    const horizontalIconLeft = -horizontalIconSize / 2;
    
    return {
      verticalIconSize,
      verticalIconLeft,
      horizontalIconSize,
      horizontalIconLeft,
    };
  }, [isTablet]);
  
  const isFavorite = (deck) =>
    deck.is_favorite === true || (Array.isArray(favoriteDecks) && favoriteDecks.includes(deck.id));

  const responsiveSpacing = useMemo(() => ({
    cardMargin: scale(5),
    listPaddingHorizontal: scale(12),
    listPaddingVertical: verticalScale(5),
  }), []);

  // Kategoriye göre renkleri al (Supabase sort_order kullanarak)
  const getCategoryColors = (sortOrder) => {
    if (colors.categoryColors && colors.categoryColors[sortOrder]) {
      return colors.categoryColors[sortOrder];
    }
    // Varsayılan renkler (Tarih kategorisi - sort_order: 4)
    return ['#6F8EAD', '#3F5E78'];
  };

  // Kategori ikonunu sort_order değerine göre al
  const getCategoryIcon = (sortOrder) => {
    const icons = {
      1: "hugeicons:language-skill", // Dil
      2: "clarity:atom-solid", // Bilim
      3: "mdi:math-compass", // Matematik
      4: "game-icons:tied-scroll", // Tarih
      5: "arcticons:world-geography-alt", // Coğrafya
      6: "map:museum", // Sanat ve Kültür
      7: "ic:outline-self-improvement", // Kişisel Gelişim
      8: "streamline-ultimate:module-puzzle-2-bold" // Genel Kültür
    };
    return icons[sortOrder] || "hugeicons:language-skill";
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
    <View style={[styles.deckList, styles.deckRow, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
      {row.items.map((deck, idx) => (
        <TouchableOpacity
          key={`${deck.id}_${idx}`}
          activeOpacity={0.93}
          onPress={() => onPressDeck(deck)}
          style={[styles.deckCardVertical, { height: DECK_CARD_VERTICAL_HEIGHT }, idx === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }]}
        >
          <LinearGradient
            colors={deck.gradientColors}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.deckGradient}
          >
            {/* Background Category Icon */}
            <View style={[styles.backgroundCategoryIcon, { left: categoryIconDimensions.verticalIconLeft }]}>
              <Iconify
                icon={deck.categoryIcon}
                size={categoryIconDimensions.verticalIconSize}
                color="rgba(0, 0, 0, 0.1)"
                style={styles.categoryIconStyle}
              />
            </View>
            {/* Profile Section */}
            <View style={styles.deckProfileRow}>
              <Image
                source={
                  deck.is_admin_created 
                    ? require('../../assets/app-icon.png')
                    : deck.profiles?.image_url 
                      ? { uri: deck.profiles.image_url } 
                      : require('../../assets/avatar-default.png')
                }
                style={styles.deckProfileAvatar}
              />
              <FadeText 
                text={deck.profiles?.username || 'Kullanıcı'} 
                style={[typography.styles.body, styles.deckProfileUsername]}
                maxChars={15}
              />
            </View>
            <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12), flexDirection: 'column', alignItems: 'flex-start' }}>
              {showPopularityBadge && deck.popularity_score && deck.popularity_score > 0 ? (
                <View style={[styles.popularityBadge, { marginBottom: verticalScale(6) }]}>
                  <Iconify icon="mdi:fire" size={moderateScale(14)} color="#fff" style={{ marginRight: scale(4) }} />
                  <Text style={styles.popularityBadgeText}>
                    {Math.round(deck.popularity_score)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={moderateScale(18)} color="#fff" style={{ marginRight: scale(3) }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: moderateScale(16) }]}>{deck.card_count || 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', bottom: verticalScale(8), right: scale(10), zIndex: 10, backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
              onPress={() => onToggleFavorite(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify
                icon={isFavorite(deck) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(21)}
                color={isFavorite(deck) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {deck.to_name ? (
                <>
                  <FadeText 
                    text={deck.name} 
                    style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(16), fontWeight: '800', textAlign: 'center' }]}
                    maxChars={16}
                  />
                  <View style={{ width: scale(60), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: verticalScale(8) }} />
                  <FadeText 
                    text={deck.to_name} 
                    style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(16), fontWeight: '800', textAlign: 'center' }]}
                    maxChars={16}
                  />
                </>
              ) : (
                <FadeText 
                  text={deck.name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(16), fontWeight: '800', textAlign: 'center' }]}
                  maxChars={16}
                />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
      {row.items.length === 1 && (
        <View style={{ flex: 1, marginLeft: responsiveSpacing.cardMargin }} />
      )}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={[styles.deckList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={() => onPressDeck(row.item)}
        style={[styles.deckCardHorizontal, { height: DECK_CARD_HORIZONTAL_HEIGHT }]}
      >
        <LinearGradient
          colors={row.item.gradientColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.deckGradient}
        >
          {/* Background Category Icon */}
          <View style={[styles.backgroundCategoryIcon, { left: categoryIconDimensions.horizontalIconLeft, top: verticalScale(1) }]}>
            <Iconify
              icon={row.item.categoryIcon}
              size={categoryIconDimensions.horizontalIconSize}
              color="rgba(0, 0, 0, 0.1)"
              style={styles.categoryIconStyle}
            />
          </View>
          {/* Profile Section */}
          <View style={[styles.deckProfileRow, { top: 'auto', bottom: verticalScale(8) }]}>
            <Image
              source={
                row.item.is_admin_created 
                  ? require('../../assets/app-icon.png')
                  : row.item.profiles?.image_url 
                    ? { uri: row.item.profiles.image_url } 
                    : require('../../assets/avatar-default.png')
              }
              style={styles.deckProfileAvatar}
            />
            <FadeText 
              text={row.item.profiles?.username || 'Kullanıcı'} 
              style={[typography.styles.body, styles.deckProfileUsername]}
              maxChars={16}
            />
          </View>
          {/* Trend puanı - sol üst */}
          {showPopularityBadge && row.item.popularity_score && row.item.popularity_score > 0 ? (
            <View style={{ position: 'absolute', top: verticalScale(8), left: scale(12), zIndex: 10 }}>
              <View style={styles.popularityBadge}>
                <Iconify icon="mdi:fire" size={moderateScale(14)} color="#fff" style={{ marginRight: scale(4) }} />
                <Text style={styles.popularityBadgeText}>
                  {Math.round(row.item.popularity_score)}
                </Text>
              </View>
            </View>
          ) : null}
          {/* Kart sayısı - sağ alt */}
          <View style={{ position: 'absolute', bottom: verticalScale(10), right: scale(12) }}>
            <View style={styles.deckCountBadge}>
              <Iconify icon="ri:stack-fill" size={moderateScale(18)} color="#fff" style={{ marginRight: scale(4) }} />
              <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: moderateScale(16) }]}>{row.item.card_count || 0}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', top: verticalScale(8), right: scale(10), zIndex: 10, backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
            onPress={() => onToggleFavorite(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify
              icon={isFavorite(row.item) ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={moderateScale(22)}
              color={isFavorite(row.item) ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {row.item.to_name ? (
              <>
                <FadeText 
                  text={row.item.name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(18), fontWeight: '800', textAlign: 'center' }]}
                  maxChars={20}
                />
                <View style={{ width: scale(70), height: moderateScale(2), backgroundColor: colors.divider, borderRadius: moderateScale(1), marginVertical: verticalScale(10) }} />
                <FadeText 
                  text={row.item.to_name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(18), fontWeight: '800', textAlign: 'center' }]}
                  maxChars={20}
                />
              </>
            ) : (
              <FadeText 
                text={row.item.name} 
                style={[typography.styles.body, { color: colors.headText, fontSize: moderateScale(18), fontWeight: '800', textAlign: 'center' }]}
                maxChars={20}
              />
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(_, idx) => `row_${idx}`}
      contentContainerStyle={{ paddingBottom: '10%', paddingTop: contentPaddingTop }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item: row }) => {
        if (row.type === 'singleVertical') return renderSingleVerticalRow(row);
        if (row.type === 'single' && rows.length === 1) return renderSingleVerticalRow(row);
        if (row.type === 'double') return renderDoubleRow(row);
        return renderSingleRow(row);
      }}
      ListEmptyComponent={(
        <View style={styles.noDecksEmpty}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('../../assets/deckbg.png')}
          style={{ position: 'absolute', alignSelf: 'center', width: moderateScale(300, 0.3), height: moderateScale(300, 0.3), opacity: 0.2 }}
          resizeMode="contain"
        />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={[typography.styles.body, { color: colors.border, textAlign: 'center', fontSize: moderateScale(16), marginTop: verticalScale(20) }]}>
          {t('discover.noDecks', 'Deste Bulunamadı')}
        </Text>
        </View>
      </View>
        )
      }
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={onScrollBeginDrag}
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
}

const styles = StyleSheet.create({
  deckList: {
    // paddingHorizontal ve paddingVertical dinamik olarak uygulanacak
  },
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  deckCardHorizontal: {
    borderRadius: moderateScale(18),
    overflow: 'hidden',
  },
  deckGradient: {
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
    marginRight: scale(2),
  },
  emptyText: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: verticalScale(20),
  },
    noDecksEmpty: {
    height: verticalScale(200),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(16),
    backgroundColor: 'transparent',
    flexDirection: 'column',
    gap: verticalScale(10),
    marginTop: verticalScale(150),
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
    fontSize: moderateScale(15),
    color: '#BDBDBD',
    fontWeight: '700',
    width: '95%',
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(2),
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: moderateScale(1),
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(10px)',
  },
  popularityBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: moderateScale(14),
  },
});
