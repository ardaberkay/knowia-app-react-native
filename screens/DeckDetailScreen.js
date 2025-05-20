import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { setDeckStarted } from '../services/DeckService';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function DeckDetailScreen({ route }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [isStarted, setIsStarted] = useState(false);
  const navigation = useNavigation();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>Deste bilgisi bulunamadı.</Text>
      </SafeAreaView>
    );
  }

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
        Alert.alert('Uyarı', 'Bu deste zaten favorilerde!');
        setIsFavorite(true);
        return;
      }
      const { error } = await supabase
        .from('favorite_decks')
        .insert({ user_id: user.id, deck_id: deck.id });
      if (error) throw error;
      setIsFavorite(true);
      Alert.alert('Başarılı', 'Deste favorilere eklendi!');
    } catch (e) {
      Alert.alert('Hata', 'Favorilere eklenirken bir hata oluştu.');
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bgGradient}
    >
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Başlık kartı da glassmorphism ile */}
          <BlurView intensity={90} tint="light" style={[styles.infoCardGlass, { alignItems: 'center', paddingBottom: 28, marginTop: 32 }] }>
            <Text style={styles.deckTitleModern}>{deck.name}</Text>
            <View style={styles.statsContainerModern}>
              <View style={styles.statBadgeModern}>
                <Ionicons name="layers" size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.statBadgeTextModern}>{deck.card_count || 0}</Text>
              </View>
              <Text style={styles.statLabelModern}>Kart</Text>
            </View>
          </BlurView>

          {/* Açıklama Kutusu (Glassmorphism) */}
          {deck.description && (
            <BlurView intensity={90} tint="light" style={styles.infoCardGlass}>
              <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>Detaylar</Text>
              <Text style={[styles.deckDescription, typography.styles.body, { color: colors.subtext }]}>{deck.description}</Text>
            </BlurView>
          )}

          {/* İlerleme Kutusu (Glassmorphism) */}
          <BlurView intensity={90} tint="light" style={styles.infoCardGlass}>
            <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>İlerleme</Text>
            <View style={styles.progressContainerModern}>
              <View style={styles.progressBarModern}>
                <View style={[styles.progressFillModern, { width: '0%' }]} />
              </View>
              <Text style={[styles.progressText, typography.styles.caption, { color: colors.muted }]}>Henüz çalışılmadı</Text>
            </View>
          </BlurView>
        </ScrollView>
        {/* Sabit alt buton barı */}
        <View style={styles.fixedButtonBar}>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.favButtonModern, isFavorite && styles.favButtonActive]}
              onPress={handleAddFavorite}
              disabled={isFavorite || favLoading}
            >
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#F98A21' : colors.buttonColor} style={{ marginRight: 6 }} />
              <Text style={[styles.favButtonTextModern, typography.styles.button, { color: isFavorite ? '#F98A21' : colors.buttonColor }]}> 
                {isFavorite ? 'Favorilere Eklendi' : favLoading ? 'Ekleniyor...' : 'Favorilere Ekle'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.startButtonModern}
              onPress={handleStart}
            >
              <Ionicons name="play" size={20} color={colors.buttonText} style={{ marginRight: 6 }} />
              <Text style={[styles.startButtonTextModern, typography.styles.button, { color: colors.buttonText }]}>Başla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    marginBottom: 18,
    textAlign: 'center',
  },
  statsContainerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
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
});