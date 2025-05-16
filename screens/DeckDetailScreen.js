import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';

export default function DeckDetailScreen({ route }) {
  const { deck } = route.params;
  const { colors } = useTheme();
  const [isStarted, setIsStarted] = useState(false);

  if (!deck) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
        <Text style={[styles.errorText, typography.styles.body, { color: colors.error }]}>Deste bilgisi bulunamadı.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Üst Bilgi Kartı */}
        <View style={[styles.headerCard, { backgroundColor: colors.cardBackground, shadowColor: colors.text }] }>
          <Text style={[styles.deckTitle, typography.styles.h1, { color: colors.text }]}>{deck.name}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, typography.styles.h2, { color: colors.buttonColor }]}>{deck.card_count || 0}</Text>
              <Text style={[styles.statLabel, typography.styles.caption, { color: colors.muted }]}>Adet Kart</Text>
            </View>
          </View>
        </View>

        {/* Açıklama Kartı */}
        {deck.description && (
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, shadowColor: colors.text }] }>
            <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>Detaylar</Text>
            <Text style={[styles.deckDescription, typography.styles.body, { color: colors.subtext }]}>{deck.description}</Text>
          </View>
        )}

        {/* İlerleme Kartı */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, shadowColor: colors.text }] }>
          <Text style={[styles.sectionTitle, typography.styles.subtitle, { color: colors.text }]}>İlerleme</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }] }>
              <View style={[styles.progressFill, { backgroundColor: colors.buttonColor, width: '0%' }]} />
            </View>
            <Text style={[styles.progressText, typography.styles.caption, { color: colors.muted }]}>Henüz çalışılmadı</Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.bottomButtonContainer, { backgroundColor: colors.background }] }>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.favButton,
              { backgroundColor: colors.cardBackground, borderColor: colors.buttonColor },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.favButtonText, typography.styles.button, { color: colors.buttonColor }]}>Favorilere Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: colors.buttonColor },
            ]}
            onPress={() => setIsStarted(true)}
          >
            <Text style={[
              styles.startButtonText,
              typography.styles.button,
              { color: colors.buttonText },
            ]}>
              Başla
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
});