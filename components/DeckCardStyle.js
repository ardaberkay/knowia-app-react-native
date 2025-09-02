import React from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';

export default function DeckCard({
  deck,
  colors,
  typography,
  onPress,
  onOpenMenu,
}) {
  return (
    <TouchableOpacity
      key={`deck-${deck.id}`}
      style={styles.deckCardModern}
      onPress={() => onPress(deck)}
      activeOpacity={0.93}
    >
      <LinearGradient
        colors={colors.deckGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.deckCardGradient}
      >
        <View style={styles.deckCardContentModern}>
          <View style={styles.deckProfileRow}>
            <Image
              source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../assets/avatar-default.png')}
              style={styles.deckProfileAvatar}
            />
            <Text style={[typography.styles.body, styles.deckProfileUsername]} numberOfLines={1} ellipsizeMode="tail">
              {deck.profiles?.username || 'Kullanıcı'}
            </Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.deckHeaderModern}>
              {deck.to_name ? (
                <>
                  <Text style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                  <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                  <Text style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                </>
              ) : (
                <Text style={[typography.styles.body, styles.deckTitleModern, { color: colors.headText }]} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
              )}
            </View>
          </View>
          <View style={styles.deckStatsModern}>
            <View style={styles.deckCountBadge}>
              <Iconify icon="ri:stack-fill" size={13} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.body, styles.deckCountBadgeText]}>{deck.card_count || 0}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 8, right: 5, zIndex: 10 }}
          onPress={() => onOpenMenu(deck.id)}
        >
          <Iconify icon="iconamoon:menu-kebab-vertical" size={22} color={colors.orWhite} />
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 0,
    width: 130,
    height: 180,
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 8,
    justifyContent: 'space-between',
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeaderModern: {
    alignItems: 'center',
  },
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F98A21',
    maxWidth: '97%',
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
    gap: 6,
    marginLeft: 3,
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: 120,
  },
  deckProfileAvatar: {
    width: 24,
    height: 24,
    borderRadius: 11,
    marginRight: 6,
  },
  deckProfileUsername: {
    fontSize: 13,
    color: '#888',
    fontWeight: '700',
    maxWidth: '80%',
  },
});


