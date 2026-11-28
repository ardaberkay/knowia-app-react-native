import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, TouchableOpacity, Alert, Image } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { fontSizes, fonts } from '../../theme/typography';
import { triggerHaptic } from '../../lib/hapticManager';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';
import CreateButton from '../tools/CreateButton';

/*
 * Shared form building blocks (deck, card and profile forms):
 *   useForm                 values / errors / dirty tracking / reset
 *   useUnsavedChangesGuard  asks before leaving a page with unsaved changes
 *   confirmDiscard          "discard changes?" confirm (undo button)
 *   FormHeader              create page intro: text + image, "how to" row
 *   FormCard / FormDivider  the card fields sit in, line between fields
 *   FormLabel               orange icon + title (+ counter)
 *   FormField               label + text box + counter + inline error / hint
 *   FormSelect              label + picker box (same shape as a text box)
 *   FormMessage             inline error / hint under a field
 *   OptionalSection         tinted row that opens the optional fields
 *   FormActions             full-width main button + small undo text button
 *   FORM_SIDE_PADDING       page side padding (same as the cards lists)
 *   useFieldBox             the shared text / picker box look
 */

const ACCENT = '#F98A21';
export const FORM_SIDE_PADDING = 12;
const BOX_HEIGHT = 52;
const BOX_RADIUS = 16;

const sameValue = (a, b) => (
  Array.isArray(a) || Array.isArray(b) || (a && typeof a === 'object')
    ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    : (a ?? '') === (b ?? '')
);

/**
 * Small form state: values, per-field errors and "changed since the start".
 * setValue(name, value) also clears that field's error.
 * reset(next?) goes back to the start values, or makes `next` the new start.
 */
export function useForm(initialValues) {
  const initialRef = useRef(initialValues);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: typeof value === 'function' ? value(prev[name]) : value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const reset = useCallback((next) => {
    if (next) initialRef.current = next;
    setValues(initialRef.current);
    setErrors({});
  }, []);

  const isDirty = useMemo(
    () => Object.keys({ ...initialRef.current, ...values }).some((k) => !sameValue(values[k], initialRef.current[k])),
    [values],
  );

  return { values, setValue, errors, setErrors, reset, isDirty, initialValues: initialRef.current };
}

/**
 * Asks "leave without saving?" when the page is closed (back button, swipe
 * back, any navigation) while isDirty. Returns leave(fn): runs fn with the
 * guard off, for navigating away after a successful save.
 */
