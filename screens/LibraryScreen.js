import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, TextInput, Modal, Pressable, Platform, Image, ScrollView, Animated, Easing } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import { typography } from '../theme/typography';
import { getDecksByCategory } from '../services/DeckService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getFavoriteDecks, getFavoriteCards } from '../services/FavoriteService';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function LibraryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('myDecks');
  const [search, setSearch] = useState('');
  const [myDecks, setMyDecks] = useState([]);
  const [favoriteDecks, setFavoriteDecks] = useState([]);
  const [favoriteCards, setFavoriteCards] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesFilter, setFavoritesFilter] = useState('all'); // 'all', 'decks', 'cards'
  const [loading, setLoading] = useState(true);
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const filterIconRef = useRef(null);
  const [favoritesFetched, setFavoritesFetched] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

  const filterOptions = [
    { key: 'all', label: 'Tümü' },
    { key: 'decks', label: 'Desteler' },
    { key: 'cards', label: 'Kartlar' },
  ];

  useEffect(() => {
    const fetchDecks = async () => {
      setLoading(true);
      try {
        const decks = await getDecksByCategory('myDecks');
        setMyDecks(decks || []);
      } catch (e) {
        setMyDecks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    if (activeTab === 'favorites' && !favoritesFetched) {
      const fetchFavorites = async () => {
        setFavoritesLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const decks = await getFavoriteDecks(user.id);
          const cards = await getFavoriteCards(user.id);
          setFavoriteDecks(decks || []);
          setFavoriteCards(cards || []);
          setFavoritesFetched(true);
        } catch (e) {
          setFavoriteDecks([]);
          setFavoriteCards([]);
        } finally {
          setFavoritesLoading(false);
        }
      };
      fetchFavorites();
    }
  }, [activeTab, favoritesFetched]);

  // Filtreleme ve arama
  let filteredFavorites = [];
  if (favoritesFilter === 'all') {
    filteredFavorites = [
      ...favoriteDecks.map(deck => ({ ...deck, _type: 'deck' })),
      ...favoriteCards.map(card => ({ ...card, _type: 'card' }))
    ];
  } else if (favoritesFilter === 'decks') {
    filteredFavorites = favoriteDecks.map(deck => ({ ...deck, _type: 'deck' }));
  } else if (favoritesFilter === 'cards') {
    filteredFavorites = favoriteCards.map(card => ({ ...card, _type: 'card' }));
  }
  filteredFavorites = filteredFavorites.filter(item => {
    if (item._type === 'deck') {
      return item.name?.toLowerCase().includes(search.toLowerCase());
    } else if (item._type === 'card') {
      return (
        item.question?.toLowerCase().includes(search.toLowerCase()) ||
        item.answer?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return false;
  });

  const decks = activeTab === 'myDecks' ? myDecks : favoriteDecks;
  const filteredDecks = decks.filter(deck =>
    (deck.name && deck.name.toLowerCase().includes(search.toLowerCase())) ||
    (deck.to_name && deck.to_name.toLowerCase().includes(search.toLowerCase()))
  );

  // Modern deste kartı render fonksiyonu (hem myDecks hem favori deckler için)
  const renderDeckItem = ({ item, index }) => {
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
        activeOpacity={0.93}
        onPress={() => navigation.navigate('DeckDetail', { deck: item })}
      >
        <LinearGradient
          colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deckCardGradient}
        >
          <View style={styles.deckCardContentModern}>
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <View style={styles.deckHeaderModern}>
                {item.to_name ? (
                  <>
                    <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                    <Text style={[styles.deckTitleModern, {textAlign: 'center', fontSize: 22}]}>⤵</Text>
                    <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.to_name}</Text>
                  </>
                ) : (
                  <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                )}
              </View>
            </View>
            <View style={styles.deckStatsModern}>
              <View style={styles.deckCountBadge}>
                <Ionicons name="layers" size={14} color="#fff" style={{ marginRight: 3 }} />
                <Text style={styles.deckCountBadgeText}>{item.card_count || 0}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Favorilerim sekmesinde kart/deck render
  const renderFavoriteItem = ({ item, index }) => {
    if (item._type === 'deck') {
      // Render exactly like HomeScreen deck card
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
          activeOpacity={0.93}
          onPress={() => navigation.navigate('DeckDetail', { deck: item })}
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
                  source={item.profiles && item.profiles.image_url ? { uri: item.profiles.image_url } : require('../assets/avatar-default.png')}
                  style={styles.deckProfileAvatar}
                />
                <Text style={styles.deckProfileUsername} numberOfLines={1} ellipsizeMode="tail">
                  {(item.profiles && item.profiles.username) || 'Kullanıcı'}
                </Text>
              </View>
              <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <View style={styles.deckHeaderModern}>
                  {item.to_name ? (
                    <>
                      <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                      <Text style={[styles.deckTitleModern, {textAlign: 'center', fontSize: 22}]}>⤵</Text>
                      <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.to_name}</Text>
                    </>
                  ) : (
                    <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                  )}
                </View>
              </View>
              <View style={styles.deckStatsModern}>
                <View style={styles.deckCountBadge}>
                  <Ionicons name="layers" size={14} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={styles.deckCountBadgeText}>{item.card_count || 0}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    } else if (item._type === 'card') {
      const isRightItem = (index + 1) % 2 === 0;
      return (
        <TouchableOpacity
          style={[
            styles.deckCardModern,
            {
              width: cardWidth,
              height: cardHeight,
              marginRight: isRightItem ? 0 : cardSpacing,
              overflow: 'hidden',
            }
          ]}
          activeOpacity={0.93}
          onPress={() => {
            setSelectedCard(item);
            setShowCardModal(true);
          }}
        >
          <LinearGradient
            colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.deckCardGradient}
          >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={[styles.deckTitleModern, typography.styles.body, { textAlign: 'center' }]} numberOfLines={2}>
                {item.question}
              </Text>
              <View style={{ width: 60, height: 2, backgroundColor: '#fff', borderRadius: 1, marginVertical: 10 }} />
              <Text style={{ color: '#F98A21', fontWeight: 'bold', fontSize: 17, textAlign: 'center' }} numberOfLines={2}>{item.answer}</Text>
            </View>
            <View style={{ position: 'absolute', left: 15, bottom: 15, backgroundColor: '#F98A21', borderRadius: 12, width: 40, height: 25, justifyContent: 'center', alignItems: 'center'}}>
              <MaterialCommunityIcons
                name="card-text-outline"
                size={18}
                color="#fff"
                style={{}}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const openDropdown = () => {
    if (filterIconRef.current) {
      filterIconRef.current.measureInWindow((x, y, width, height) => {
        setDropdownPos({ x, y, width, height });
        setFilterDropdownVisible(true);
      });
    } else {
      setFilterDropdownVisible(true);
    }
  };

  // Modal açılış/kapanış animasyonu
  useEffect(() => {
    if (showCardModal) {
      slideAnim.setValue(400); // Başlangıçta aşağıda
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Modal kapanırken animasyonla aşağıya kaydır
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showCardModal]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {/* Sekmeler */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myDecks' && styles.activeTab]}
          onPress={() => setActiveTab('myDecks')}
        >
          <Text style={[styles.tabText, activeTab === 'myDecks' && styles.activeTabText]}>Destlerim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>Favorilerim</Text>
        </TouchableOpacity>
      </View>
      {/* Arama ve Filtre Butonu */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarRow}>
          <View style={styles.searchBarWrapperSmall}>
            <Ionicons name="search" size={20} color="#B0B0B0" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarSmall}
              placeholder="Deste/Kart ara..."
              placeholderTextColor="#B0B0B0"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
          {activeTab === 'favorites' && (
            <View>
              <TouchableOpacity
                ref={filterIconRef}
                style={styles.filterIconButton}
                onPress={openDropdown}
              >
                <Ionicons name="filter" size={26} color="#F98A21" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      {/* Dropdown Modal */}
      <Modal
        visible={filterDropdownVisible}
        transparent
        animationType="none"
        onRequestClose={() => setFilterDropdownVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterDropdownVisible(false)}>
          <View
            style={[
              styles.filterDropdownMenu,
              {
                position: 'absolute',
                left: dropdownPos.x,
                top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + 4,
                // +4 iOS için biraz boşluk bırakır
              },
            ]}
          >
            {filterOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterDropdownOption, favoritesFilter === opt.key && styles.activeFilterDropdownOption]}
                onPress={() => {
                  setFavoritesFilter(opt.key);
                  setFilterDropdownVisible(false);
                }}
              >
                <Text style={[styles.filterDropdownOptionText, favoritesFilter === opt.key && styles.activeFilterDropdownOptionText]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
      {/* Kartlar */}
      {activeTab === 'favorites' ? (
        <FlatList
          data={filteredFavorites}
          keyExtractor={(item, idx) => String(item.id) + '_' + item._type}
          renderItem={renderFavoriteItem}
          numColumns={2}
          style={{ backgroundColor: colors.background, flex: 1 }}
          contentContainerStyle={styles.decksContainer}
          ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>Henüz favori bulunmuyor</Text>}
          showsVerticalScrollIndicator={false}
          refreshing={favoritesLoading}
          onRefresh={async () => {
            setFavoritesLoading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const decks = await getFavoriteDecks(user.id);
              const cards = await getFavoriteCards(user.id);
              setFavoriteDecks(decks || []);
              setFavoriteCards(cards || []);
              setFavoritesFetched(true);
            } catch (e) {
              setFavoriteDecks([]);
              setFavoriteCards([]);
            } finally {
              setFavoritesLoading(false);
            }
          }}
        />
      ) : (
        <FlatList
          data={filteredDecks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDeckItem}
          numColumns={2}
          style={{ backgroundColor: colors.background, flex: 1 }}
          contentContainerStyle={styles.decksContainer}
          ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>Henüz deste bulunmuyor</Text>}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            getDecksByCategory('myDecks').then(decks => {
              setMyDecks(decks || []);
              setLoading(false);
            });
          }}
        />
      )}
      <Modal
        visible={showCardModal && !!selectedCard}
        animationType="none"
        transparent
        onRequestClose={() => setShowCardModal(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setShowCardModal(false)} />
        <Animated.View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingHorizontal: 0,
          paddingBottom: 0,
          minHeight: 260,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 16,
          transform: [{ translateY: slideAnim }],
        }}>
          <View style={{ alignItems: 'center', marginBottom: 0, minHeight: 36, flexDirection: 'row', justifyContent: 'center', paddingTop: 18 }}>
            <View style={{ width: 44, height: 5, backgroundColor: '#eee', borderRadius: 3, marginBottom: 0, alignSelf: 'center' }} />
            <TouchableOpacity onPress={() => setShowCardModal(false)} style={{ position: 'absolute', right: 18, top: 8, padding: 8, zIndex: 10 }}>
              <Ionicons name="close" size={28} color="#F98A21" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 10, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
            {selectedCard?.image && (
              <Image source={{ uri: selectedCard.image }} style={{ width: 140, height: 180, borderRadius: 12, alignSelf: 'center', marginBottom: 18, resizeMode: 'cover', backgroundColor: '#f2f2f2' }} />
            )}
            {/* Soru */}
            <View style={styles.modalFieldBox}>
              <Text style={[styles.modalLabel, { color: colors.buttonColor, ...typography.styles.caption }]}>Soru:</Text>
              <Text style={[styles.modalValue, { color: colors.text, ...typography.styles.body }]}>{selectedCard?.question}</Text>
            </View>
            {/* Cevap */}
            <View style={styles.modalFieldBox}>
              <Text style={[styles.modalLabel, { color: colors.buttonColor, ...typography.styles.caption }]}>Cevap:</Text>
              <Text style={[styles.modalValue, { color: colors.text, ...typography.styles.body }]}>{selectedCard?.answer}</Text>
            </View>
            {/* Örnek */}
            {selectedCard?.example && (
              <View style={styles.modalFieldBox}>
                <Text style={[styles.modalLabel, { color: colors.buttonColor, ...typography.styles.caption }]}>Örnek:</Text>
                <Text style={[styles.modalValue, { color: colors.text, ...typography.styles.body }]}>{selectedCard.example}</Text>
              </View>
            )}
            {/* Not */}
            {selectedCard?.note && (
              <View style={styles.modalFieldBox}>
                <Text style={[styles.modalLabel, { color: colors.buttonColor, ...typography.styles.caption }]}>Not:</Text>
                <Text style={[styles.modalValue, { color: colors.text, ...typography.styles.body }]}>{selectedCard.note}</Text>
              </View>
            )}
            {/* Tarih */}
            {selectedCard?.created_at && (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'center', ...typography.styles.caption }}>
                  Oluşturulma: {new Date(selectedCard.created_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#F98A21',
    backgroundColor: '#fff8f0',
  },
  tabText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#F98A21',
  },
  decksContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deckCardModern: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
    borderWidth: 0,
  },
  deckCardContentModern: {
    flex: 1,
    justifyContent: 'center',
  },
  deckHeaderModern: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  deckTitleModern: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F98A21',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 140,
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
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  deckCountBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarWrapperSmall: {
    flex: 1,
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
  searchBarSmall: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    borderWidth: 0,
  },
  filterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8f0',
    borderRadius: 30,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#F98A21',
  },
  filterDropdownMenu: {
    position: 'absolute',
    left: 0,
    top: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 0,
    minWidth: 120,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  filterDropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  activeFilterDropdownOption: {
    backgroundColor: '#F98A21',
  },
  filterDropdownOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
  },
  activeFilterDropdownOptionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  deckProfileUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F98A21',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalValue: {
    // typography.styles.body ve renk dışarıdan
  },
  modalFieldBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ececec',
  },
}); 