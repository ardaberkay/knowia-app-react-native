import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { fontSizes, fonts } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const ACCENT = '#F98A21';
const PRESS_SPRING = { mass: 0.5, damping: 30, stiffness: 400 };

// Learning status → watermark icon + colour (same colours as the deck page stats)
const STATUS_LOOK = {
  learned: { icon: ICONS.learned, color: '#27AE60', labelKey: 'deckDetail.learned', fallback: 'Öğrenildi', mirror: true },
  learning: { icon: ICONS.fire, color: '#F98A21', labelKey: 'deckDetail.learning', fallback: 'Öğreniliyor' },
  new: { icon: ICONS.statusNew, color: '#2F80ED', labelKey: 'deckDetail.new', fallback: 'Yeni' },
};

/**
 * One card in a cards list (deck cards, chapter cards, favourites, Library).
 * Question and answer one line each; favourite and read-aloud on the right;
 * the learning status as a large faded icon in the bottom-right corner.
 *
 * status: 'learned' | 'learning' | 'new' | undefined (no icon)
 * onToggleFavorite: may return a promise; a rejection (or false) undoes the
 *   instant icon change.
 * onSpeak / isSpeaking: read-aloud of the question (omit onSpeak to hide it).
 * selectionMode / isSelected / onToggleSelect: chapter cards' edit mode
 *   (checkbox on the left, favourite and read-aloud hidden).
 */
function CardListItem({
  question,
  answer,
  status,
  isFavorite,
  onPress,
  onToggleFavorite,
  onSpeak,
  isSpeaking = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Favourite changes on tap; the parent's value wins whenever it changes.
  const [localFavorite, setLocalFavorite] = useState(Boolean(isFavorite));
  useEffect(() => { setLocalFavorite(Boolean(isFavorite)); }, [isFavorite]);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleFavoritePress = async () => {
    if (!onToggleFavorite) return;
    triggerHaptic('medium');
    const previous = localFavorite;
    setLocalFavorite(!previous);
    try {
      const result = await onToggleFavorite();
      if (result === false && mountedRef.current) setLocalFavorite(previous);
    } catch {
      if (mountedRef.current) setLocalFavorite(previous);
    }
  };

  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.98 : 1, PRESS_SPRING) }],
  }));

  const look = status ? STATUS_LOOK[status] || STATUS_LOOK.new : null;
  const statusLabel = look ? t(look.labelKey, look.fallback) : null;
  const handlePress = selectionMode ? onToggleSelect : onPress;

  return (
    <Reanimated.View style={pressStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => { pressed.value = 1; }}
        onPressOut={() => { pressed.value = 0; }}
        accessibilityRole="button"
        accessibilityLabel={[question, answer, statusLabel].filter(Boolean).join(', ')}
        accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        style={[
          styles.card,
          {
            backgroundColor: selectionMode && isSelected ? ACCENT + '14' : colors.cardBackground,
            borderColor: selectionMode && isSelected ? ACCENT : colors.cardBorder,
          },
        ]}
      >
        {/* status watermark, clipped by the card's corner */}
        {look ? (
          <View pointerEvents="none" style={styles.watermark}>
            <PhosphorIcon
              icon={look.icon}
              size={88}
              color={look.color}
              style={[styles.watermarkIcon, look.mirror && styles.watermarkMirror]}
            />
          </View>
        ) : null}

        <View style={styles.textCol}>
          <Text style={[styles.text, { color: colors.cardQuestionText }]} numberOfLines={1} ellipsizeMode="tail">
            {question}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.muted + '40' }]} />
          <Text style={[styles.text, { color: colors.cardQuestionText }]} numberOfLines={1} ellipsizeMode="tail">
            {answer}
          </Text>
        </View>

        <View style={styles.actions}>
          {selectionMode ? (
            <View style={styles.checkboxSlot}>
              <View style={[styles.checkbox, { borderColor: ACCENT, backgroundColor: isSelected ? ACCENT : 'transparent' }]}>
                {isSelected ? <PhosphorIcon icon={ICONS.check} size={14} color="#FFFFFF" /> : null}
              </View>
            </View>
          ) : (
            <>
            {onToggleFavorite ? (
              <Pressable
                onPress={handleFavoritePress}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={localFavorite
                  ? t('cardDetail.removeFavorite', 'Favorilerden çıkar')
                  : t('cardDetail.addFavorite', 'Favorilere ekle')}
                style={({ pressed: p }) => [styles.iconBtn, { backgroundColor: colors.iconBackground, opacity: p ? 0.7 : 1 }]}
              >
                <PhosphorIcon
                  icon={localFavorite ? ICONS.favorite : ICONS.favoriteOff}
                  size={19}
                  color={localFavorite ? ACCENT : colors.muted}
                />
              </Pressable>
            ) : null}
            {onSpeak ? (
              <Pressable
                onPress={onSpeak}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={isSpeaking ? t('cardDetail.stopReading', 'Okumayı durdur') : t('cardDetail.readQuestion', 'Soruyu sesli oku')}
                style={({ pressed: p }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.iconBackground, opacity: p ? 0.7 : 1 },
                ]}
              >
                <PhosphorIcon icon={isSpeaking ? ICONS.stopSpeak : ICONS.speak} size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            </>
          )}
        </View>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 92,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  watermark: { position: 'absolute', right: -16, bottom: -22 },
  watermarkIcon: { opacity: 0.14 },
  watermarkMirror: { transform: [{ scaleX: -1 }] },
  // same height as the two buttons, so the card keeps its size in edit mode
  checkboxSlot: { width: 36, height: 80, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  text: { fontSize: fontSizes.body, fontFamily: fonts.semibold, letterSpacing: 0.2 },
  divider: { height: 1.5, borderRadius: 1, marginVertical: 10, marginRight: 8 },
  actions: { marginLeft: 12, gap: 8, alignItems: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(CardListItem);
