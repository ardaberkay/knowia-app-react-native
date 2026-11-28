import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Text, TextInput } from '../ui/AppText';

import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../lib/hapticManager';
import {
  languageCode,
  languageNativeName,
  languageEnglishName,
  sortLanguagesForPicker,
  filterLanguages,
} from '../../services/LanguageService';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';
import { useFieldBox } from '../layout/FormField';


// Code badge ("JA") instead of a flag: languages aren't countries, and there
// are far more languages than flag icons we'd want to bundle.
function LanguageCodeBadge({ language, size = 'md', active = false }) {
  const { colors, isDarkMode } = useTheme();
  const small = size === 'sm';
  return (
    <View
      style={[
        badgeStyles.badge,
        small && badgeStyles.badgeSm,
        {
          backgroundColor: active
            ? colors.buttonColor
            : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'),
        },
      ]}
    >
      <Text
        style={[badgeStyles.text, small && badgeStyles.textSm, { color: active ? '#FFFFFF' : colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {languageCode(language)}
      </Text>
    </View>
  );
}

/**
 * Deck language picker.
 *
 * `selectedLanguage` is an ORDERED id array: [front] or [front, back]. The
 * first pick is the card front, the second the back. Leaving the back empty
 * means both faces use the front language. The order is what DeckService
 * stores as decks_languages.side.
 *
 * `onChange(newIds)` receives the whole new array (pick, remove, swap).
 */
export default function DeckLanguageModal({
  isVisible,
  onClose,
  languages = [],
  selectedLanguage,
  onChange,
  // Optional header overrides (the swipe screen reuses this as the reading
  // language picker). example={null} hides the example line.
  title,
  subtitle,
  example,
}) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const bottomSheetModalRef = useRef(null);
  const [localSelected, setLocalSelected] = useState([]);
  const [query, setQuery] = useState('');

  // App language first, then the original 7, then A-Z; the search box
  // matches native name, English name or code.
  const sortedLanguages = useMemo(
    () => sortLanguagesForPicker(languages, i18n.language),
    [languages, i18n.language]
  );
  const visibleLanguages = useMemo(
    () => filterLanguages(sortedLanguages, query, t),
    [sortedLanguages, query, t]
  );

  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';
  const neutralBorder = isDarkMode ? '#3A3A3A' : '#E4E4E4';
  const neutralFill = isDarkMode ? '#2A2A2A' : '#F5F5F5';

  useEffect(() => {
    if (isVisible) {
      setLocalSelected(selectedLanguage || []);
      setQuery('');
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible, selectedLanguage]);

  // Update locally right away; tell the parent a beat later so the sheet's
  // own re-render isn't blocked by the screen's.
  const commit = (next) => {
    setLocalSelected(next);
    setTimeout(() => onChange?.(next), 50);
  };

  const handleToggle = (languageId) => {
    if (localSelected.includes(languageId)) {
      triggerHaptic('selection');
      commit(localSelected.filter((id) => id !== languageId));
    } else if (localSelected.length >= 2) {
      triggerHaptic('error');
    } else {
      triggerHaptic('selection');
      commit([...localSelected, languageId]);
    }
  };

  const handleSwap = () => {
    if (localSelected.length < 2) return;
    triggerHaptic('selection');
    commit([localSelected[1], localSelected[0]]);
  };

  const byId = (id) => languages.find((l) => l.id === id);
  const front = byId(localSelected[0]);
  const back = byId(localSelected[1]);
  const isFull = localSelected.length >= 2;

  // One face "slot". The slot the next tap will fill is outlined in the accent
  // colour so it's clear what is being picked; a filled slot clears on tap.
  const renderSlot = (label, language, isNext, emptyText) => (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!language}
      onPress={() => language && handleToggle(language.id)}
      style={[
        styles.slot,
        {
          backgroundColor: language ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}12`) : neutralFill,
          borderColor: isNext || language ? primaryColor : neutralBorder,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={language ? `${label}: ${languageNativeName(language, t)}` : `${label}: ${emptyText}`}
    >
      <Text style={[styles.slotLabel, { color: language || isNext ? primaryColor : colors.muted }]}>
        {label}
      </Text>
      {language ? (
        <View style={styles.slotValueRow}>
          <LanguageCodeBadge language={language} size="sm" />
          <Text style={[styles.slotValue, { color: colors.text }]} numberOfLines={1}>
            {languageNativeName(language, t)}
          </Text>
          <PhosphorIcon icon={ICONS.close} size={16} color={colors.muted} />
        </View>
      ) : (
        <Text style={[styles.slotPlaceholder, { color: colors.muted }]} numberOfLines={2}>
          {emptyText}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderItem = useCallback(({ item: language }) => {
    const index = localSelected.indexOf(language.id);
    const isChecked = index !== -1;
    const isDisabled = !isChecked && isFull;

    return (
      <TouchableOpacity
        onPress={() => handleToggle(language.id)}
        activeOpacity={0.8}
        style={[
          styles.languageCard,
          {
            backgroundColor: isChecked ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : neutralFill,
            borderColor: isChecked ? primaryColor : 'transparent',
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={styles.iconWrapper}>
            <LanguageCodeBadge language={language} active={isChecked} />
          </View>
          <View style={styles.nameColumn}>
            <Text style={[styles.languageName, { color: isChecked ? primaryColor : colors.text, fontFamily: isChecked ? fonts.bold : fonts.medium }]} numberOfLines={1}>
              {languageNativeName(language, t)}
            </Text>
            {languageEnglishName(language) ? (
              <Text style={[styles.languageEnglish, { color: colors.muted }]} numberOfLines={1}>
                {languageEnglishName(language)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Selected rows say which face they are instead of a plain tick. */}
        {isChecked ? (
          <View style={[styles.sidePill, { backgroundColor: primaryColor }]}>
            <Text style={styles.sidePillText}>
              {index === 0 ? t('create.languageFront', 'Ön yüz') : t('create.languageBack', 'Arka yüz')}
            </Text>
          </View>
        ) : (
          <View style={[styles.radioCircle, { borderColor: isDarkMode ? '#555' : '#CCC' }]} />
        )}
      </TouchableOpacity>
    );
    // handleToggle only reads localSelected, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSelected, isFull, colors.text, isDarkMode, primaryColor, neutralFill, t]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      onChange={(index) => index === -1 && onClose()}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      enablePanDownToClose
    >
      <View style={{ height: Math.round(SCREEN_HEIGHT * 0.75) }}>
      {/* --- SABİT HEADER BÖLÜMÜ --- */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[typography.styles.title2, { color: colors.text }]}>{title ?? t('create.languageHeading')}</Text>
            <Text style={[styles.infoText, { color: isDarkMode ? '#aaa' : '#666' }]}>{subtitle ?? t('create.languageSub')}</Text>
          </View>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <PhosphorIcon icon={ICONS.close} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Front / back slots with a swap button between them */}
        <View style={styles.slotsRow}>
          {renderSlot(
            t('create.languageFront', 'Ön yüz'),
            front,
            !front,
            t('create.languagePick', 'Dil seç')
          )}
          <TouchableOpacity
            onPress={handleSwap}
            disabled={!isFull}
            activeOpacity={0.7}
            style={[styles.swapButton, { backgroundColor: neutralFill, opacity: isFull ? 1 : 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel={t('create.languageSwap', 'Yerlerini değiştir')}
          >
            <PhosphorIcon icon={ICONS.pair} size={20} color={isFull ? primaryColor : colors.muted} />
          </TouchableOpacity>
          {renderSlot(
            t('create.languageBack', 'Arka yüz'),
            back,
            !!front && !back,
            t('create.languageBackEmpty', 'İsteğe bağlı')
          )}
        </View>

        {example === null ? null : (
          <Text style={[styles.exampleText, { color: colors.muted }]}>
            {example ?? t('create.languageExample', 'Örnek: ön yüz İngilizce “apple”, arka yüz Türkçe “elma”')}
          </Text>
        )}

        <View style={[styles.searchBox, { backgroundColor: neutralFill }]}>
          <PhosphorIcon icon={ICONS.search} size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('create.languageSearch', 'Dil ara')}
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>

      {/* --- KAYDIRILABİLİR LİSTE --- */}
      <BottomSheetFlatList
        data={visibleLanguages}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        extraData={localSelected}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        bounces={true}
        style={{ flexGrow: 0, flexShrink: 1 }}
      />
      </View>
    </BottomSheetModal>
  );
}

/**
 * The deck language field shown on the create / edit screens: front → back
 * with face labels, plus a swap button when two languages are picked.
 * Tapping the field opens the picker (`onPress`).
 */
export function DeckLanguageField({ languages = [], selectedLanguage = [], onPress, onSwap, error = false }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const box = useFieldBox({ error }); // same box as the form's text fields
  const primaryColor = colors.buttonColor || '#F98A21';

  const picked = selectedLanguage
    .map((id) => languages.find((l) => l.id === id))
    .filter(Boolean);
  const [front, back] = picked;

  const renderFace = (label, language) => (
    <View style={fieldStyles.face}>
      <Text style={[fieldStyles.faceLabel, { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      <View style={fieldStyles.faceValueRow}>
        <LanguageCodeBadge language={language} size="sm" />
        <Text style={[fieldStyles.faceValue, typography.styles.body, { color: colors.text }]} numberOfLines={1}>
          {languageNativeName(language, t)}
        </Text>
      </View>
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[fieldStyles.field, box]}
      accessibilityRole="button"
      accessibilityLabel={t('create.selectLanguage', 'Dil seç')}
    >
      {!front ? (
        <Text style={[fieldStyles.placeholder, typography.styles.body, { color: colors.muted }]}>
          {t('create.selectLanguage', 'Dil seç')}
        </Text>
      ) : back ? (
        <View style={fieldStyles.pairRow}>
          {renderFace(t('create.languageFront', 'Ön yüz'), front)}
          <PhosphorIcon icon={ICONS.arrowRight} size={18} color={colors.muted} />
          {renderFace(t('create.languageBack', 'Arka yüz'), back)}
        </View>
      ) : (
        <View style={fieldStyles.pairRow}>
          {renderFace(t('create.languageBoth', 'Ön ve arka yüz'), front)}
        </View>
      )}

      {back ? (
        <TouchableOpacity
          onPress={onSwap}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[fieldStyles.swapButton, { backgroundColor: `${primaryColor}18` }]}
          accessibilityRole="button"
          accessibilityLabel={t('create.languageSwap', 'Yerlerini değiştir')}
        >
          <PhosphorIcon icon={ICONS.pair} size={20} color={primaryColor} />
        </TouchableOpacity>
      ) : (
        <PhosphorIcon icon={ICONS.dropdown} size={18} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  infoText: {
    fontSize: fontSizes.footnote,
    lineHeight: 18,
    marginTop: 4,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slot: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  slotLabel: {
    ...typography.styles.subhead,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: fontSizes.micro,
    marginBottom: 4,
  },
  slotValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotValue: {
    flex: 1,
    fontSize: fontSizes.body,
    fontFamily: fonts.semibold,
  },
  slotPlaceholder: {
    fontSize: fontSizes.footnote,
    lineHeight: 17,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleText: {
    fontSize: fontSizes.caption,
    lineHeight: 16,
    marginTop: 10,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 12,
  },
  iconWrapper: {
    marginRight: 14,
  },
  nameColumn: {
    flexShrink: 1,
  },
  languageName: {
    fontSize: fontSizes.body,
  },
  languageEnglish: {
    fontSize: fontSizes.caption,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.body,
    paddingVertical: 0,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  sidePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  sidePillText: {
    color: '#FFFFFF',
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
  },
});

const fieldStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  placeholder: {
    flex: 1,
  },
  pairRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  face: {
    flexShrink: 1,
  },
  faceLabel: {
    fontSize: fontSizes.micro,
    fontFamily: fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  faceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  faceValue: {
    flexShrink: 1,
  },
  swapButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const badgeStyles = StyleSheet.create({
  badge: {
    minWidth: 40,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    minWidth: 30,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  text: {
    fontSize: fontSizes.footnote,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: fontSizes.micro,
  },
});
