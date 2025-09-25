import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';

export default function DeckList({
  decks,
  favoriteDecks,
  onToggleFavorite,
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
    <View style={[styles.deckList, styles.deckRow]}>
      {row.items.map((deck, idx) => (
        <TouchableOpacity
          key={`${deck.id}_${idx}`}
          activeOpacity={0.93}
          onPress={() => onPressDeck(deck)}
          style={[styles.deckCardVertical, idx === 0 ? { marginRight: 8 } : { marginLeft: 8 }]}
        >
          <LinearGradient
            colors={colors.deckGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deckGradient}
          >
            <View style={styles.deckProfileRow}>
              <Image
                source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
                style={styles.deckProfileAvatar}
              />
              <Text style={[typography.styles.body, styles.deckProfileUsername]} numberOfLines={1} ellipsizeMode="tail">
                {deck.profiles?.username || 'Kullanıcı'}
              </Text>
            </View>
            <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
              <View style={styles.deckCountBadge}>
                <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 3 }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{deck.card_count || 0}</Text>
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -20 }}>
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
              style={{ position: 'absolute', bottom: 8, right: 12, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999, zIndex: 10 }}
              onPress={() => onToggleFavorite(deck.id)}
              activeOpacity={0.7}
            >
              <Iconify
                icon={favoriteDecks.includes(deck.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={22}
                color={favoriteDecks.includes(deck.id) ? '#F98A21' : colors.text}
              />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSingleRow = (row) => (
    <View style={[styles.deckList, styles.deckRow]}>
      <TouchableOpacity
        key={`${row.item.id}_single`}
        activeOpacity={0.93}
        onPress={() => onPressDeck(row.item)}
        style={styles.deckCardHorizontal}
      >
        <LinearGradient
          colors={colors.deckGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deckGradient}
        >
          <View style={styles.deckProfileRow}>
            <Image
              source={row.item.profiles?.image_url ? { uri: row.item.profiles.image_url } : require('../../assets/avatar-default.png')}
              style={styles.deckProfileAvatar}
            />
            <Text style={[typography.styles.body, styles.deckProfileUsername]} numberOfLines={1} ellipsizeMode="tail">
              {row.item.profiles?.username || 'Kullanıcı'}
            </Text>
          </View>
          <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <View style={styles.deckCountBadge}>
              <Iconify icon="ri:stack-fill" size={18} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 16 }]}>{row.item.card_count || 0}</Text>
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -20 }}>
            {row.item.to_name ? (
              <>
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.name}</Text>
                <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 8 }} />
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.to_name}</Text>
              </>
            ) : (
              <Text style={[typography.styles.body, { color: colors.headText, fontSize: 16, fontWeight: '800', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{row.item.name}</Text>
            )}
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 9, right: 12, backgroundColor: colors.iconBackground, padding: 8, borderRadius: 999, zIndex: 10 }}
            onPress={() => onToggleFavorite(row.item.id)}
            activeOpacity={0.7}
          >
            <Iconify
              icon={favoriteDecks.includes(row.item.id) ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={22}
              color={favoriteDecks.includes(row.item.id) ? '#F98A21' : colors.text}
            />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(_, idx) => `row_${idx}`}
      contentContainerStyle={{ paddingBottom: '10%'}}
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
    />
  );
}

const styles = StyleSheet.create({
  deckList: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  deckRow: {
    flexDirection: 'row',
  },
  deckCardVertical: {
    flex: 1,
    height: 235,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deckCardHorizontal: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
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
    marginRight: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckProfileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  deckProfileUsername: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    flex: 1,
  },
});
