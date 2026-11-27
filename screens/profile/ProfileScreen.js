import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Pressable, Animated, Platform } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Constants from 'expo-constants';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import {
  getCurrentUserProfile,
  getActivitySummary,
  setDailyGoal,
  DAILY_GOAL_PRESETS,
  DEFAULT_DAILY_GOAL,
  CUSTOM_GOAL_MIN,
  CUSTOM_GOAL_MAX,
  goalMinutes,
} from '../../services/ProfileService';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { cacheProfile, getCachedProfile, cacheProfileImage } from '../../services/CacheService';
import { useTranslation } from 'react-i18next';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { triggerHaptic } from '../../lib/hapticManager';
import { useListBottomInset } from '../../components/ui/TabBarInset';
import PhosphorIcon from '../../components/ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

const APP_VERSION = Constants.expoConfig?.version ?? '';

// '#RRGGBB' + alpha -> 'rgba(...)'.
function withAlpha(hex, alpha) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// 'YYYY-MM-DD' -> local Date (no UTC shift).
function parseDay(value) {
  const [y, m, d] = String(value || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : new Date();
}
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Name of a goal: its preset title, or "Kendi hedefim" for a typed-in one.
function goalName(goal, t) {
  const preset = DAILY_GOAL_PRESETS.find((p) => p.goal === goal);
  return preset
    ? t(`profile.activity.goals.${preset.key}.title`)
    : t('profile.activity.goals.custom.title', 'Kendi hedefim');
}

/**
 * Menu rows in an iOS-style inset grouped card (used by Profile and its
 * Account / Settings / Info pages): no border, continuous corners, hairline
 * separators inset to where the text starts, grey highlight while pressed.
 * item: { label, icon?, right?, onPress?, chevron? }; icon is an ICONS entry
 * (theme/icons.js), always drawn bold so the column of row icons matches.
 */
export function ProfileMenuCard({ items, colors }) {
  return (
    <View style={[menuStyles.card, { backgroundColor: colors.cardBackground }]}>
      {items.map((item, index) => (
        <Pressable
          key={item.key || item.label}
          onPress={item.onPress}
          disabled={!item.onPress}
          style={({ pressed }) => [
            menuStyles.row,
            pressed && item.onPress ? { backgroundColor: 'rgba(150, 150, 150, 0.18)' } : null,
          ]}
        >
          {index > 0 ? (
            <View
              pointerEvents="none"
              style={[
                menuStyles.separator,
                { left: item.icon ? MENU_TEXT_INSET : MENU_SIDE_PADDING, backgroundColor: colors.border },
              ]}
            />
          ) : null}
          {item.icon ? (
            <PhosphorIcon icon={item.icon} weight="bold" size={20} color={item.iconColor || colors.buttonColor} />
          ) : null}
          <Text style={[typography.styles.body, { color: item.labelColor || colors.text, flex: 1 }]} numberOfLines={1}>
            {item.label}
          </Text>
          {item.right ?? null}
          {item.chevron ? (
            <PhosphorIcon icon={ICONS.chevronRight} size={18} color={colors.muted} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const MENU_SIDE_PADDING = 16;
// Side padding + 20 icon + 12 gap: separators start where the label starts.
const MENU_TEXT_INSET = MENU_SIDE_PADDING + 20 + 12;

export const menuStyles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: MENU_SIDE_PADDING,
    minHeight: 50,
    paddingVertical: 10,
  },
  separator: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
});

// ─── Heatmap ───

// A fixed number of days in a full 7 × 17 rectangle, today in the bottom
// right corner. Rows are not weekdays: the map is read by colour density
// ("how much did I study which month"), so it never has empty cells.
const HEATMAP_ROWS = 7;
const HEATMAP_COLS = 17;
const HEATMAP_DAYS = HEATMAP_ROWS * HEATMAP_COLS;
const HEATMAP_GAP = 4;

const ActivityHeatmap = React.memo(function ActivityHeatmap({ summary, colors, isDarkMode, t, language }) {
  const [width, setWidth] = useState(0);
  const today = useMemo(() => parseDay(summary?.today), [summary?.today]);
  const todayKey = dayKey(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  useEffect(() => { setSelectedKey(todayKey); }, [todayKey]);

  const byDay = useMemo(() => {
    const map = {};
    (summary?.days || []).forEach((d) => { map[d.day] = d; });
    return map;
  }, [summary?.days]);

  // columns[c][r]: column-major, oldest day top-left, today bottom-right.
  const columns = useMemo(() => {
    const cols = [];
    for (let c = 0; c < HEATMAP_COLS; c += 1) {
      const col = [];
      for (let r = 0; r < HEATMAP_ROWS; r += 1) {
        const back = HEATMAP_DAYS - 1 - (c * HEATMAP_ROWS + r);
        const date = new Date(today);
        date.setDate(today.getDate() - back);
        col.push(date);
      }
      cols.push(col);
    }
    return cols;
  }, [today]);

  const cell = width > 0 ? (width - HEATMAP_GAP * (HEATMAP_COLS - 1)) / HEATMAP_COLS : 0;
  const emptyColor = isDarkMode ? '#3A3A3A' : '#E6E2D8';
  const levelColor = (entry) => {
    if (!entry || !entry.swipes) return emptyColor;
    const ratio = entry.swipes / Math.max(1, entry.goal || DEFAULT_DAILY_GOAL);
    if (ratio >= 1) return colors.buttonColor;
    if (ratio >= 0.66) return withAlpha(colors.buttonColor, 0.75);
    if (ratio >= 0.33) return withAlpha(colors.buttonColor, 0.5);
    return withAlpha(colors.buttonColor, 0.28);
  };

  // Month name over the column where that month's 1st falls (and the first column).
  const monthLabels = useMemo(() => {
    const labels = [];
    columns.forEach((col, i) => {
      const first = col.find((date) => date.getDate() === 1);
      if (!first && i !== 0) return;
      const date = first || col[0];
      let name = String(date.getMonth() + 1);
      try {
        name = date.toLocaleDateString(language, { month: 'short' });
      } catch {
        // keep the month number
      }
      labels.push({ index: i, name });
    });
    if (labels.length > 1 && labels[1].index - labels[0].index < 3) labels.shift();
    return labels;
  }, [columns, language]);

  // The cells don't take touches, so the coordinates are the grid's own.
  const handlePress = (e) => {
    if (cell <= 0) return;
    const { locationX, locationY } = e.nativeEvent;
    const c = Math.min(HEATMAP_COLS - 1, Math.max(0, Math.floor(locationX / (cell + HEATMAP_GAP))));
    const r = Math.min(HEATMAP_ROWS - 1, Math.max(0, Math.floor(locationY / (cell + HEATMAP_GAP))));
    const date = columns[c]?.[r];
    if (!date) return;
    triggerHaptic('selection');
    setSelectedKey(dayKey(date));
  };

  const selected = byDay[selectedKey];
  let selectedLabel = selectedKey;
  try {
    selectedLabel = parseDay(selectedKey).toLocaleDateString(language, { day: 'numeric', month: 'long' });
  } catch {
    // keep YYYY-MM-DD
  }

  return (
    <View>
      <View style={[heatStyles.months, { height: 16 }]}>
        {cell > 0 ? monthLabels.map((m) => (
          <Text
            key={`${m.index}-${m.name}`}
            style={[heatStyles.month, { left: m.index * (cell + HEATMAP_GAP), color: colors.muted }]}
            numberOfLines={1}
          >
            {m.name}
          </Text>
        )) : null}
      </View>
      <Pressable onPress={handlePress} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View pointerEvents="none" style={[heatStyles.grid, { height: cell > 0 ? cell * HEATMAP_ROWS + HEATMAP_GAP * (HEATMAP_ROWS - 1) : 1 }]}>
          {cell > 0 ? columns.map((col, c) => (
            <View key={c} style={{ marginRight: c < HEATMAP_COLS - 1 ? HEATMAP_GAP : 0 }}>
              {col.map((date, r) => {
                const key = dayKey(date);
                return (
                  <View
                    key={key}
                    style={{
                      width: cell,
                      height: cell,
                      marginBottom: r < HEATMAP_ROWS - 1 ? HEATMAP_GAP : 0,
                      borderRadius: Math.max(3, cell * 0.28),
                      backgroundColor: levelColor(byDay[key]),
                      borderWidth: key === selectedKey ? 1.5 : 0,
                      borderColor: colors.text,
                    }}
                  />
                );
              })}
            </View>
          )) : null}
        </View>
      </Pressable>
      <View style={heatStyles.footer}>
        <Text style={[typography.styles.subhead, { color: colors.text, flex: 1 }]} numberOfLines={1}>
          {`${selectedLabel} · `}
          {selected?.swipes
            ? t('profile.activity.dayDetail', {
              count: selected.swipes,
              learned: selected.learned || 0,
              defaultValue: `${selected.swipes} kart · ${selected.learned || 0} öğrenildi`,
            })
            : t('profile.activity.noActivity', 'Çalışma yok')}
        </Text>
        <View style={heatStyles.legend}>
          <Text style={[heatStyles.legendText, { color: colors.muted }]}>{t('profile.activity.less', 'Az')}</Text>
          {[0, 0.28, 0.5, 0.75, 1].map((a) => (
            <View
              key={a}
              style={[heatStyles.legendCell, { backgroundColor: a === 0 ? emptyColor : withAlpha(colors.buttonColor, a) }]}
            />
          ))}
          <Text style={[heatStyles.legendText, { color: colors.muted }]}>{t('profile.activity.more', 'Çok')}</Text>
        </View>
      </View>
    </View>
  );
});

// ─── Daily goal sheet ───

const CUSTOM_STEP = 5;
const clampGoal = (value) => Math.min(CUSTOM_GOAL_MAX, Math.max(CUSTOM_GOAL_MIN, value));
const roundToStep = (value) => Math.round(value / CUSTOM_STEP) * CUSTOM_STEP;

/**
 * − / + button of the custom goal stepper. A tap moves one step; holding it
 * repeats, faster after a moment, so 5 → 500 takes a few seconds.
 */
function StepButton({ label, disabled, onStep, colors, isDarkMode }) {
  const timerRef = useRef(null);
  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = () => {
    if (disabled) return;
    onStep();
    let repeats = 0;
    const tick = () => {
      repeats += 1;
      if (!onStep()) { stop(); return; }
      timerRef.current = setTimeout(tick, repeats > 8 ? 45 : 110);
    };
    timerRef.current = setTimeout(tick, 380);
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        sheetStyles.stepButton,
        {
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[sheetStyles.stepLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const DailyGoalSheet = React.memo(function DailyGoalSheet({ sheetRef, goal, onSelect, colors, isDarkMode, bottomInset }) {
  const { t } = useTranslation();
  const isPreset = DAILY_GOAL_PRESETS.some((p) => p.goal === goal);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(goal);
  // The stepper reads the latest value while a button is held down.
  const customValueRef = useRef(goal);
  const setCustom = (value) => {
    customValueRef.current = value;
    setCustomValue(value);
  };

  const handleChange = useCallback((index) => {
    if (index === -1) setCustomOpen(false);
  }, []);

  const pick = (value) => {
    onSelect(value);
    sheetRef.current?.dismiss();
  };

  const openCustom = () => {
    triggerHaptic('selection');
    setCustom(clampGoal(roundToStep(goal)));
    setCustomOpen(true);
  };

  // One step; returns false at the limit so a held button stops repeating.
  const step = (direction) => () => {
    const next = clampGoal(customValueRef.current + direction * CUSTOM_STEP);
    if (next === customValueRef.current) return false;
    setCustom(next);
    triggerHaptic('selection');
    return true;
  };

  const meta = (count) => t('profile.activity.goalMeta', {
    count,
    min: goalMinutes(count),
    defaultValue: `Günde ${count} kart · ~${goalMinutes(count)} dk`,
  });
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      onChange={handleChange}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
    >
      <BottomSheetView style={[sheetStyles.content, { paddingBottom: 20 }]}>
        <View style={sheetStyles.header}>
          <Text style={[typography.styles.title2, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {t('profile.activity.goalTitle', 'Günlük hedef')}
          </Text>
          <TouchableOpacity
            onPress={() => sheetRef.current?.dismiss()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button"
            accessibilityLabel={t('cardDetail.close', 'Kapat')}
            style={sheetStyles.close}
          >
            <PhosphorIcon icon={ICONS.close} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Plain rows on the sheet background (no card), thin dividers. */}
        {DAILY_GOAL_PRESETS.map((preset, index) => {
          const selected = preset.goal === goal;
          return (
            <TouchableOpacity
              key={preset.key}
              activeOpacity={0.6}
              onPress={() => { triggerHaptic('selection'); pick(preset.goal); }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[sheetStyles.row, index > 0 && divider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.styles.headline, { color: selected ? colors.buttonColor : colors.text }]}>
                  {t(`profile.activity.goals.${preset.key}.title`)}
                </Text>
                <Text style={[typography.styles.subhead, { color: colors.muted }]} numberOfLines={1}>
                  {`${meta(preset.goal)} · ${t(`profile.activity.goals.${preset.key}.desc`)}`}
                </Text>
              </View>
              {selected ? <PhosphorIcon icon={ICONS.check} size={22} color={colors.buttonColor} /> : null}
            </TouchableOpacity>
          );
        })}

        {/* Custom goal: a − / + stepper (5 to 500, steps of 5), no keyboard. */}
        <TouchableOpacity
          activeOpacity={customOpen ? 1 : 0.6}
          onPress={customOpen ? undefined : openCustom}
          style={[sheetStyles.row, divider]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.styles.headline, { color: !isPreset ? colors.buttonColor : colors.text }]}>
              {t('profile.activity.goals.custom.title', 'Kendi hedefim')}
            </Text>
            <Text style={[typography.styles.subhead, { color: colors.muted }]} numberOfLines={1}>
              {customOpen || !isPreset
                ? meta(customOpen ? customValue : goal)
                : t('profile.activity.goals.custom.desc', {
                  min: CUSTOM_GOAL_MIN,
                  max: CUSTOM_GOAL_MAX,
                  defaultValue: `Sayıyı sen belirle (${CUSTOM_GOAL_MIN}–${CUSTOM_GOAL_MAX})`,
                })}
            </Text>
            {customOpen ? (
              <View style={sheetStyles.stepper}>
                <StepButton
                  label="−"
                  disabled={customValue <= CUSTOM_GOAL_MIN}
                  onStep={step(-1)}
                  colors={colors}
                  isDarkMode={isDarkMode}
                />
                <Text style={[sheetStyles.stepValue, { color: colors.text }]} numberOfLines={1}>
                  {t('profile.activity.goalCount', { count: customValue, defaultValue: `${customValue} kart` })}
                </Text>
                <StepButton
                  label="+"
                  disabled={customValue >= CUSTOM_GOAL_MAX}
                  onStep={step(1)}
                  colors={colors}
                  isDarkMode={isDarkMode}
                />
                <TouchableOpacity
                  onPress={() => { triggerHaptic('success'); pick(customValue); }}
                  activeOpacity={0.8}
                  style={[sheetStyles.customSave, { backgroundColor: colors.buttonColor }]}
                >
                  <Text style={[typography.styles.headline, { color: '#FFFFFF' }]}>
                    {t('profile.activity.goals.custom.save', 'Kaydet')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          {!isPreset && !customOpen ? (
            <PhosphorIcon icon={ICONS.check} size={22} color={colors.buttonColor} />
          ) : null}
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

// ─── Screen ───

export default function ProfileScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();
  const { session } = useAuth();
  const authUserId = session?.user?.id;
  const { t, i18n } = useTranslation();
  const { showError } = useSnackbarHelpers();

  // Profile (cache first, then fresh in the background).
  const [profile, setProfile] = useState(null);
  const loadProfile = useCallback(async (useCache = true) => {
    if (!authUserId) return;
    try {
      if (useCache) {
        const cached = await getCachedProfile(authUserId);
        if (cached) setProfile(cached);
      }
      const fresh = await getCurrentUserProfile(authUserId);
      setProfile(fresh);
      await cacheProfile(authUserId, fresh);
      if (fresh?.image_url) await cacheProfileImage(authUserId, fresh.image_url);
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  }, [authUserId]);
  useEffect(() => { loadProfile(true); }, [loadProfile]);

  // Study activity: heatmap + streak + goal. Cached; refetched when a study
  // session ends or the day changes (see ProfileService). On focus the profile
  // is reloaded only if editing it cleared its cache.
  const [activity, setActivity] = useState(null);
  useFocusEffect(
    useCallback(() => {
      if (!authUserId) return undefined;
      let active = true;
      getActivitySummary(authUserId, { days: HEATMAP_DAYS }).then((summary) => {
        if (active && summary) setActivity(summary);
      });
      getCachedProfile(authUserId).then((cached) => {
        if (active && !cached) loadProfile(false);
      });
      return () => { active = false; };
    }, [authUserId, loadProfile])
  );

  const dailyGoal = activity?.daily_goal ?? DEFAULT_DAILY_GOAL;
  const todaySwipes = activity?.today_swipes ?? 0;

  const goalSheetRef = useRef(null);
  const openGoalSheet = useCallback(() => {
    triggerHaptic('selection');
    goalSheetRef.current?.present();
  }, []);
  const handleGoalSelect = useCallback(async (goal) => {
    if (!authUserId || goal === dailyGoal) return;
    const previous = activity;
    setActivity((prev) => (prev ? { ...prev, daily_goal: goal } : prev));
    try {
      await setDailyGoal(authUserId, goal);
      const fresh = await getActivitySummary(authUserId, { days: HEATMAP_DAYS, force: true });
      if (fresh) setActivity(fresh);
    } catch (e) {
      setActivity(previous);
      showError(t('profile.activity.goalSaveError', 'Günlük hedef kaydedilemedi'));
    }
  }, [activity, authUserId, dailyGoal, showError, t]);

  const stats = [
    {
      key: 'streak',
      icon: ICONS.fire,
      value: String(activity?.current_streak ?? 0),
      label: t('profile.activity.streak', 'Seri'),
    },
    {
      key: 'best',
      value: String(activity?.best_streak ?? 0),
      label: t('profile.activity.best', 'En uzun'),
    },
    {
      key: 'studied',
      value: String(activity?.total_swipes ?? 0),
      label: t('profile.activity.studied', 'Çalışılan'),
    },
    {
      key: 'learned',
      value: String(activity?.total_learned ?? 0),
      label: t('profile.activity.learned', 'Öğrenilen'),
    },
  ];

  // Scroll offset (native) -> glow opacity: full at rest and while pulling
  // down, gone after ~180pt of scrolling up.
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const glowOpacity = useMemo(
    () => scrollY.interpolate({ inputRange: [0, 180], outputRange: [1, 0], extrapolate: 'clamp' }),
    [scrollY]
  );

  const pages = [
    { key: 'account', icon: ICONS.user, label: t('profile.account', 'Hesap'), chevron: true, onPress: () => navigation.navigate('ProfileAccount') },
    { key: 'settings', icon: ICONS.settings, label: t('profile.settings', 'Ayarlar'), chevron: true, onPress: () => navigation.navigate('ProfileSettings') },
    { key: 'info', icon: ICONS.info, label: t('profile.info', 'Bilgi ve destek'), chevron: true, onPress: () => navigation.navigate('ProfileInfo') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* The glow is fixed to the screen, behind the scroll view: pulling the
          page down leaves no unlit gap above it, and it fades out as the page
          scrolls up (native-driven opacity). */}
      <TopGlow
        color={colors.buttonColor}
        strength={isDarkMode ? 0.18 : 0.1} // same as Discover / Library
        height={insets.top + 210}
        opacity={glowOpacity}
      />
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: listBottomInset }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={styles.identity}>
            <Image
              source={profile?.image_url ? { uri: profile.image_url } : require('../../assets/images/avatar_default.webp')}
              style={[styles.avatar, { borderColor: colors.buttonColor }]}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{profile?.username || ' '}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditProfile')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.edit', 'Profili düzenle')}
                  style={[styles.editButton, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)' }]}
                >
                  <PhosphorIcon icon={ICONS.edit} size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>{profile?.email || ' '}</Text>
            </View>
          </View>

          <View style={[styles.statsRow, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' }]}>
            {stats.map((stat, index) => (
              <View
                key={stat.key}
                style={[styles.stat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}
              >
                <View style={styles.statValueRow}>
                  {stat.icon ? <PhosphorIcon icon={stat.icon} size={16} color={colors.buttonColor} /> : null}
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {stat.value}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.muted }]} numberOfLines={1}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Daily goal (no card: a plain section) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              {/* Same icon the Home hero used for the daily goal. */}
              <View style={styles.sectionTitleRow}>
                <PhosphorIcon icon={ICONS.trending} size={16} color={colors.buttonColor} />
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>
                  {t('profile.activity.goalTitle', 'Günlük hedef')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={openGoalSheet}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.changePill, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)' }]}
              >
                <Text style={[typography.styles.headline, { color: colors.text, fontSize: fontSizes.footnote }]}>
                  {t('profile.activity.change', 'Değiştir')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* "İstikrarlı · 7/50 kart": the goal and today's count in one line. */}
            <View style={styles.goalLine}>
              <Text style={[typography.styles.bodyLarge, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                {t('profile.activity.goalLine', {
                  name: goalName(dailyGoal, t),
                  done: todaySwipes,
                  goal: dailyGoal,
                  defaultValue: `${goalName(dailyGoal, t)} · ${todaySwipes}/${dailyGoal} kart`,
                })}
              </Text>
              {activity?.today_goal_met ? (
                <PhosphorIcon icon={ICONS.check} size={18} color={colors.buttonColor} />
              ) : null}
            </View>
            <View style={[styles.goalTrack, { backgroundColor: isDarkMode ? '#3A3A3A' : '#E6E2D8' }]}>
              <View
                style={[
                  styles.goalFill,
                  { backgroundColor: colors.buttonColor, width: `${Math.min(1, todaySwipes / Math.max(1, dailyGoal)) * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* Heatmap (no card, no title) */}
          <View style={styles.heatmapSection}>
            <ActivityHeatmap
              summary={activity}
              colors={colors}
              isDarkMode={isDarkMode}
              t={t}
              language={i18n.language}
            />
          </View>

          {/* Account / Settings / Info pages: a grouped menu stays in a card. */}
          <View style={{ marginTop: 8 }}>
            <ProfileMenuCard items={pages} colors={colors} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerApp}>{`Knowia v${APP_VERSION}`}</Text>
            <Text style={styles.footerCompany}>© 2026 BB Nova</Text>
          </View>
        </View>
      </Animated.ScrollView>

      <DailyGoalSheet
        sheetRef={goalSheetRef}
        goal={dailyGoal}
        onSelect={handleGoalSelect}
        colors={colors}
        isDarkMode={isDarkMode}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

// Soft light falling from the top centre (SVG radial gradient), used instead
// of a full gradient hero. `height` bounds it so it never reaches far down.
function TopGlow({ color, strength, height, opacity }) {
  return (
    <Animated.View pointerEvents="none" style={[styles.glow, { height, opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="profileTopGlow" cx="50%" cy="0%" rx="70%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.5" stopColor={color} stopOpacity={strength * 0.4} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#profileTopGlow)" />
      </Svg>
    </Animated.View>
  );
}

const SIDE_PADDING = 14;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 18,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    flexShrink: 1,
    fontSize: fontSizes.title3,
    fontFamily: fonts.bold,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  email: {
    marginTop: 2,
    fontSize: fontSizes.footnote,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: fontSizes.title3,
    fontFamily: fonts.bold,
  },
  statLabel: {
    marginTop: 2,
    fontSize: fontSizes.micro,
  },
  body: {
    paddingHorizontal: SIDE_PADDING,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  section: {
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  goalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatmapSection: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  goalFill: {
    height: '100%',
    borderRadius: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerApp: {
    fontSize: fontSizes.subhead,
    color: '#888888',
    fontFamily: fonts.medium,
    marginBottom: 4,
  },
  footerCompany: {
    fontSize: fontSizes.caption,
    color: '#AAAAAA',
  },
});

const heatStyles = StyleSheet.create({
  months: {
    position: 'relative',
    marginBottom: 4,
  },
  month: {
    position: 'absolute',
    top: 0,
    fontSize: fontSizes.micro,
  },
  grid: {
    flexDirection: 'row',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendCell: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendText: {
    fontSize: fontSizes.micro,
    marginHorizontal: 2,
  },
});

const sheetStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  close: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    paddingVertical: 13,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: fontSizes.title2,
    fontFamily: fonts.semibold,
    lineHeight: 26,
  },
  stepValue: {
    minWidth: 76,
    textAlign: 'center',
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.bold,
  },
  customSave: {
    marginLeft: 'auto',
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
