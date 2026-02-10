import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { RESPONSIVE_CONSTANTS } from '../../lib/responsiveConstants';

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

export default function MyDecksList({
  decks,
  favoriteDecks,
  onToggleFavorite,
  onDeleteDeck,
  onPressDeck,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // useWindowDimensions hook'u - ekran döndürme desteği
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();
  
  // Responsive deck kart boyutları - useMemo ile optimize edilmiş
  const deckCardDimensions = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    const isSmallScreen = height < RESPONSIVE_CONSTANTS.SMALL_SCREEN_MAX_HEIGHT;
    
    // Vertical card height - referans: verticalScale(240)
    // Dikdörtgen yapı korunmalı (genişlik/yükseklik oranı)
    const baseVerticalHeight = verticalScale(240);
    let verticalHeight;
    if (isSmallPhone) {
      // Küçük telefon: Ekran yüksekliğinin %32'si - direkt yüzde bazlı kullan
      verticalHeight = height * 0.32;
    } else if (isSmallScreen) {
      // Küçük ekran yüksekliği: ekran yüksekliğinin %30'u
      verticalHeight = height * 0.30;
    } else if (isTablet) {
      // Tablet: ekran yüksekliğinin %28'i (artırıldı)
      verticalHeight = height * 0.28;
    } else {
      // Normal telefon: scale() ile referans değer, ama ekran yüksekliğinin %26'sını geçmesin
      const maxHeight = height * 0.26;
      verticalHeight = Math.min(baseVerticalHeight, maxHeight);
    }
    
    // Horizontal card height - referans: verticalScale(180)
    // Dikdörtgen yapı korunmalı
    const baseHorizontalHeight = verticalScale(180);
    let horizontalHeight;
    if (isSmallPhone) {
      // Küçük telefon: Ekran yüksekliğinin %26'sı - direkt yüzde bazlı kullan
      horizontalHeight = height * 0.26;
    } else if (isSmallScreen) {
      // Küçük ekran yüksekliği: ekran yüksekliğinin %24'ü
      horizontalHeight = height * 0.24;
    } else if (isTablet) {
      // Tablet: ekran yüksekliğinin %22'si (artırıldı)
      horizontalHeight = height * 0.22;
    } else {
      // Normal telefon: scale() ile referans değer, ama ekran yüksekliğinin %20'sini geçmesin
      const maxHeight = height * 0.20;
      horizontalHeight = Math.min(baseHorizontalHeight, maxHeight);
    }
    
    return {
      verticalHeight,
      horizontalHeight,
    };
  }, [width, height, isTablet]);
  
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
  
  // Responsive margin ve padding değerleri
  // Küçük telefonlarda boşlukları artırıyoruz (kareye yakın görünümü önlemek için)
  const responsiveSpacing = useMemo(() => {
    const isSmallPhone = width < RESPONSIVE_CONSTANTS.SMALL_PHONE_MAX_WIDTH;
    
    return {
      // Küçük telefonlarda margin'i artırıyoruz (normal telefonla aynı veya biraz daha fazla)
      cardMargin: isSmallPhone ? scale(5) : scale(5),
      // Küçük telefonlarda padding'i artırıyoruz (normal telefonla aynı)
      listPaddingHorizontal: isSmallPhone ? scale(12) : scale(12),
      listPaddingVertical: isSmallPhone ? verticalScale(5) : verticalScale(5),
    };
  }, [width]);

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
        <TouchableOpacity
          key={`${deck.id}_${idx}`}
          activeOpacity={0.93}
          onPress={() => onPressDeck(deck)}
          style={[styles.myDeckCardVertical, { height: DECK_CARD_VERTICAL_HEIGHT }, idx === 0 ? { marginRight: responsiveSpacing.cardMargin } : { marginLeft: responsiveSpacing.cardMargin }]}
        >
          <LinearGradient
            colors={deck.gradientColors}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.myDeckGradient}
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
            <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12) }}>
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={moderateScale(18)} color="#fff" style={{ marginRight: scale(3) }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: moderateScale(16) }]}>{deck.card_count || 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', top: verticalScale(10), right: scale(10), zIndex: 10, backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
              onPress={() => onToggleFavorite(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify
                icon={favoriteDecks.some(d => d.id === deck.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={moderateScale(21)}
                color={favoriteDecks.some(d => d.id === deck.id) ? '#F98A21' : colors.text}
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
            <TouchableOpacity
              style={{ position: 'absolute', bottom: verticalScale(7), right: scale(10), backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
              onPress={() => onDeleteDeck(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify icon="mdi:garbage" size={moderateScale(21)} color="#E74C3C" />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      ))}
      {row.items.length === 1 && (
        <View style={{ flex: 1, marginLeft: responsiveSpacing.cardMargin }} />
      )}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={[styles.myDecksList, { paddingHorizontal: responsiveSpacing.listPaddingHorizontal, paddingVertical: responsiveSpacing.listPaddingVertical }]}>
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={() => onPressDeck(row.item)}
        style={[styles.myDeckCardHorizontal, { height: DECK_CARD_HORIZONTAL_HEIGHT }]}
      >
        <LinearGradient
          colors={row.item.gradientColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.myDeckGradient}
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
          <View style={{ position: 'absolute', bottom: verticalScale(12), left: scale(12) }}>
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
              icon={favoriteDecks.some(d => d.id === row.item.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={moderateScale(22)}
              color={favoriteDecks.some(d => d.id === row.item.id) ? '#F98A21' : colors.text}
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
          <TouchableOpacity
            style={{ position: 'absolute', bottom: verticalScale(8), right: scale(10), backgroundColor: colors.iconBackground, padding: moderateScale(8), borderRadius: 999 }}
            onPress={() => onDeleteDeck(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify icon="mdi:garbage" size={moderateScale(22)} color="#E74C3C" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
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

  return (
    <FlatList
      key={`mydecks-${decks.length}`}
      data={rows}
      keyExtractor={(_, idx) => `row_${idx}`}
      contentContainerStyle={{ paddingBottom: '25%', paddingTop: '25%' }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item: row }) => {
        if (row.type === 'singleVertical') return renderSingleVerticalRow(row);
        if (row.type === 'single' && rows.length === 1) return renderSingleVerticalRow(row);
        if (row.type === 'double') return renderDoubleRow(row);
        return renderSingleRow(row);
      }}
      ListEmptyComponent={renderEmptyComponent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.buttonColor}
          colors={[colors.buttonColor]}
        />
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

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


