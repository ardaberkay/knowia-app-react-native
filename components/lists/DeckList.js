import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';

// Fade efekti için yardımcı bileşen
const FadeText = ({ text, style, maxWidth, maxChars }) => {
  // Karakter sayısına göre fade gösterimi
  const shouldShowFade = text && text.length > maxChars;
  
  if (!shouldShowFade) {
    return (
      <Text 
        style={[style, { maxWidth }]} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    );
  }
  
  return (
    <MaskedView
      style={[styles.maskedView, { maxWidth }]}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1.15, y: 0 }}
          style={styles.maskGradient}
        />
      }
    >
      <Text 
        style={style} 
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {text}
      </Text>
    </MaskedView>
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
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

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
        type: 'double', 
        items: [{
          ...singleDeck,
          gradientColors: getCategoryColors(singleDeck.categories?.sort_order),
          categoryIcon: getCategoryIcon(singleDeck.categories?.sort_order)
        }].filter(Boolean)
      });
      i += 1;
    }

    return builtRows;
  }, [decks]);


  const renderDoubleRow = (row) => (
    <View style={[styles.deckList, styles.deckRow]}>
      {row.items.map((deck, idx) => (
        <TouchableOpacity
          key={`${deck.id}_${idx}`}
          activeOpacity={0.93}
          onPress={() => onPressDeck(deck)}
          style={[styles.deckCardVertical, idx === 0 ? { marginRight: 5 } : { marginLeft: 5 }]}
        >
          <LinearGradient
            colors={deck.gradientColors}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.deckGradient}
          >
            {/* Background Category Icon */}
            <View style={styles.backgroundCategoryIcon}>
              <Iconify
                icon={deck.categoryIcon}
                size={150}
                color="rgba(0, 0, 0, 0.1)"
                style={styles.categoryIconStyle}
              />
            </View>
            {/* Profile Section */}
            <View style={styles.deckProfileRow}>
              <Image
                source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
                style={styles.deckProfileAvatar}
              />
              <FadeText 
                text={deck.profiles?.username || 'Kullanıcı'} 
                style={[typography.styles.body, styles.deckProfileUsername]} 
                maxWidth={'100%'}
                maxChars={15}
              />
            </View>
            <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center' }}>
              {showPopularityBadge && deck.popularity_score && deck.popularity_score > 0 ? (
                <View style={[styles.popularityBadge, { backgroundColor: 'rgba(255, 255, 255, 0.3)', marginRight: 6 }]}>
                  <Iconify icon="mdi:fire" size={14} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={[styles.popularityBadgeText, { color: '#fff', fontSize: 13 }]}>
                    {Math.round(deck.popularity_score)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 3 }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{deck.card_count || 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 8, right: 10, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
              onPress={() => onToggleFavorite(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify
                icon={favoriteDecks.includes(deck.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={21}
                color={favoriteDecks.includes(deck.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {deck.to_name ? (
                <>
                  <FadeText 
                    text={deck.name} 
                    style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} 
                    maxWidth={'100%'}
                    maxChars={16}
                  />
                  <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 8 }} />
                  <FadeText 
                    text={deck.to_name} 
                    style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} 
                    maxWidth={'100%'}
                    maxChars={16}
                  />
                </>
              ) : (
                <FadeText 
                  text={deck.name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} 
                  maxWidth={'100%'}
                  maxChars={16}
                />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={styles.deckList}>
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={() => onPressDeck(row.item)}
        style={styles.deckCardHorizontal}
      >
        <LinearGradient
          colors={row.item.gradientColors}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.deckGradient}
        >
          {/* Background Category Icon */}
          <View style={[styles.backgroundCategoryIcon, { left: -175, top: 1 }]}>
            <Iconify
              icon={row.item.categoryIcon}
              size={140}
              color="rgba(0, 0, 0, 0.1)"
              style={styles.categoryIconStyle}
            />
          </View>
          {/* Profile Section */}
          <View style={[styles.deckProfileRow, { top: 'auto', bottom: 8 }]}>
            <Image
              source={row.item.profiles?.image_url ? { uri: row.item.profiles.image_url } : require('../../assets/avatar-default.png')}
              style={styles.deckProfileAvatar}
            />
            <FadeText 
              text={row.item.profiles?.username || 'Kullanıcı'} 
              style={[typography.styles.body, styles.deckProfileUsername]} 
              maxWidth={'100%'}
              maxChars={16}
            />
          </View>
          <View style={{ position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center' }}>
            {showPopularityBadge && row.item.popularity_score && row.item.popularity_score > 0 ? (
              <View style={[styles.popularityBadge, { backgroundColor: 'rgba(255, 255, 255, 0.3)', marginRight: 6 }]}>
                <Iconify icon="mdi:fire" size={14} color="#fff" style={{ marginRight: 3 }} />
                <Text style={[styles.popularityBadgeText, { color: '#fff', fontSize: 13 }]}>
                  {Math.round(row.item.popularity_score)}
                </Text>
              </View>
            ) : null}
            <View style={styles.deckCountBadge}>
              <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{row.item.card_count || 0}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', top: 8, right: 10, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
            onPress={() => onToggleFavorite(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify
              icon={favoriteDecks.includes(row.item.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={22}
              color={favoriteDecks.includes(row.item.id) ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {row.item.to_name ? (
              <>
                <FadeText 
                  text={row.item.name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                  maxWidth={'100%'}
                  maxChars={35}
                />
                <View style={{ width: 70, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                <FadeText 
                  text={row.item.to_name} 
                  style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                  maxWidth={'100%'}
                  maxChars={35}
                />
              </>
            ) : (
              <FadeText 
                text={row.item.name} 
                style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} 
                maxWidth={'100%'}
                maxChars={35}
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
      renderItem={({ item: row }) => (row.type === 'double' ? renderDoubleRow(row) : renderSingleRow(row))}
      ListEmptyComponent={
        loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.buttonColor} />
          </View>
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={[styles.emptyText, typography.styles.caption]}>{t('library.noDecks', 'Henüz deste bulunmuyor')}</Text>
          </View>
        )
      }
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
  deckList: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deckGradient: {
    flex: 1,
    borderRadius: 18,
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  backgroundCategoryIcon: {
    position: 'absolute',
    left: -75, // İkonun yarısının taşması için
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // En altta kalması için
    overflow: 'hidden', // Taşan kısmı gizle
  },
  categoryIconStyle: {
    // Subtle background effect için
    opacity: 0.8,
  },
  // Fade efekti için stiller
  maskedView: {
    // flex: 1 kaldırıldı
  },
  maskGradient: {
    flexDirection: 'row',
    height: '100%',
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
    fontSize: 15,
    color: '#BDBDBD',
    fontWeight: '700',
    width: '95%',
  },
  popularityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  popularityBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