export function useUnsavedChangesGuard(isDirty) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [pendingLeave, setPendingLeave] = useState(null);

  usePreventRemove(Boolean(isDirty) && !pendingLeave, ({ data }) => {
    Alert.alert(
      t('form.unsavedTitle', 'Değişiklikler kaydedilmedi'),
      t('form.unsavedMessage', 'Çıkarsan yaptığın değişiklikler kaybolacak.'),
      [
        { text: t('form.keepEditing', 'Düzenlemeye devam et'), style: 'cancel' },
        { text: t('form.discardAndLeave', 'Çık'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  // runs once the guard is off (after the re-render)
  useEffect(() => {
    if (!pendingLeave) return;
    const fn = pendingLeave.fn;
    setPendingLeave(null);
    fn();
  }, [pendingLeave]);

  return useCallback((fn) => setPendingLeave({ fn }), []);
}

/** "Discard changes?" confirm; runs onConfirm right away when nothing changed. */
export function confirmDiscard(t, isDirty, onConfirm) {
  if (!isDirty) { onConfirm(); return; }
  Alert.alert(
    t('form.discardTitle', 'Değişiklikler geri alınsın mı?'),
    t('form.discardMessage', 'Yaptığın değişiklikler silinecek.'),
    [
      { text: t('common.cancel', 'İptal'), style: 'cancel' },
      { text: t('form.discard', 'Geri Al'), style: 'destructive', onPress: onConfirm },
    ],
  );
}

/**
 * Create page intro (the title is the app bar's): text + image on the right,
 * then a "how to" row opening the guide.
 */
export function FormHeader({ text, image, onHowTo }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerBody, { color: colors.muted }]}>{text}</Text>
        {image ? <Image source={image} style={styles.headerImage} resizeMode="contain" fadeDuration={0} /> : null}
      </View>
      {onHowTo ? (
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            requestAnimationFrame(onHowTo);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.guideRow,
            { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={[styles.guideIcon, { backgroundColor: ACCENT + '26' }]}>
            <PhosphorIcon icon={ICONS.guide} size={18} color={ACCENT} />
          </View>
          <View style={styles.guideText}>
            <Text style={[styles.guideTitle, { color: colors.text }]}>{t('form.howToTitle', 'Nasıl oluşturulur?')}</Text>
            <Text style={[styles.guideSub, { color: colors.muted }]}>{t('form.howToSub', 'Adım adım kısa rehber')}</Text>
          </View>
          <PhosphorIcon icon={ICONS.chevronRight} size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The card fields sit in. */
export function FormCard({ children, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }, style]}>
      {children}
    </View>
  );
}

/**
 * Bottom of a form: one full-width main button, and under it a small text
 * button (clear / undo changes) that shows only when something changed.
 */
export function FormActions({ primaryText, onPrimary, loading = false, secondaryText, onSecondary, showSecondary = false }) {
  const { colors } = useTheme();
  return (
    <View style={styles.actions}>
      <CreateButton onPress={onPrimary} disabled={loading} loading={loading} text={primaryText} style={styles.primary} />
      {showSecondary && onSecondary ? (
        <Pressable
          onPress={onSecondary}
          disabled={loading}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.secondaryText, { color: colors.muted }]}>{secondaryText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Line between two fields in one card. */
export function FormDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />;
}

/** Orange icon + title; counter (n/max) on the right when given. */
export function FormLabel({ icon, label, counter, counterOver }) {
  const { colors } = useTheme();
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelLeft}>
        {icon ? <PhosphorIcon icon={icon} size={18} color={ACCENT} /> : null}
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
      {counter ? (
        <Text style={[styles.counter, { color: counterOver ? colors.error : colors.muted }]}>{counter}</Text>
      ) : null}
    </View>
  );
}

/** Inline message under a field: error (red) or hint (muted). */
export function FormMessage({ error, hint }) {
  const { colors } = useTheme();
  if (!error && !hint) return null;
  return (
    <Text style={[styles.message, { color: error ? colors.error : colors.muted }]}>{error || hint}</Text>
  );
}

/**
 * The shared box look (text boxes, pickers, the language field):
 * 52 high, radius 16, padding 14; focused = orange edge + a bit lighter,
 * error = red edge.
 */
export function useFieldBox({ focused = false, error = false } = {}) {
  const { colors, isDarkMode } = useTheme();
  return {
    minHeight: BOX_HEIGHT,
    borderRadius: BOX_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    borderColor: error ? colors.error : focused ? ACCENT + '80' : colors.inputBorder,
    backgroundColor: focused ? (isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)') : colors.inputBackground,
  };
}

/**
 * Label + text box + counter + inline error. The counter (n/max) shows while
 * the field is focused or close to its limit; maxLength stops typing past it.
 * secure: password field with a show / hide button. clearable: ✕ to empty it.
 */
export const FormField = forwardRef(function FormField({
  icon,
  label,
  value,
  onChangeText,
  maxLength,
  multiline = false,
  minHeight,
  error,
  hint,
  secure = false,
  clearable = true,
  editable = true,
  onFocus,
  onBlur,
  ...inputProps
}, ref) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const box = useFieldBox({ focused, error: Boolean(error) });
  const length = (value || '').length;
  const showCounter = Boolean(maxLength) && (focused || length >= maxLength * 0.8);
  const hasAccessory = secure || (clearable && editable && length > 0);

  return (
    <View style={styles.field}>
      {label ? (
        <FormLabel
          icon={icon}
          label={label}
          counter={showCounter ? `${length}/${maxLength}` : null}
          counterOver={showCounter && length >= maxLength}
        />
      ) : null}
      <View>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            box,
            {
              color: colors.text,
              paddingRight: hasAccessory ? 46 : 14,
              opacity: editable ? 1 : 0.6,
            },
            multiline && { minHeight: minHeight || BOX_HEIGHT, textAlignVertical: 'top' },
          ]}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          secureTextEntry={secure && !revealed}
          accessibilityLabel={label}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...inputProps}
        />
        {secure ? (
          <TouchableOpacity
            style={styles.accessory}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            disabled={!editable}
            accessibilityLabel={revealed ? t('form.hidePassword', 'Şifreyi gizle') : t('form.showPassword', 'Şifreyi göster')}
          >
            <PhosphorIcon icon={revealed ? ICONS.visible : ICONS.hidden} size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : clearable && editable && length > 0 ? (
          <View style={styles.accessory} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.clear, { backgroundColor: colors.iconBackground }]}
              onPress={() => onChangeText?.('')}
              hitSlop={8}
              accessibilityLabel={t('common.clear', 'Temizle')}
            >
              <PhosphorIcon icon={ICONS.close} size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <FormMessage error={error} hint={hint} />
    </View>
  );
});

/** Label + picker box (category etc.): same shape as a text box, caret on the right. */
export function FormSelect({ icon, label, valueText, valueIcon, placeholder, onPress, error, accessibilityLabel }) {
  const { colors } = useTheme();
  const box = useFieldBox({ error: Boolean(error) });
  return (
    <View style={styles.field}>
      <FormLabel icon={icon} label={label} />
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        style={[styles.select, box]}
      >
        {valueIcon ? <PhosphorIcon icon={valueIcon} size={20} color={colors.text} /> : null}
        <Text style={[styles.selectText, { color: valueText ? colors.text : colors.muted }]} numberOfLines={1}>
          {valueText || placeholder}
        </Text>
        <PhosphorIcon icon={ICONS.dropdown} size={18} color={colors.muted} />
      </TouchableOpacity>
      <FormMessage error={error} />
    </View>
  );
}

/**
 * Tinted row that opens / closes the optional fields under it (instant).
 * Right side: "Opsiyonel", or "n dolu" when closed with values inside.
 */
export function OptionalSection({ title, expanded, onToggle, filledCount = 0, children }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const side = !expanded && filledCount > 0
    ? t('form.filledCount', { count: filledCount, defaultValue: `${filledCount} dolu` })
    : t('create.optional', 'Opsiyonel');
  return (
    <View style={styles.optional}>
      <Pressable
        onPress={() => { triggerHaptic('selection'); onToggle(); }}
        style={({ pressed }) => [styles.optionalRow, { backgroundColor: ACCENT + '14', opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={[styles.optionalTitle, { color: ACCENT }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.optionalSide, { color: colors.muted }]}>{side}</Text>
        <PhosphorIcon icon={ICONS.dropdown} size={16} color={colors.muted} style={expanded ? styles.caretUp : null} />
      </Pressable>
      {expanded ? <View style={styles.optionalBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', maxWidth: 440, paddingTop: 4, paddingBottom: 14, gap: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  headerBody: { flex: 1, fontSize: fontSizes.subhead, fontFamily: fonts.regular, lineHeight: 22, paddingRight: 12 },
  headerImage: { width: 132, height: 132 },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guideIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  guideText: { flex: 1 },
  guideTitle: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  guideSub: { fontSize: fontSizes.caption, fontFamily: fonts.regular, marginTop: 1 },

  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },

  field: { width: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 20 },
  labelLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  label: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  counter: { fontSize: fontSizes.caption, fontFamily: fonts.medium },
  input: { paddingVertical: 14, fontSize: fontSizes.body, fontFamily: fonts.regular },
  accessory: { position: 'absolute', right: 12, top: 0, height: BOX_HEIGHT, justifyContent: 'center' },
  clear: { padding: 4, borderRadius: 10 },
  message: { fontSize: fontSizes.footnote, fontFamily: fonts.medium, marginTop: 6, marginLeft: 4 },

  select: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectText: { flex: 1, fontSize: fontSizes.body, fontFamily: fonts.regular },

  actions: { width: '100%', maxWidth: 440, marginTop: 12, alignItems: 'center' },
  primary: { flex: 0, alignSelf: 'stretch' },
  secondary: { paddingVertical: 14, paddingHorizontal: 16 },
  secondaryText: { fontSize: fontSizes.subhead, fontFamily: fonts.semibold },

  optional: { marginTop: 18 },
  optionalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: BOX_RADIUS, paddingHorizontal: 14 },
  optionalTitle: { flex: 1, fontSize: fontSizes.subhead, fontFamily: fonts.semibold },
  optionalSide: { fontSize: fontSizes.caption, fontFamily: fonts.medium },
  caretUp: { transform: [{ rotate: '180deg' }] },
  optionalBody: { paddingTop: 18, gap: 18 },
});
