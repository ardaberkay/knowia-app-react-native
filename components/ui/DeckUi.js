import React, { useRef } from 'react';
import { TouchableOpacity, View, Image, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';

export default function DeckCard({
  deck,
  colors,
  typography,
  onPress,
  onOpenMenu,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        styles.deckCardModern,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        key={`deck-${deck.id}`}
        style={styles.touchableContainer}
        onPress={() => onPress(deck)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
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
              source={deck.profiles?.image_url ? { uri: deck.profiles.image_url } : require('../../assets/avatar-default.png')}
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
              <Iconify icon="ri:stack-fill" size={15} color="#fff" style={{ marginRight: 3 }} />
              <Text style={[typography.styles.body, styles.deckCountBadgeText]}>{deck.card_count || 0}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: colors.iconBackground, padding: 4, borderRadius: 999, zIndex: 10 }}
          onPress={() => onOpenMenu(deck.id)}
        >
          <Iconify icon="iconamoon:menu-kebab-vertical-bold" size={22} color={colors.orWhite} />
        </TouchableOpacity>
      </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 8,
    width: 140,
    height: 196,
  },
  touchableContainer: {
    flex: 1,
    borderRadius: 18,
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
    marginTop: -18,
    left: 2,
    bottom: 0,
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  deckProfileRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    maxWidth: 120,
  },
  deckProfileAvatar: {
    width: 27,
    height: 27,
    borderRadius: 11,
    marginRight: 6,
  },
  deckProfileUsername: {
    fontSize: 14,
    color: '#888',
    fontWeight: '700',
    maxWidth: '80%',
  },
});


