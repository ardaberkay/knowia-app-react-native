import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';
import BadgeText from '../tools/BadgeText';

const ACCENT = '#F98A21';
const NUMBER_SIZE = 30;

// "… açıklama. Örn: "Kitap"" → { text: '… açıklama.', example: '"Kitap"' }
const splitExample = (description) => {
  const match = /\s*(Örn|E\.g\.|Ej|Ex|Bsp|z\. B\.)[.:]\s*/i.exec(description || '');
  if (!match) return { text: description, example: null };
  return { text: description.slice(0, match.index).trim(), example: description.slice(match.index + match[0].length).trim() };
};

/**
 * Numbered timeline of guide steps. Each step: its icon, title, a required /
 * optional badge, the description with its example on its own line, and any
 * extra content (children). Used by HowToGuideSheet and the CSV upload sheet.
 *
 * steps: [{ icon, title, description?, required?: boolean, children? }]
 * (required undefined = no badge, e.g. the final "press create" step)
 * animate: run the staggered entrance (false while the sheet is closed)
 */
export function GuideSteps({ steps, animate = true }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return steps.map((step, index) => {
    const isLast = index === steps.length - 1;
    const { text, example } = splitExample(step.description);
    return (
      <Reanimated.View key={index} entering={animate ? FadeInDown.duration(380).delay(60 + index * 60) : undefined} style={styles.stepRow}>
        {/* timeline: number + line down to the next step */}
        <View style={styles.rail}>
          <View style={[styles.number, { backgroundColor: isLast ? ACCENT : ACCENT + '22' }]}>
            {isLast
              ? <PhosphorIcon icon={ICONS.check} size={15} color="#FFFFFF" />
              : <Text style={[styles.numberText, { color: ACCENT }]}>{index + 1}</Text>}
          </View>
          {!isLast && <View style={[styles.line, { backgroundColor: colors.cardBorder }]} />}
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <PhosphorIcon icon={step.icon} size={18} color={colors.text} />
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{step.title}</Text>
            {step.required !== undefined && <BadgeText required={step.required} />}
          </View>
          {text ? <Text style={[styles.cardText, { color: colors.muted }]}>{text}</Text> : null}
          {example ? (
            <View style={[styles.example, { backgroundColor: colors.background }]}>
              <Text style={[styles.exampleLabel, { color: colors.muted }]}>{t('common.example', 'Örnek')}</Text>
              <Text style={[styles.exampleText, { color: colors.text }]}>{example}</Text>
            </View>
          ) : null}
          {step.children || null}
        </View>
      </Reanimated.View>
    );
  });
}

/** Tip box under a guide. */
export function GuideTip({ text }) {
  const { colors } = useTheme();
  if (!text) return null;
  return (
    <View style={[styles.tip, { backgroundColor: colors.secondary + '18' }]}>
      <PhosphorIcon icon={ICONS.hint} size={18} color={colors.secondary} />
      <Text style={[styles.tipText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

/**
 * Step-by-step "how to" guide in a full-height native sheet: intro, the
 * numbered steps, then a tip. Used by the deck and the card forms.
 */
export default function HowToGuideSheet({ isVisible, onClose, title, intro, steps, tip }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Native sheet: SwiftUI sheet on iOS, Material ModalBottomSheet on Android.
  const sheetRef = useRef(null);
  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;
  useEffect(() => {
    if (isVisible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [isVisible]);
  // Swipe/backdrop dismiss tells the parent; skipped when the parent closed it.
  const handleSheetDismiss = () => {
    if (visibleRef.current) onClose();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      snapPoints={FULL_SNAP_POINTS}
    >
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.title2, styles.headerTitle, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <PhosphorIcon icon={ICONS.close} size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {intro ? <Text style={[styles.intro, { color: colors.muted }]}>{intro}</Text> : null}
          <GuideSteps steps={steps} animate={isVisible} />
          <GuideTip text={tip} />
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

// Step-by-step guide: full-height native sheet, content scrolls directly.
const FULL_SNAP_POINTS = ['100%'];

const styles = StyleSheet.create({
  sheetContent: { paddingHorizontal: 20, paddingTop: 8, flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { flex: 1, fontFamily: fonts.bold },
  closeButton: { backgroundColor: 'rgba(150, 150, 150, 0.14)', padding: 7, borderRadius: 99 },
  scrollView: { flex: 1 },
  intro: { fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 21, marginBottom: 20 },

  stepRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: NUMBER_SIZE, alignItems: 'center', marginRight: 12 },
  number: { width: NUMBER_SIZE, height: NUMBER_SIZE, borderRadius: NUMBER_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: fontSizes.subhead, fontFamily: fonts.bold },
  line: { width: 2, flex: 1, borderRadius: 1, marginVertical: 4 },

  card: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: fontSizes.body, fontFamily: fonts.semibold },
  cardText: { fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 20 },
  example: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 2, gap: 2 },
  exampleLabel: { fontSize: fontSizes.micro, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  exampleText: { fontSize: fontSizes.subhead, fontFamily: fonts.medium },

  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, marginTop: 6 },
  tipText: { flex: 1, fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 20 },
});
