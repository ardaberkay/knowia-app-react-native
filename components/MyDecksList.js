import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { useTranslation } from 'react-i18next';

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
        builtRows.push({ type: 'double', items: [first, second].filter(Boolean) });
        i += 2;
        if (!wouldLeaveOne) {
          builtRows.push({ type: 'single', item: decks[i] });
          i += 1;
        }
        continue;
      }

      if (remaining === 2) {
        const first = decks[i];
        const second = decks[i + 1];
        builtRows.push({ type: 'double', items: [first, second].filter(Boolean) });
        i += 2;
        continue;
      }

      builtRows.push({ type: 'double', items: [decks[i]].filter(Boolean) });
      i += 1;
    }

    return builtRows;
  }, [decks]);

  const renderDoubleRow = (row) => (
    <View style={[styles.myDecksList, styles.myDeckRow]}>
      {row.items.map((deck, idx) => (
        <TouchableOpacity
          key={`${deck.id}_${idx}`}
          activeOpacity={0.93}
          onPress={() => onPressDeck(deck)}
          style={[styles.myDeckCardVertical, idx === 0 ? { marginRight: 8 } : { marginLeft: 8 }]}
        >
          <LinearGradient
            colors={colors.deckGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.myDeckGradient}
          >
            <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 3 }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{deck.card_count || 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
              onPress={() => onToggleFavorite(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify
                icon={favoriteDecks.some(d => d.id === deck.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={24}
                color={favoriteDecks.some(d => d.id === deck.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {deck.to_name ? (
                <>
                  <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                  <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 8 }} />
                  <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                </>
              ) : (
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
              )}
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
              onPress={() => onDeleteDeck(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify icon="mdi:garbage" size={22} color="#E74C3C" />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={styles.myDecksList}>
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={() => onPressDeck(row.item)}
        style={styles.myDeckCardHorizontal}
      >
        <LinearGradient
          colors={colors.deckGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.myDeckGradient}
        >
          <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <View style={styles.deckCountBadge}>
              <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{row.item.card_count || 0}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
            onPress={() => onToggleFavorite(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify
              icon={favoriteDecks.some(d => d.id === row.item.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={24}
              color={favoriteDecks.some(d => d.id === row.item.id) ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {row.item.to_name ? (
              <>
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.name}</Text>
                <View style={{ width: 70, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.to_name}</Text>
              </>
            ) : (
              <Text style={[typography.styles.body, { color: colors.headText, fontSize: 18, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.name}</Text>
            )}
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999 }}
            onPress={() => onDeleteDeck(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify icon="mdi:garbage" size={22} color="#E74C3C" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(_, idx) => `row_${idx}`}
      contentContainerStyle={{ paddingBottom: '25%'}}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item: row }) => (row.type === 'double' ? renderDoubleRow(row) : renderSingleRow(row))}
      ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>{t('library.noDecks', 'Henüz deste bulunmuyor')}</Text>}
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
    paddingHorizontal: 24,
    paddingVertical: 7,
    
  },
  myDeckRow: {
    flexDirection: 'row',
  },
  myDeckCardVertical: {
    flex: 1,
    height: 235,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
  },
  myDeckGradient: {
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
    marginRight: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});


