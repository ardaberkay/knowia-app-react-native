import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, TextInput, Image } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CategoryDeckListScreen({ route }) {
  const { title, decks } = route.params;
  const navigation = useNavigation();
  const { colors } = useTheme();

  const [search, setSearch] = useState('');

  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = 16 * 2; // decksContainer padding
  const cardSpacing = 12; // iki kart arası boşluk
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168; // Orijinal oran (genişlik / yükseklik)
  const cardHeight = cardWidth / cardAspectRatio;

  const handleDeckPress = (deck) => {
    navigation.navigate('DeckDetail', { deck });
  };

  // Filtrelenmiş desteler
  const filteredDecks = decks.filter(deck =>
    (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
    (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()))
  );

  const renderItem = ({ item, index }) => {
    const isRightItem = (index + 1) % 2 === 0;
    return (
      <TouchableOpacity
        style={[
          styles.deckCardModern,
          {
            width: cardWidth,
            height: cardHeight,
            marginRight: isRightItem ? 0 : cardSpacing,
          }
        ]}
        onPress={() => handleDeckPress(item)}
        activeOpacity={0.93}
      >
        <LinearGradient
          colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deckCardGradient}
        >
          <View style={styles.deckCardContentModern}>
            <View style={styles.deckProfileRow}>
              <Image
                source={item.profiles?.image_url ? { uri: item.profiles.image_url } : require('../assets/avatar-default.png')}
                style={styles.deckProfileAvatar}
              />
              <Text style={styles.deckProfileUsername} numberOfLines={1} ellipsizeMode="tail">
                {item.profiles?.username || 'Kullanıcı'}
              </Text>
            </View>
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <View style={styles.deckHeaderModern}>
                {item.to_name ? (
                  <>
                    <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    <View style={{ width: 60, height: 2, backgroundColor: '#fff', borderRadius: 1, marginVertical: 10 }} />
                    <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.to_name}</Text>
                  </>
                ) : (
                  <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                )}
              </View>
            </View>
            <View style={styles.deckStatsModern}>
              <View style={styles.deckCountBadge}>
                <Ionicons name="layers" size={16} color="#fff" style={{ marginRight: 3 }} />
                <Text style={styles.deckCountBadgeText}>{item.card_count || 0}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarWrapper}>
          <Ionicons name="search" size={20} color="#B0B0B0" style={styles.searchIcon} />
          <TextInput
            style={styles.searchBar}
            placeholder="Deste ara..."
            placeholderTextColor="#B0B0B0"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      <FlatList
        data={filteredDecks}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={2}
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={styles.decksContainer}
        ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>Henüz deste bulunmuyor</Text>}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  decksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginBottom: 14,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
    borderWidth: 0,
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeaderModern: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
    maxWidth: '100%',
  },
  deckTitleModern: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F98A21',
    lineHeight: 20,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 110,
    alignSelf: 'center',
  },
  deckStatsModern: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    gap: 6,
  },
  deckCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 6,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    borderWidth: 0,
  },
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  deckProfileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 11,
    marginRight: 4,
  },
  deckProfileUsername: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    paddingRight: 40,
  },
}); 