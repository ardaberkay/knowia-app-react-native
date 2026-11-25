import React, { useCallback } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { useTheme } from '../../theme/theme';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { ProfileMenuCard } from './ProfileScreen';

const PROFILE_LINKS = {
  about: 'https://www.knowia.online/about',
  privacy: 'https://www.knowia.online/policy',
  terms: 'https://www.knowia.online/terms',
  feedback: 'https://www.knowia.online/contact',
};

/** Profile › Info & support: about, privacy, terms, feedback (in-app browser). */
export default function InfoScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showError } = useSnackbarHelpers();

  const openLink = useCallback(async (url) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: colors.buttonColor,
        enableBarCollapsing: true,
      });
    } catch {
      showError(t('profile.linkError', 'Link açılamadı'));
    }
  }, [colors.buttonColor, showError, t]);

  const items = [
    { key: 'about', label: t('profile.about'), chevron: true, onPress: () => openLink(PROFILE_LINKS.about) },
    { key: 'privacy', label: t('profile.privacy'), chevron: true, onPress: () => openLink(PROFILE_LINKS.privacy) },
    { key: 'terms', label: t('profile.terms'), chevron: true, onPress: () => openLink(PROFILE_LINKS.terms) },
    { key: 'feedback', label: t('profile.feedback'), chevron: true, onPress: () => openLink(PROFILE_LINKS.feedback) },
  ];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileMenuCard items={items} colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(40),
  },
});
