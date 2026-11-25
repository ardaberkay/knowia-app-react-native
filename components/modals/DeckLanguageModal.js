import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity as RNTouchableOpacity, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';

// GORHOM BİLEŞENLERİ
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  TouchableOpacity,
} from '@gorhom/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { triggerHaptic } from '../../lib/hapticManager';


// Flag per languages.sort_order (icons listed in babel.config.js).
export const LANGUAGE_FLAG_ICONS = {
  1: 'twemoji:flag-for-flag-turkey', 2: 'twemoji:flag-england', 3: 'twemoji:flag-germany',
  4: 'twemoji:flag-spain', 5: 'twemoji:flag-france', 6: 'twemoji:flag-portugal',
  7: 'twemoji:flag-saudi-arabia',
};
const flagFor = (language) => LANGUAGE_FLAG_ICONS[language?.sort_order] || LANGUAGE_FLAG_ICONS[1];

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
}) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const bottomSheetModalRef = useRef(null);
  const [localSelected, setLocalSelected] = useState([]);

  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';
  const neutralBorder = isDarkMode ? '#3A3A3A' : '#E4E4E4';
  const neutralFill = isDarkMode ? '#2A2A2A' : '#F5F5F5';

  useEffect(() => {
    if (isVisible) {
      setLocalSelected(selectedLanguage || []);
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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" opacity={0.5} />,
    []
  );

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
      accessibilityLabel={language ? `${label}: ${t(`languages.${language.sort_order}`)}` : `${label}: ${emptyText}`}
    >
      <Text style={[styles.slotLabel, { color: language || isNext ? primaryColor : colors.muted }]}>
        {label}
      </Text>
      {language ? (
        <View style={styles.slotValueRow}>
          <Iconify icon={flagFor(language)} size={20} />
          <Text style={[styles.slotValue, { color: colors.text }]} numberOfLines={1}>
            {t(`languages.${language.sort_order}`)}
          </Text>
          <Iconify icon="material-symbols:close-rounded" size={16} color={colors.muted} />
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
            <Iconify icon={flagFor(language)} size={28} />
          </View>
          <Text style={[styles.languageName, { color: isChecked ? primaryColor : colors.text, fontWeight: isChecked ? '700' : '500' }]}>
            {t(`languages.${language.sort_order}`)}
          </Text>
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
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background, borderRadius: 44 }}
      handleIndicatorStyle={{ backgroundColor: isDarkMode ? '#555' : '#CCC' }}
      enableDynamicSizing={true}
      maxDynamicContentSize={SCREEN_HEIGHT * 0.85}
      enableContentPanningGesture={false}
    >
      {/* --- SABİT HEADER BÖLÜMÜ --- */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[typography.styles.h2, { color: colors.text }]}>{t('create.languageHeading')}</Text>
            <Text style={[styles.infoText, { color: isDarkMode ? '#aaa' : '#666' }]}>{t('create.languageSub')}</Text>
          </View>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
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
            <Iconify icon="material-symbols:swap-horiz-rounded" size={20} color={isFull ? primaryColor : colors.muted} />
          </TouchableOpacity>
          {renderSlot(
            t('create.languageBack', 'Arka yüz'),
            back,
            !!front && !back,
            t('create.languageBackEmpty', 'Ön yüzle aynı · isteğe bağlı')
          )}
        </View>

        <Text style={[styles.exampleText, { color: colors.muted }]}>
          {t('create.languageExample', 'Örnek: ön yüz İngilizce “apple”, arka yüz Türkçe “elma”')}
        </Text>
      </View>

      {/* --- KAYDIRILABİLİR LİSTE --- */}
      <BottomSheetFlatList
        data={languages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        extraData={localSelected}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        bounces={true}
        style={{ flex: 1 }}
      />
    </BottomSheetModal>
  );
}

/**
 * The deck language field shown on the create / edit screens: front → back
 * with face labels, plus a swap button when two languages are picked.
 * Tapping the field opens the picker (`onPress`).
 */
export function DeckLanguageField({ languages = [], selectedLanguage = [], onPress, onSwap }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const primaryColor = colors.buttonColor || '#F98A21';

  const picked = selectedLanguage
    .map((id) => languages.find((l) => l.id === id))
    .filter(Boolean);
  const [front, back] = picked;

  const renderFace = (label, language) => (
    <View style={fieldStyles.face}>
      <Text style={[fieldStyles.faceLabel, { color: colors.muted }]} numberOfLines={1}>{label}</Text>
      <View style={fieldStyles.faceValueRow}>
        <Iconify icon={flagFor(language)} size={18} />
        <Text style={[fieldStyles.faceValue, typography.styles.body, { color: colors.text }]} numberOfLines={1}>
          {t(`languages.${language.sort_order}`)}
        </Text>
      </View>
    </View>
  );

  return (
    <RNTouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[fieldStyles.field, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
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
          <Iconify icon="material-symbols:arrow-forward-rounded" size={18} color={colors.muted} />
          {renderFace(t('create.languageBack', 'Arka yüz'), back)}
        </View>
      ) : (
        <View style={fieldStyles.pairRow}>
          {renderFace(t('create.languageBoth', 'Ön ve arka yüz'), front)}
        </View>
      )}

      {back ? (
        <RNTouchableOpacity
          onPress={onSwap}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[fieldStyles.swapButton, { backgroundColor: `${primaryColor}18` }]}
          accessibilityRole="button"
          accessibilityLabel={t('create.languageSwap', 'Yerlerini değiştir')}
        >
          <Iconify icon="material-symbols:swap-horiz-rounded" size={20} color={primaryColor} />
        </RNTouchableOpacity>
      ) : (
        <Iconify icon="flowbite:caret-down-solid" size={20} color={colors.muted} />
      )}
    </RNTouchableOpacity>
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
    fontSize: 13,
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
    ...typography.styles.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
    marginBottom: 4,
  },
  slotValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  slotPlaceholder: {
    fontSize: 13,
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
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 60,
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
  },
  iconWrapper: {
    marginRight: 14,
  },
  languageName: {
    fontSize: 16,
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
    fontSize: 12,
    fontWeight: '700',
  },
});

const fieldStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
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
    fontSize: 11,
    fontWeight: '600',
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
