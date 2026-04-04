import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

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
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { Iconify } from 'react-native-iconify';
import { triggerHaptic } from '../../lib/hapticManager';

const SCREEN_HEIGHT = Dimensions.get('screen').height;

export default function DeckLanguageModal({
  isVisible,
  onClose,
  languages = [],
  selectedLanguage,
  onSelectLanguage,
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const bottomSheetModalRef = useRef(null);

  // Sadece seçimleri tutan tek bir state kaldı
  const [localSelected, setLocalSelected] = useState([]);

  const primaryColor = colors.buttonColor || colors.primary || '#F98A21';

  // --- MODAL GÖRÜNÜRLÜK KONTROLÜ ---
  useEffect(() => {
    if (isVisible) {
      setLocalSelected(selectedLanguage || []);
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible, selectedLanguage]);

  // --- PERFORMANS ODAKLI SEÇİM YÖNETİMİ ---
  const handleToggle = (languageId) => {
    const isCurrentlySelected = localSelected.includes(languageId);

    if (isCurrentlySelected) {
      // Seçimi kaldır
      const newList = localSelected.filter(id => id !== languageId);
      setLocalSelected(newList);
      
      // Takılmayı önlemek için 50ms avans
      setTimeout(() => {
        onSelectLanguage(languageId);
      }, 50);
    } else {
      // Yeni seçim ekle
      if (localSelected.length >= 2) {
        // Limit aşıldı! Ekranda hata gösterme, sadece sert titreşim ver.
        triggerHaptic('error');
      } else {
        const newList = [...localSelected, languageId];
        setLocalSelected(newList);
        
        // Takılmayı önlemek için 50ms avans
        setTimeout(() => {
          onSelectLanguage(languageId);
        }, 50);
      }
    }
  };

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" opacity={0.5} />,
    []
  );

  const renderItem = useCallback(({ item: language }) => {
    const isChecked = localSelected.includes(language.id);
    const flagIcons = {
      1: 'twemoji:flag-for-flag-turkey', 2: 'twemoji:flag-england', 3: 'twemoji:flag-germany',
      4: 'twemoji:flag-spain', 5: 'twemoji:flag-france', 6: 'twemoji:flag-portugal',
      7: 'twemoji:flag-saudi-arabia',
    };

    return (
      <TouchableOpacity
        onPress={() => {
          // Eğer 2'den az seçim varsa veya var olanı kaldırıyorsa normal titreşim ver
          if (localSelected.length < 2 || isChecked) {
             triggerHaptic('selection');
          }
          handleToggle(language.id);
        }}
        activeOpacity={0.8}
        style={[
          styles.languageCard,
          {
            backgroundColor: isChecked ? (isDarkMode ? `${primaryColor}20` : `${primaryColor}15`) : (isDarkMode ? '#2A2A2A' : '#F5F5F5'),
            borderColor: isChecked ? primaryColor : 'transparent',
          }
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={styles.iconWrapper}>
            <Iconify icon={flagIcons[language.sort_order] || flagIcons[1]} size={moderateScale(28)} />
          </View>
          <Text style={[styles.languageName, { color: isChecked ? primaryColor : colors.text, fontWeight: isChecked ? '700' : '500' }]}>
            {t(`languages.${language.sort_order}`)}
          </Text>
        </View>

        <View style={[styles.radioCircle, { borderColor: isChecked ? primaryColor : (isDarkMode ? '#555' : '#CCC'), backgroundColor: isChecked ? primaryColor : 'transparent' }]}>
          <View style={{ opacity: isChecked ? 1 : 0 }}>
            <Iconify icon="hugeicons:tick-01" size={moderateScale(20)} color="#FFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [localSelected, colors.text, isDarkMode, primaryColor, t]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      onChange={(index) => index === -1 && onClose()}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.background, borderRadius: moderateScale(44) }}
      handleIndicatorStyle={{ backgroundColor: isDarkMode ? '#555' : '#CCC' }}
      enableDynamicSizing={true}
      maxDynamicContentSize={SCREEN_HEIGHT * 0.85}
      enableContentPanningGesture={false}
    >
      {/* --- SABİT HEADER BÖLÜMÜ --- */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.styles.h2, { color: colors.text }]}>{t('create.languageHeading')}</Text>
            <Text style={[styles.infoText, { color: isDarkMode ? '#aaa' : '#666' }]}>{t('create.languageSub')}</Text>
          </View>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- KAYDIRILABİLİR LİSTE --- */}
      <BottomSheetFlatList
        data={languages}
        keyExtractor={(item) => item.id.toString()}
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
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  closeButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  infoText: { 
    fontSize: moderateScale(13), 
    marginTop: verticalScale(2) 
  },
  listContainer: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(60),
    gap: verticalScale(12),
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
  },
  cardLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconWrapper: { 
    marginRight: scale(14) 
  },
  languageName: { 
    fontSize: moderateScale(16) 
  },
  radioCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});