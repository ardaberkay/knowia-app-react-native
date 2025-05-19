import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, TextInput } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { typography } from '../theme/typography';

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
    deck.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item, index }) => {
    const isRightItem = (index + 1) % 2 === 0;
    return (
      <TouchableOpacity
        style={[
          styles.deckCard,
          {
            width: cardWidth,
            height: cardHeight,
            marginRight: isRightItem ? 0 : cardSpacing,
          }
        ]}
        onPress={() => handleDeckPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.deckCardContent}>
          <View style={styles.deckHeader}>
            <Text style={[styles.deckTitle, typography.styles.body]} numberOfLines={2}>
              {item.name}
            </Text>
          </View>
          <View style={styles.deckStats}>
            <Text style={[styles.deckCount, typography.styles.caption]}>
              {item.card_count || 0} Kart
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Deste ara..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
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
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deckCardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deckHeader: {
    marginBottom: 8,
  },
  deckTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  deckStats: {
    marginTop: 'auto',
  },
  deckCount: {
    fontSize: 13,
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
  searchBar: {
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
}); 