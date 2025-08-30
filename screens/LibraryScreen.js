import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, TextInput, Modal, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { getDecksByCategory } from '../services/DeckService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getFavoriteDecks, getFavoriteCards } from '../services/FavoriteService';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

export default function LibraryScreen() {
  const { colors, isDark } = useTheme();
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
  const [activeDeckMenuId, setActiveDeckMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { t } = useTranslation();

  const screenWidth = Dimensions.get('window').width;
  const horizontalPadding = 16 * 2;
  const cardSpacing = 12;
  const numColumns = 2;
  const cardWidth = (screenWidth - horizontalPadding - cardSpacing) / numColumns;
  const cardAspectRatio = 120 / 168;
  const cardHeight = cardWidth / cardAspectRatio;

  const filterOptions = [
    { key: 'all', label: t('library.all', 'Tümü') },
    { key: 'decks', label: t('library.decks', 'Desteler') },
    { key: 'cards', label: t('library.cards', 'Kartlar') },
  ];

  const DROPDOWN_WIDTH = 140; // Dropdown menü genişliği

  // Segmented Control için tab değerleri
  const tabValues = [t('library.myDecks', 'Destelerim'), t('library.favorites', 'Favorilerim')];

  // Segmented Control değişikliği için handler
  const handleTabChange = (selectedIndex) => {
    const newTab = selectedIndex === 0 ? 'myDecks' : 'favorites';
    setActiveTab(newTab);
  };

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id));
  }, []);

  // Filtreleme ve arama
  let filteredFavorites = [];
  if (favoritesFilter === 'all') {
    filteredFavorites = [
      ...favoriteDecks.map(deck => ({ ...deck, _type: 'deck', created_at: deck.created_at })),
      ...favoriteCards.map(card => ({ ...card, _type: 'card', created_at: card.created_at }))
    ];
    // Favoriye eklenme zamanına göre (yeni en üstte olacak şekilde) sırala
    filteredFavorites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
          colors={colors.deckGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deckCardGradient}
        >
          <View style={{ height: 3, width: '90%', alignSelf: 'center', backgroundColor: colors.buttonColor, borderTopLeftRadius: 18, borderTopRightRadius: 18, marginTop: 8 }} />
                  <View style={styles.deckCardContentModern}>
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <View style={styles.deckHeaderModern}>
              {item.to_name ? (
                <>
                  <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                  <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                  <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.to_name}</Text>
                </>
              ) : (
                <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
              )}
            </View>
          </View>
            <View style={styles.deckStatsModern}>
              <View style={styles.deckCountBadge}>
                <Ionicons name="layers" size={14} color="#fff" style={{ marginRight: 3 }} />
                <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 14 }]}>{item.card_count || 0}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 18, right: 12, zIndex: 10 }}
            onPress={() => setActiveDeckMenuId(item.id)}
          >
            <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.orWhite} />
          </TouchableOpacity>
          {/* Bottom Sheet Modal */}
          <Modal
            visible={activeDeckMenuId === item.id}
            animationType="slide"
            transparent
            onRequestClose={() => setActiveDeckMenuId(null)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'transparent' }}
              activeOpacity={1}
              onPress={() => setActiveDeckMenuId(null)}
            />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
              {/* Düzenle en üstte, sadece kendi destesi ise */}
              {item.user_id === currentUserId && (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => { setActiveDeckMenuId(null); navigation.navigate('DeckEdit', { deck: item }); }}
                >
                  <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.set', 'Desteyi Düzenle')}</Text>
                </TouchableOpacity>
              )}
              {/* Favorilere Ekle/Çıkar herkes için */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={async () => {
                  if (favoriteDecks.some(deck => deck.id === item.id)) {
                    await handleRemoveFavoriteDeck(item.id);
                  } else {
                    await handleAddFavoriteDeck(item.id);
                  }
                  setActiveDeckMenuId(null);
                }}
              >
                <MaterialCommunityIcons
                  name={favoriteDecks.some(deck => deck.id === item.id) ? 'heart' : 'heart-outline'}
                  size={22}
                  color={favoriteDecks.some(deck => deck.id === item.id) ? '#F98A21' : colors.text}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ fontSize: 16, fontWeight: '500', color: favoriteDecks.some(deck => deck.id === item.id) ? '#F98A21' : colors.text }}>
                  {favoriteDecks.some(deck => deck.id === item.id) ? t('library.removeFavorite', 'Favorilerden Çıkar') : t('library.addFavorite', 'Favorilere Ekle')}
                </Text>
              </TouchableOpacity>
              {/* Desteyi Sil sadece kendi destesi ise */}
              {item.user_id === currentUserId && (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => handleDeleteDeck(item.id)}
                >
                  <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>{t('library.deleteDeck', 'Desteyi Sil')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setActiveDeckMenuId(null)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.close', 'Kapat')}</Text>
              </TouchableOpacity>
            </View>
          </Modal>
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
            colors={colors.deckGradient}
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
                <Text style={[typography.styles.body, {color: '#888', fontSize: 16, fontWeight: '700'}]} numberOfLines={1} ellipsizeMode="tail">
                  {(item.profiles && item.profiles.username) || 'Kullanıcı'}
                </Text>
              </View>
              <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <View style={styles.deckHeaderModern}>
                  {item.to_name ? (
                    <>
                      <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                      <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
                      <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.to_name}</Text>
                    </>
                  ) : (
                    <Text style={[typography.styles.body, { color: colors.headText, fontSize: 17, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                  )}
                </View>
              </View>
              <View style={styles.deckStatsModern}>
                <View style={styles.deckCountBadge}>
                  <Ionicons name="layers" size={14} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={[typography.styles.body, { color: '#fff', fontWeight: 'bold', fontSize: 14 }]}>{item.card_count || 0}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 18, right: 12, zIndex: 10 }}
              onPress={() => setActiveDeckMenuId(item.id)}
            >
              <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.orWhite} />
            </TouchableOpacity>
            {/* Bottom Sheet Modal */}
            <Modal
              visible={activeDeckMenuId === item.id}
              animationType="slide"
              transparent
              onRequestClose={() => setActiveDeckMenuId(null)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'transparent' }}
                activeOpacity={1}
                onPress={() => setActiveDeckMenuId(null)}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
                {/* Düzenle en üstte, sadece kendi destesi ise */}
                {item.user_id === currentUserId && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => { setActiveDeckMenuId(null); navigation.navigate('DeckEdit', { deck: item }); }}
                  >
                    <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.set', 'Desteyi Düzenle')}</Text>
                  </TouchableOpacity>
                )}
                {/* Favorilere Ekle/Çıkar herkes için */}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={async () => {
                    if (favoriteDecks.some(deck => deck.id === item.id)) {
                      await handleRemoveFavoriteDeck(item.id);
                    } else {
                      await handleAddFavoriteDeck(item.id);
                    }
                    setActiveDeckMenuId(null);
                  }}
                >
                  <MaterialCommunityIcons
                    name={favoriteDecks.some(deck => deck.id === item.id) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={favoriteDecks.some(deck => deck.id === item.id) ? '#F98A21' : colors.text}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: favoriteDecks.some(deck => deck.id === item.id) ? '#F98A21' : colors.text }}>
                    {favoriteDecks.some(deck => deck.id === item.id) ? t('library.removeFavorite', 'Favorilerden Çıkar') : t('library.addFavorite', 'Favorilere Ekle')}
                  </Text>
                </TouchableOpacity>
                {/* Desteyi Sil sadece kendi destesi ise */}
                {item.user_id === currentUserId && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => handleDeleteDeck(item.id)}
                  >
                    <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>{t('library.deleteDeck', 'Desteyi Sil')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setActiveDeckMenuId(null)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.close', 'Kapat')}</Text>
                </TouchableOpacity>
              </View>
            </Modal>
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
          onPress={() => navigation.navigate('CardDetail', { 
            card: item,
            isOwner: myDecks.some(deck => deck.id === item.deck_id) 
          })}
        >
          <LinearGradient
            colors={colors.deckGradient}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.deckCardGradient}
          >
            {/* Tip rozeti - sol alt */}
            <View style={[styles.typeChip, styles.typeChipBottomLeft]}>
              <MaterialCommunityIcons name="card-text-outline" size={14} color="#fff" />
              <Text style={styles.typeChipText}>{t('library.card', 'Kart')}</Text>
            </View>
            
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={[typography.styles.body, { textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.headText }]} numberOfLines={2}>
                {item.question}
              </Text>
              <View style={{ width: 60, height: 2, backgroundColor: colors.divider, borderRadius: 1, marginVertical: 10 }} />
              <Text style={[typography.styles.body, { textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.headText }]} numberOfLines={2}>{item.answer}</Text>
            </View>
            
            {/* Kebap Menü İkonu */}
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 18, right: 12, zIndex: 10 }}
              onPress={() => setActiveDeckMenuId(item.id + '_card')}
            >
              <MaterialCommunityIcons name="dots-vertical" size={24} color={colors.orWhite} />
            </TouchableOpacity>
            {/* Kart Kebap Menü Modal */}
            <Modal
              visible={activeDeckMenuId === item.id + '_card'}
              animationType="slide"
              transparent
              onRequestClose={() => setActiveDeckMenuId(null)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'transparent' }}
                activeOpacity={1}
                onPress={() => setActiveDeckMenuId(null)}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
                {/* Kartı Düzenle (sadece kendi kartıysa) */}
                {myDecks.some(deck => deck.id === item.deck_id) && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => {
                      setActiveDeckMenuId(null);
                      navigation.navigate('EditCard', { card: item });
                    }}
                  >
                    <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.editCard', 'Kartı Düzenle')}</Text>
                  </TouchableOpacity>
                )}
                {/* Favorilerden Çıkar */}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={async () => {
                    await handleRemoveFavoriteCard(item.id);
                    setActiveDeckMenuId(null);
                  }}
                >
                  <MaterialCommunityIcons
                    name={'heart'}
                    size={22}
                    color={'#F98A21'}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#F98A21' }}>
                    {t('library.removeFavorite', 'Favorilerden Çıkar')}
                  </Text>
                </TouchableOpacity>
                {/* Kartı Sil (sadece kendi kartıysa) */}
                {myDecks.some(deck => deck.id === item.deck_id) && (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => handleDeleteCard(item.id)}
                  >
                    <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>{t('library.deleteCard', 'Kartı Sil')}</Text>
                  </TouchableOpacity>
                )}
                {/* Kapat */}
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setActiveDeckMenuId(null)}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('library.close', 'Kapat')}</Text>
                </TouchableOpacity>
              </View>
            </Modal>
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

  // Favori deste ekleme/çıkarma fonksiyonları
  const handleAddFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').insert({ user_id: user.id, deck_id: deckId });
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };
  const handleRemoveFavoriteDeck = async (deckId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_decks').delete().eq('user_id', user.id).eq('deck_id', deckId);
    const decks = await getFavoriteDecks(user.id);
    setFavoriteDecks(decks || []);
  };

  // Deste silme fonksiyonu
  const handleDeleteDeck = (deckId) => {
    Alert.alert(
      t('library.deleteConfirmation', 'Bu işlemi geri alamazsınız. Emin misiniz?'),
      t('library.deleteConfirm', 'Deste Silinsin mi?'),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('library.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            await supabase.from('decks').delete().eq('id', deckId);
            setMyDecks(prev => prev.filter(deck => deck.id !== deckId));
            setFavoriteDecks(prev => prev.filter(deck => deck.id !== deckId));
            setActiveDeckMenuId(null);
          }
        }
      ]
    );
  };

  // Favori kart ekleme/çıkarma fonksiyonları
  const handleAddFavoriteCard = async (cardId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_cards').insert({ user_id: user.id, card_id: cardId });
    const cards = await getFavoriteCards(user.id);
    setFavoriteCards(cards || []);
  };
  const handleRemoveFavoriteCard = async (cardId) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('favorite_cards').delete().eq('user_id', user.id).eq('card_id', cardId);
    const cards = await getFavoriteCards(user.id);
    setFavoriteCards(cards || []);
  };

  // Kart silme fonksiyonu
  const handleDeleteCard = (cardId) => {
    Alert.alert(
      t('library.deleteCardConfirmation', 'Kart Silinsin mi?'),
      t('library.deleteCardConfirm', 'Bu işlemi geri alamazsınız. Emin misiniz?'),
      [
        { text: t('library.cancel', 'İptal'), style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('cards').delete().eq('id', cardId);
            setFavoriteCards(prev => prev.filter(card => card.id !== cardId));
            setActiveDeckMenuId(null);
          }
        }
      ]
    );
  };

  // Yükleniyor ekranı
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.text} style={{ marginBottom: 16 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {/* Segmented Control Sekmeler */}
      <View style={styles.segmentedControlContainer}>
        <SegmentedControl
          values={tabValues}
          selectedIndex={activeTab === 'myDecks' ? 0 : 1}
          onChange={(event) => {
            handleTabChange(event.nativeEvent.selectedSegmentIndex);
          }}
          style={styles.segmentedControl}
          appearance="light"
          fontStyle={{ fontSize: 16, fontWeight: '600' }}
          activeFontStyle={{ fontSize: 16, fontWeight: '700' }}
          tintColor={colors.libraryTab || '#F98A21'}
          backgroundColor={colors.background}
          activeTextColor={colors.background}
          inactiveTextColor={colors.text || '#666'}
          borderColor={colors.cardBorder}
          enableMoments={false}
        />
      </View>
      {/* Arama ve Filtre Butonu */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarRow}>
          <View style={styles.searchBarWrapperSmall}>
            <Ionicons name="search" size={20} color="#B0B0B0" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarSmall}
              placeholder={t('library.searchPlaceholder', 'Deste/Kart ara...')}
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
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setFilterDropdownVisible(false)} activeOpacity={1}>
          <View
            style={[
              styles.filterDropdownMenu,
              {
                backgroundColor: colors.background,
                position: 'absolute',
                left: Math.max(8, dropdownPos.x + dropdownPos.width - DROPDOWN_WIDTH),
                top: Platform.OS === 'android' ? dropdownPos.y + dropdownPos.height : dropdownPos.y + dropdownPos.height + 4,
                minWidth: DROPDOWN_WIDTH,
                borderWidth: 1,
                borderColor: '#F98A21',
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
                <Text style={[
                  styles.filterDropdownOptionText,
                  favoritesFilter === opt.key && styles.activeFilterDropdownOptionText,
                  { color: favoritesFilter === opt.key ? '#fff' : colors.text }
                ]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Kartlar */}
      {activeTab === 'favorites' ? (
        favoritesLoading ? (
          renderLoading()
        ) : (
          <FlatList
            data={filteredFavorites}
            keyExtractor={(item, idx) => String(item.id) + '_' + item._type}
            renderItem={renderFavoriteItem}
            numColumns={2}
            style={{ backgroundColor: colors.background, flex: 1 }}
            contentContainerStyle={styles.decksContainer}
            ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>{t('library.noFavorites', 'Henüz favori bulunmuyor')}</Text>}
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
        )
      ) : (
        loading ? (
          renderLoading()
        ) : (
          <FlatList
            data={filteredDecks}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDeckItem}
            numColumns={2}
            style={{ backgroundColor: colors.background, flex: 1 }}
            contentContainerStyle={styles.decksContainer}
            ListEmptyComponent={<Text style={[styles.emptyText, typography.styles.caption]}>{t('library.noDecks', 'Henüz deste bulunmuyor')}</Text>}
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
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControlContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  segmentedControl: {
    borderWidth: 1,
    borderColor: '#444444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    height: 44,
    marginHorizontal: '15%',
    borderRadius: 35,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
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
    paddingVertical: 10, // Adjusted to ensure equal spacing
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
    backgroundColor: 'transparent',
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
    justifyContent: 'flex-end',
  },
  deckCardGradient: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  typeChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F98A21',
    zIndex: 10,
  },
  typeChipBottomLeft: {
    left: 16,
    bottom: 16,
  },
  typeChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  
  deckProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 120,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardFieldBox: {
    backgroundColor: '#fffefa',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ffe0c3',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },


}); 