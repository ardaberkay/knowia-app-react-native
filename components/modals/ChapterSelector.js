import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

// GORHOM BİLEŞENLERİ
import { 
  BottomSheetModal, 
  BottomSheetFlatList, 
  BottomSheetBackdrop 
} from '@gorhom/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../ui/CircularProgress';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';

const SCREEN_HEIGHT = Dimensions.get('screen').height;

export default function ChapterSelector({
  isVisible,
  onClose,
  chapters = [],
  selectedChapterId,
  onSelectChapter,
  progressMap = null // Optional: Map with chapter progress data
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  
  // Bottom Sheet Referansı
  const bottomSheetModalRef = useRef(null);

  // --- MODAL GÖRÜNÜRLÜK KONTROLÜ ---
  useEffect(() => {
    if (isVisible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  // Arka plan (Backdrop) ayarı
  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop 
        {...props} 
        disappearsOnIndex={-1} 
        appearsOnIndex={0} 
        pressBehavior="close" 
        opacity={0.5} 
      />
    ),
    []
  );

  // --- PERFORMANS ODAKLI SEÇİM YÖNETİMİ ---
  const handleSelectChapter = (chapterId) => {
    if (selectedChapterId !== chapterId) {
      triggerHaptic('selection');
      
      // BottomSheet kapanırken ana sayfanın render takılmasını önlemek için 50ms avans
      setTimeout(() => {
        if (onSelectChapter) onSelectChapter(chapterId);
      }, 50);
    }
  };

  // --- LİSTE ELEMANI RENDER FONKSİYONU ---
  const renderItem = useCallback(({ item: chapter, index }) => {
    const isSelected = selectedChapterId === chapter.id;
    const chapterProgress = progressMap?.get(chapter.id) || { total: 0, learned: 0, learning: 0, progress: 0 };
    const learningCount = chapterProgress.learning || 0;

    return (
      <TouchableOpacity
        style={[
          styles.chapterItem,
          {
            backgroundColor: colors.cardBackground,
            borderColor: isSelected ? colors.buttonColor : colors.cardBorder,
            borderWidth: isSelected ? moderateScale(2) : moderateScale(1),
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }
        ]}
        onPress={() => handleSelectChapter(chapter.id)}
        activeOpacity={0.8}
        disabled={isSelected} // Zaten seçili olan bölümü tekrar seçmeyi engeller
      >
        
        {/* Chapter Header */}
        <View style={styles.chapterHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Iconify
              icon="streamline-freehand:plugin-jigsaw-puzzle"
              size={moderateScale(22)}
              color={colors.buttonColor}
              style={{ marginRight: scale(8) }}
            />
            <Text style={[typography.styles.body, styles.chapterTitle, { color: colors.text }]}>
              {t('chapters.chapter', 'Bölüm')} {index + 1}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.chapterDivider, { backgroundColor: colors.border }]} />

        {/* Progress and Stats Section */}
        <View style={styles.chapterContent}>
          <View style={styles.progressContainer}>
            <CircularProgress
              progress={chapterProgress?.progress || 0}
              size={scale(78)}
              strokeWidth={moderateScale(9)}
              showText={true}
              shouldAnimate={true}
              fullCircle={true}
              textStyle={{ fontSize: moderateScale(16), fontWeight: '900', color: colors.text }}
            />
          </View>

          <View style={styles.statsContainer}>
            {/* Learning */}
            <View style={styles.statRow}>
              <Iconify icon="mdi:fire" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
              <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                {t('chapters.learning', 'Learning')}: {learningCount}
              </Text>
            </View>

            {/* Learned */}
            <View style={styles.statRow}>
              <Iconify icon="dashicons:welcome-learn-more" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
              <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                {t('chapters.learned', 'Learned')}: {chapterProgress.learned}
              </Text>
            </View>

            {/* Total */}
            <View style={styles.statRow}>
              <Iconify icon="ri:stack-fill" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
              <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                {t('chapters.total', 'Total')}: {chapterProgress.total}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedChapterId, progressMap, colors, t]);

  // --- BOŞ LİSTE GÖRÜNÜMÜ ---
  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyChapters}>
      <Text style={[styles.emptyChaptersText, { color: colors.subtext || colors.muted }]}>
        {t('chapterCards.noChapters', 'Henüz bölüm yok')}
      </Text>
    </View>
  ), [colors, t]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={moderateScale(24)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
            <Text style={[typography.styles.h2, { color: colors.text }]}>
              {t('chapterCards.selectChapter', 'Bölüm Seç')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => bottomSheetModalRef.current?.dismiss()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- KAYDIRILABİLİR PERFORMANSLI LİSTE --- */}
      {/* Bölümler (Chapters) çok fazla olabileceği ve içerik (CircularProgress vb.) ağır olduğu için FlatList kullandık */}
      <BottomSheetFlatList
        data={chapters}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyComponent}
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
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  listContainer: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(60), 
  },
  chapterItem: {
    flexDirection: 'column',
    padding: scale(20),
    borderRadius: moderateScale(28), // 40'tan biraz küçülttüm, daha modern durması için
    marginBottom: verticalScale(16),
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
  },
  chapterTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
  },
  chapterDivider: {
    height: moderateScale(1),
    width: '100%',
    marginBottom: verticalScale(16),
    opacity: 0.3,
  },
  chapterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  progressContainer: {
    marginRight: scale(8),
  },
  statsContainer: {
    flex: 1,
    gap: verticalScale(8),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: moderateScale(15),
  },
  emptyChapters: {
    minHeight: verticalScale(160),
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: verticalScale(60),
  },
  emptyChaptersText: {
    fontSize: moderateScale(16),
  },
});