import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Modal, StatusBar, FlatList, TextInput } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { setDeckStarted } from '../services/DeckService';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Alert as RNAlert } from 'react-native';

export default function DeckDetailScreen({ route, navigation }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [isStarted, setIsStarted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLoading, setProgressLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>Deste bilgisi bulunamadı.</Text>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const fetchProgress = async () => {
      setProgressLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: progressData, error } = await supabase
          .from('user_card_progress')
          .select('card_id, status, cards(deck_id)')
          .eq('user_id', user.id)
          .eq('cards.deck_id', deck.id);
        if (error) throw error;
        const learned = (progressData || []).filter(p => p.status === 'learned').length;
        const total = deck.card_count || 0;
        setProgress(total > 0 ? learned / total : 0);
      } catch (e) {
        setProgress(0);
      } finally {
        setProgressLoading(false);
      }
    };
    fetchProgress();
  }, [deck.id]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const { data, error } = await supabase
          .from('cards')
          .select('id, question, answer')
          .eq('deck_id', deck.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCards(data || []);
        setFilteredCards(data || []);
      } catch (e) {
        setCards([]);
        setFilteredCards([]);
      }
    };
    fetchCards();
  }, [deck.id]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredCards(cards);
    } else {
      const s = search.trim().toLowerCase();
      setFilteredCards(
        cards.filter(
          c => (c.question && c.question.toLowerCase().includes(s)) || (c.answer && c.answer.toLowerCase().includes(s))
        )
      );
    }
  }, [search, cards]);

  const handleStart = async () => {
    try {
      await setDeckStarted(deck.id);
      setIsStarted(true);
      navigation.navigate('SwipeDeck', { deck });
    } catch (error) {
      Alert.alert('Hata', 'Deste başlatılamadı.');
    }
  };

  // Favori kontrolü ve ekleme
  const checkFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('favorite_decks')
      .select('id')
      .eq('user_id', user.id)
      .eq('deck_id', deck.id)
      .single();
    setIsFavorite(!!data);
  };

  React.useEffect(() => {
    checkFavorite();
  }, [deck.id]);

  const handleAddFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Önceden favori mi kontrol et
      const { data: existing } = await supabase
        .from('favorite_decks')
        .select('id')
        .eq('user_id', user.id)
        .eq('deck_id', deck.id)
        .single();
      if (existing) {
        // Favoriden çıkar
        await handleRemoveFavorite();
        return;
      }
      const { error } = await supabase
        .from('favorite_decks')
        .insert({ user_id: user.id, deck_id: deck.id });
      if (error) throw error;
      setIsFavorite(true);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  const handleRemoveFavorite = async () => {
    setFavLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('favorite_decks')
        .delete()
        .eq('user_id', user.id)
        .eq('deck_id', deck.id);
      if (error) throw error;
      setIsFavorite(false);
    } catch (e) {
      // Alert kaldırıldı
    } finally {
      setFavLoading(false);
    }
  };

  // Header'a yatay kebab ekle
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ marginRight: 8 }}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.text]);

  // StatusBar kontrolü (modal açıkken uygun şekilde değiştir)
  React.useEffect(() => {
    if (menuVisible) {
      if (Platform.OS === 'android') {
        StatusBar.setBarStyle('light-content');
        StatusBar.setBackgroundColor('rgba(0,0,0,0.25)');
      } else {
        StatusBar.setBarStyle('light-content');
      }
    } else {
      if (Platform.OS === 'android') {
        StatusBar.setBarStyle('dark-content');
        StatusBar.setBackgroundColor('#fff');
      } else {
        StatusBar.setBarStyle('dark-content');
      }
    }
  }, [menuVisible]);

  return (
    <LinearGradient
      colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bgGradient}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredCards}
          keyExtractor={item => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.cardsListContainer, { paddingBottom: 120 }]}
          ListEmptyComponent={<Text style={[typography.styles.caption, { color: colors.muted, marginLeft: 18, marginTop: 12 }]}>Bu destede henüz kart yok.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.cardItemGlass} activeOpacity={0.8} onPress={() => {}}>
              <Text style={[styles.cardQuestion, typography.styles.body]} numberOfLines={3}>{item.question}</Text>
              <View style={styles.cardDivider} />
              <Text style={[styles.cardAnswer, typography.styles.body]} numberOfLines={3}>{item.answer}</Text>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <>
              {/* Başlık kartı da glassmorphism ile */}
              <BlurView intensity={90} tint="light" style={[styles.infoCardGlass, { alignItems: 'center', paddingBottom: 28, marginTop: 12, width: '100%', maxWidth: 440, alignSelf: 'center' }] }>
                <View style={{alignItems: 'center', justifyContent: 'center', width: '100%'}}>
                  <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{deck.name}</Text>
                  {deck.to_name && (
                    <>
                      <Text style={[styles.deckTitleModern, {textAlign: 'center', fontSize: 25, marginVertical: 0, marginBottom: 0, marginTop: 0}]}>⤵</Text>
                      <Text style={styles.deckTitleModern} numberOfLines={1} ellipsizeMode="tail">{deck.to_name}</Text>
                    </>
                  )}
                </View>
                <View style={styles.statsContainerModern}>
                  <View style={styles.statBadgeModern}>
                    <Ionicons name="layers" size={18} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.statBadgeTextModern}>{deck.card_count || 0}</Text>
                  </View>
                </View>
              </BlurView>
              {/* Açıklama Kutusu (Glassmorphism) */}
              {deck.description && (
                <BlurView intensity={90} tint="light" style={[styles.infoCardGlass, { width: '100%', maxWidth: 440, alignSelf: 'center' }]}>
                  <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>Detaylar</Text>
                  <Text style={[styles.deckDescription, typography.styles.body, { color: colors.subtext }]}>{deck.description}</Text>
                </BlurView>
              )}
              {/* İlerleme Kutusu (Glassmorphism) */}
              <BlurView intensity={90} tint="light" style={[styles.infoCardGlass, { width: '100%', maxWidth: 440, alignSelf: 'center' }]}>
                <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>İlerleme</Text>
                <View style={styles.progressContainerModern}>
                  <View style={styles.progressBarModern}>
                    <View style={[styles.progressFillModern, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  {progressLoading ? (
                    <Text style={[styles.progressText, typography.styles.caption, { color: colors.muted }]}>Yükleniyor...</Text>
                  ) : progress === 0 ? (
                    <Text style={[styles.progressText, typography.styles.caption, { color: colors.muted }]}>Henüz çalışılmadı</Text>
                  ) : (
                    <Text style={[styles.progressText, typography.styles.caption, { color: colors.buttonColor }]}>%{Math.round(progress * 100)} Tamamlandı</Text>
                  )}
                </View>
              </BlurView>
              {/* Kartlar Başlığı ve Search Bar */}
              <View style={styles.cardsHeaderModern}>
                <MaterialCommunityIcons name="credit-card-multiple-outline" size={22} color={colors.secondary} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>Kartlar</Text>
              </View>
              <View style={styles.cardsSearchBarRow}>
                <View style={styles.cardsSearchBarWrapperModern}>
                  <Ionicons name="search" size={20} color="#B0B0B0" style={styles.cardsSearchIcon} />
                  <TextInput
                    style={[styles.cardsSearchBarModern, typography.styles.body]}
                    placeholder="Kartlarda ara..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <TouchableOpacity style={[styles.cardsFilterIconButton, { marginLeft: 8 }]} onPress={() => RNAlert.alert('Filtre', 'Filtreleme fonksiyonu burada olacak.') }>
                  <Ionicons name="filter" size={24} color="#F98A21" />
                </TouchableOpacity>
              </View>
              <View style={styles.cardsHeaderDivider} />
            </>
          }
        />
        {/* Sabit alt buton barı */}
        <SafeAreaView style={[styles.fixedButtonBar, { borderTopLeftRadius: 18, borderTopRightRadius: 18, ...Platform.select({ android: { paddingBottom: 18 }, ios: {} }) }] } edges={['bottom']}>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.favButtonModern]}
              onPress={() => RNAlert.alert('Kart Ekle', 'Kart ekleme fonksiyonu burada olacak.')}
            >
              <MaterialCommunityIcons name="cards-outline" size={22} color={colors.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.favButtonTextModern, typography.styles.button, { color: colors.buttonColor }]}>Kart Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.startButtonModern}
              onPress={handleStart}
            >
              <Ionicons name="play" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
              <Text style={[styles.startButtonTextModern, typography.styles.button, { color: colors.buttonText }]}>Başla</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
      {/* Modal Bottom Sheet Menü */}
      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetItem} onPress={() => { setMenuVisible(false); handleAddFavorite(); }}>
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#F98A21' : colors.text}
              style={{ marginRight: 12 }}
            />
            <Text style={[styles.sheetItemText, isFavorite && { color: '#F98A21' }]}>
              {isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={() => { setMenuVisible(false); /* Deste Sil fonksiyonu */ }}>
            <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
            <Text style={[styles.sheetItemText, { color: '#E74C3C' }]}>Desteyi Sil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={() => setMenuVisible(false)}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={styles.sheetItemText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deckTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deckDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  bottomButtonContainer: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#007AFF', // override with theme
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  favButton: {
    flex: 1,
    backgroundColor: '#fff', // override with theme
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  favButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonTextDisabled: {
    // color theme ile override edilecek
  },
  // Modern stiller
  headerCardModern: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  deckTitleModern: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F98A21',

    textAlign: 'center',
  },
  statsContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  statBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statBadgeTextModern: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelModern: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardModern: {
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  progressContainerModern: {
    marginTop: 8,
  },
  progressBarModern: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffe0c3',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillModern: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  bottomButtonContainerModern: {
    padding: 18,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 8,
  },
  favButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 18,
  },
  favButtonActive: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Glassmorphism + Floating Card stilleri
  bgGradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 32,
  },
  floatingCardWrapper: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 18,
  },
  floatingCard: {
    width: '88%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  deckTitleGlass: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  statsRowGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statBadgeGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  statBadgeTextGlass: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabelGlass: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  infoCardGlass: {
    borderRadius: 18,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  progressContainerGlass: {
    marginTop: 8,
  },
  progressBarGlass: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffe0c3',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillGlass: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#F98A21',
  },
  buttonRowGlass: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 8,
  },
  favButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  favButtonActiveGlass: {
    backgroundColor: '#fff8f0',
    borderColor: '#F98A21',
  },
  favButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextGlass: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fixedButtonBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  sheetItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  cardsHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 2,
  },
  cardsHeaderDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 18,
    marginBottom: 8,
    borderRadius: 1,
  },
  cardsSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,

    marginBottom: 10,
  },
  cardsSearchBarWrapperModern: {
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
  cardsSearchIcon: {
    marginRight: 6,
  },
  cardsSearchBarModern: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    borderWidth: 0,
  },
  cardsFilterIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F98A21',
    height: 48,
    aspectRatio: 1,
  },
  cardsListContainer: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  cardItemGlass: {
    width: '100%',
    minHeight: 110,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardQuestion: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#F98A21',
    marginBottom: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#ffe0c3',
    alignSelf: 'stretch',
    marginVertical: 6,
    borderRadius: 1,
  },
  cardAnswer: {
    fontSize: 15,
    color: '#333',
    marginTop: 2,
  },
});