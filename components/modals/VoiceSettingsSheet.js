import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Text } from '../ui/AppText';
import { BottomSheetModal } from '@expo/ui/community/bottom-sheet';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Reanimated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { typography } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import { SPEECH_RATE, SPEECH_RATES, formatRate, voiceRank } from '../../lib/speech';

// Stepped speed bar for the voice sheet: tap a stop or drag along the track.
// The thumb snaps to the nearest stop on the UI thread (light haptic per
// stop); the value is committed to React when the finger lifts.
const RATE_THUMB = 24;
const RATE_LABEL_WIDTH = 56;
const RateStepBar = memo(function RateStepBar({
  steps,
  value,
  recommended,
  recommendedLabel,
  onChange,
  accentColor,
  trackColor,
  textColor,
  mutedColor,
}) {
  // Everything is laid out in percentages of the track, so the bar is drawn
  // in its final place on the first frame (nothing jumps while the sheet
  // opens). The measured width is only used to map a touch to a stop.
  const [trackWidth, setTrackWidth] = useState(0);
  const count = steps.length;
  const lastIndex = Math.max(1, count - 1);
  const index = Math.max(0, steps.indexOf(value));
  const stepWidth = count > 1 ? trackWidth / (count - 1) : 0;
  const pad = RATE_THUMB / 2;
  const pct = (i) => `${(i / lastIndex) * 100}%`;

  // 0..1 along the track. Starts at the current stop: no entrance animation.
  const progress = useSharedValue(index / lastIndex);
  const activeIndex = useSharedValue(index);
  useEffect(() => {
    activeIndex.value = index;
    progress.value = withTiming(index / lastIndex, { duration: 160 });
  }, [activeIndex, index, lastIndex, progress]);

  const commit = useCallback((i) => {
    const next = steps[i];
    if (next != null && next !== value) onChange?.(next);
  }, [onChange, steps, value]);

  const gesture = useMemo(() => {
    const snapTo = (x) => {
      'worklet';
      if (stepWidth <= 0) return;
      const i = Math.min(count - 1, Math.max(0, Math.round((x - pad) / stepWidth)));
      if (i !== activeIndex.value) {
        activeIndex.value = i;
        runOnJS(triggerHaptic)('selection');
      }
      progress.value = withTiming(i / lastIndex, { duration: 90 });
    };
    // A tap picks a stop; a drag only takes over once it is clearly
    // horizontal, so a vertical swipe that starts on the bar still scrolls
    // the sheet.
    const tap = Gesture.Tap()
      .maxDuration(400)
      .onEnd((e, success) => {
        'worklet';
        if (!success) return;
        snapTo(e.x);
        runOnJS(commit)(activeIndex.value);
      });
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-10, 10])
      .onStart((e) => { 'worklet'; snapTo(e.x); })
      .onUpdate((e) => { 'worklet'; snapTo(e.x); })
      .onEnd(() => { 'worklet'; runOnJS(commit)(activeIndex.value); });
    return Gesture.Race(pan, tap);
  }, [activeIndex, commit, count, lastIndex, pad, progress, stepWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${progress.value * 100}%` }));

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.rateBar, { paddingHorizontal: pad }]}
          onLayout={(e) => setTrackWidth(Math.max(0, e.nativeEvent.layout.width - RATE_THUMB))}
        >
          {/* Track layer: spans exactly the stops, from the first to the last. */}
          <View pointerEvents="none" style={[styles.rateTrackLayer, { left: pad, right: pad }]}>
            <View style={[styles.rateTrack, { backgroundColor: trackColor }]} />
            <Reanimated.View style={[styles.rateTrack, styles.rateFill, { backgroundColor: accentColor }, fillStyle]} />
            {steps.map((step, i) => (
              <View
                key={step}
                style={[
                  styles.rateDot,
                  { left: pct(i), backgroundColor: i <= index ? accentColor : trackColor },
                ]}
              />
            ))}
            <Reanimated.View style={[styles.rateThumb, { borderColor: accentColor }, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>
      <View style={[styles.rateLabels, { marginHorizontal: pad }]}>
        {steps.map((step, i) => {
          const selected = i === index;
          return (
            <View key={step} style={[styles.rateLabel, { left: pct(i) }]}>
              <Text style={[styles.rateLabelText, { color: selected ? accentColor : textColor, fontWeight: selected ? '700' : '500' }]}>
                {formatRate(step)}
              </Text>
              {step === recommended ? (
                <Text style={[styles.rateLabelHint, { color: mutedColor }]} numberOfLines={1}>
                  {recommendedLabel}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});

// One row of the voice list. Memoized: picking a voice re-renders only the
// rows whose selection changed.
const VoiceRow = memo(function VoiceRow({ row, selected, first, base, locale, onSelect, colors }) {
  return (
    <Pressable
      onPress={() => onSelect(base, row.identifier, locale)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.voiceRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.styles.body, { color: colors.text }]} numberOfLines={1}>
          {row.label}
        </Text>
        {row.tags ? (
          <Text style={[styles.voiceRowTags, { color: colors.muted }]} numberOfLines={1}>
            {row.tags}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Iconify icon="hugeicons:tick-01" size={22} color={colors.buttonColor} />
      ) : (
        <Iconify icon="streamline:button-play-solid" size={14} color={colors.muted} />
      )}
    </Pressable>
  );
});

// Voice settings sheet (gorhom, like the app's other pickers). A separate
// memoized component so re-renders of the swipe screen (speech state,
// counters, ...) never redraw it. Fixed height: no content measuring or
// resizing while the voice list loads.
const VoiceSettingsSheet = memo(function VoiceSettingsSheet({
  sheetRef,
  sections,
  rate,
  chosenVoices,
  onSelectVoice,
  onRateChange,
  onDismiss,
  colors,
  isDarkMode,
  bottomInset,
}) {
  const { t } = useTranslation();
  const close = useCallback(() => sheetRef?.current?.dismiss(), [sheetRef]);

  // Row labels/tags are built once per voice list, not on every render.
  // Voices of the deck's own region (e.g. en-US) are listed directly; other
  // accents (en-GB, en-AU, ...) sit behind a collapsible "other accents" row.
  // If the region has no voice at all, every voice is listed directly.
  const sectionRows = useMemo(() => sections.map((section) => {
    const region = (section.locale || '').toLowerCase();
    const voiceRows = section.voices.map((v, i) => {
      const tags = [];
      if (Platform.OS === 'ios') {
        const rank = voiceRank(v.identifier);
        if (rank === 3) tags.push(t('swipeDeck.voice.premium', 'Premium'));
        else if (rank === 2) tags.push(t('swipeDeck.voice.enhanced', 'Gelişmiş'));
      } else {
        tags.push((v.identifier || '').includes('network')
          ? t('swipeDeck.voice.online', 'Çevrimiçi')
          : t('swipeDeck.voice.offline', 'Cihazda'));
      }
      if (v.language) tags.push(v.language);
      return {
        identifier: v.identifier,
        // Android voice names are raw ids (tr-tr-x-tmc-network).
        label: Platform.OS === 'ios' && v.name
          ? v.name
          : t('swipeDeck.voice.voiceN', { n: i + 1, defaultValue: `Ses ${i + 1}` }),
        tags: tags.join(' · '),
        local: (v.language || '').replace('_', '-').toLowerCase() === region,
      };
    });
    const hasLocal = voiceRows.some((row) => row.local);
    return {
      ...section,
      mainRows: [
        { identifier: null, label: t('swipeDeck.voice.auto', 'Otomatik (en iyi ses)'), tags: '' },
        ...voiceRows.filter((row) => !hasLocal || row.local),
      ],
      otherRows: hasLocal ? voiceRows.filter((row) => !row.local) : [],
    };
  }), [sections, t]);

  // Which sections show their other accents. Until toggled, a section opens
  // them only when the chosen voice is one of them.
  const [accentsOpen, setAccentsOpen] = useState({});
  const toggleAccents = useCallback((base, open) => {
    triggerHaptic('selection');
    setAccentsOpen((prev) => ({ ...prev, [base]: !open }));
  }, []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={LARGE_SNAP_POINTS}
      enablePanDownToClose
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: colors.background }}
    >
      {/* The sheet content lives in the native sheet's own view hierarchy, outside
          the app's root GestureHandlerRootView, so the rate bar's pan needs one here. */}
      <GestureHandlerRootView style={styles.voiceSheetRoot}>
      <View style={styles.voiceSheetHeader}>
        <Text style={[typography.styles.h2, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {t('swipeDeck.voice.settings', 'Ses ayarları')}
        </Text>
        <TouchableOpacity
          onPress={close}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          accessibilityRole="button"
          accessibilityLabel={t('cardDetail.close', 'Kapat')}
          style={styles.voiceSheetClose}
        >
          <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <GHScrollView
        style={styles.voiceSheetScroll}
        contentContainerStyle={[styles.voiceSheetContent, { paddingBottom: 32 }]}
      >
        <View style={styles.voiceRateHeader}>
          <Text style={[styles.voiceSectionTitle, { color: colors.muted, marginTop: 0, marginBottom: 0 }]}>
            {t('swipeDeck.voice.rate', 'Okuma hızı')}
          </Text>
          <Text style={[styles.voiceRateValue, { color: colors.buttonColor }]}>
            {formatRate(rate)}
          </Text>
        </View>
        <RateStepBar
          steps={SPEECH_RATES}
          value={rate}
          recommended={SPEECH_RATE}
          recommendedLabel={t('swipeDeck.voice.recommended', 'önerilen')}
          onChange={onRateChange}
          accentColor={colors.buttonColor}
          trackColor={colors.border}
          textColor={colors.text}
          mutedColor={colors.muted}
        />

        {sectionRows.map((section) => {
          const chosen = chosenVoices[section.base];
          const chosenInstalled = Boolean(chosen) && section.voices.some((v) => v.identifier === chosen);
          const chosenIsOther = chosenInstalled && section.otherRows.some((row) => row.identifier === chosen);
          const othersOpen = accentsOpen[section.base] ?? chosenIsOther;
          const renderRow = (row, first) => (
            <VoiceRow
              key={row.identifier || 'auto'}
              row={row}
              selected={row.identifier ? row.identifier === chosen : !chosenInstalled}
              first={first}
              base={section.base}
              locale={section.locale}
              onSelect={onSelectVoice}
              colors={colors}
            />
          );
          return (
            <View key={section.base}>
              <Text style={[styles.voiceSectionTitle, { color: colors.muted }]}>
                {`${section.title} · ${section.sideLabel}`}
              </Text>
              <View style={[styles.voiceList, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                {section.mainRows.map((row, index) => renderRow(row, index === 0))}
                {section.otherRows.length ? (
                  <Pressable
                    onPress={() => toggleAccents(section.base, othersOpen)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: othersOpen }}
                    style={({ pressed }) => [
                      styles.voiceRow,
                      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[typography.styles.body, { color: colors.buttonColor, flex: 1 }]} numberOfLines={1}>
                      {t('swipeDeck.voice.otherAccents', {
                        count: section.otherRows.length,
                        defaultValue: `Diğer aksanlar (${section.otherRows.length})`,
                      })}
                    </Text>
                    <Iconify
                      icon={othersOpen ? 'flowbite:caret-up-solid' : 'flowbite:caret-down-solid'}
                      size={16}
                      color={colors.buttonColor}
                    />
                  </Pressable>
                ) : null}
                {othersOpen ? section.otherRows.map((row) => renderRow(row, false)) : null}
              </View>
              {section.voices.length === 0 ? (
                <Text style={[styles.voiceHint, { color: colors.muted }]}>
                  {t('swipeDeck.voice.noVoices', 'Bu dil için cihazda yüklü ses bulunamadı.')}
                </Text>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.voiceHint, { color: colors.muted }]}>
          {Platform.OS === 'ios'
            ? t('swipeDeck.voice.iosHint', 'Daha doğal sesler için: Ayarlar › Erişilebilirlik › Seslendirilen İçerik › Sesler bölümünden Gelişmiş veya Premium sesleri indirebilirsin.')
            : t('swipeDeck.voice.androidHint', 'Daha fazla ses için: Ayarlar › Erişilebilirlik › Metin okuma çıkışı bölümünden ses verilerini yükleyebilirsin.')}
        </Text>
      </GHScrollView>
      </GestureHandlerRootView>
    </BottomSheetModal>
  );
});

export default VoiceSettingsSheet;

// Full-height native sheet.
const LARGE_SNAP_POINTS = ['100%'];

const styles = StyleSheet.create({
  voiceSheetRoot: {
    flex: 1,
  },
  voiceSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  voiceSheetClose: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  voiceSheetScroll: {
    flex: 1,
  },
  voiceSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  voiceRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  voiceRateValue: {
    ...typography.styles.button,
    fontSize: 15,
  },
  rateBar: {
    height: 44,
    justifyContent: 'center',
  },
  rateTrackLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  rateTrack: {
    height: 4,
    borderRadius: 2,
  },
  rateFill: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -2,
  },
  rateDot: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rateThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -RATE_THUMB / 2,
    marginLeft: -RATE_THUMB / 2,
    width: RATE_THUMB,
    height: RATE_THUMB,
    borderRadius: RATE_THUMB / 2,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  rateLabels: {
    height: 34,
  },
  rateLabel: {
    position: 'absolute',
    top: 0,
    marginLeft: -RATE_LABEL_WIDTH / 2,
    width: RATE_LABEL_WIDTH,
    alignItems: 'center',
  },
  rateLabelText: {
    fontFamily: 'Inter',
    fontSize: 13,
  },
  rateLabelHint: {
    fontFamily: 'Inter',
    fontSize: 10,
    marginTop: 1,
  },
  voiceSectionTitle: {
    ...typography.styles.button,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  voiceList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  voiceRowTags: {
    fontFamily: 'Inter',
    fontSize: 12,
    marginTop: 2,
  },
  voiceHint: {
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
});
