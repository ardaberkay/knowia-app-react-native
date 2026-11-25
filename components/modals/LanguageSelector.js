import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';

import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';
// Lists open at half height and drag up to full (iOS medium/large detents,
// Android partial/expanded).
const LIST_SNAP_POINTS = ['50%', '100%'];

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { triggerHaptic } from '../../lib/hapticManager';


export default function LanguageSelector({ isVisible, onClose, onLanguageChange }) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const { colors, isDarkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const selectedLanguage = i18n.language;

  // Bottom Sheet Referansı
  const bottomSheetModalRef = useRef(null);

  // Marka Rengi Fallback
  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';

  const languages = useMemo(() => [
    { code: 'tr', name: 'Türkçe', icon: 'twemoji:flag-for-flag-turkey' },
    { code: 'en', name: 'English', icon: 'twemoji:flag-england' },
    { code: 'es', name: 'Spanish', icon: 'twemoji:flag-spain' },
    { code: 'fr', name: 'French', icon: 'twemoji:flag-france' },
    { code: 'pt', name: 'Portuguese', icon: 'twemoji:flag-portugal' },
    { code: 'de', name: 'German', icon: 'twemoji:flag-germany' },
  ], []);

  // --- MODAL GÖRÜNÜRLÜK KONTROLÜ ---
  useEffect(() => {
    if (isVisible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  // --- PERFORMANS ODAKLI SEÇİM YÖNETİMİ ---
  const handleLanguageSelect = async (languageCode) => {
    if (selectedLanguage !== languageCode) {
      triggerHaptic('selection');
      
      // Takılmayı önlemek ve BottomSheet'in yumuşak kapanmasını sağlamak için ufak gecikme
      setTimeout(async () => {
        await onLanguageChange(languageCode);
      }, 50);
    }
  };

  // FlatList için Satır Render Fonksiyonu
  const renderItem = useCallback(({ item: language }) => {
    const isSelected = selectedLanguage === language.code;
    
    return (
      <TouchableOpacity
        style={[
          styles.languageCard,
          {
            backgroundColor: isSelected ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
            borderColor: isSelected ? primaryColor : 'transparent',
          }
        ]}
        onPress={() => handleLanguageSelect(language.code)}
        disabled={isSelected} // Seçili olana tekrar basılmasını engeller
        activeOpacity={0.8}
      >
        <View style={styles.iconWrapper}>
          <Iconify icon={language.icon} size={28} />
        </View>
        <Text style={[
          styles.languageText,
          { 
            color: isSelected ? primaryColor : colors.text,
            fontWeight: isSelected ? '700' : '500'
          }
        ]}>
          {language.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedLanguage, isDarkMode, primaryColor, colors.text]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      onChange={(index) => index === -1 && onClose()}
      backgroundStyle={{ backgroundColor: colors.background, borderRadius: 44 }}
      snapPoints={LIST_SNAP_POINTS}
      enablePanDownToClose
    >
      
      {/* --- SABİT HEADER BÖLÜMÜ --- */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('profile.language')}
          </Text>
          <TouchableOpacity 
            onPress={() => bottomSheetModalRef.current?.dismiss()} 
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- KAYDIRILABİLİR LİSTE --- */}
      <BottomSheetFlatList
        data={languages}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        bounces={true}
        style={{ flex: 1 }}
      />
      
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
    gap: 12,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconWrapper: {
    marginRight: 14,
  },
  languageText: {
    fontSize: 16,
  },
});