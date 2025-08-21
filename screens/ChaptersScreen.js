import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ChaptersScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bgGradient}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="book-open-page-variant"
            size={64}
            color={colors.muted}
            style={{ marginBottom: 8 }}
          />
          <Text style={[styles.emptyStateTitle, typography.styles.h3, { color: colors.text }]}>
            {t('chapters.noChapters', 'Henüz Bölüm Yok')}
          </Text>
          <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext }]}>
            {t('chapters.noChaptersDesc', 'Bu destede henüz bölüm oluşturulmamış.')}
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bgGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
