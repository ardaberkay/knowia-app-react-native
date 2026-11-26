import React, { useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Text } from '../ui/AppText';

import { BottomSheetModal, BottomSheetFlatList } from '@expo/ui/community/bottom-sheet';

import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../ui/CircularProgress';
import { triggerHaptic } from '../../lib/hapticManager';


export default function ChapterSelector({
  isVisible,
  onClose,
  chapters = [],
  selectedChapterId,
  onSelectChapter,
  progressMap = null // Optional: Map with chapter progress data
}) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
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
            borderWidth: isSelected ? 2 : 1,
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
              size={22}
              color={colors.buttonColor}
              style={{ marginRight: 8 }}
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
              size={78}
              strokeWidth={9}
              showText={true}
              shouldAnimate={true}
              fullCircle={true}
              textStyle={{ fontSize: fontSizes.body, fontFamily: fonts.bold, color: colors.text }}
            />
          </View>

          <View style={styles.statsContainer}>
            {/* Learning */}
            <View style={styles.statRow}>
              <Iconify icon="mdi:fire" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                {t('chapters.learning', 'Learning')}: {learningCount}
              </Text>
            </View>

            {/* Learned */}
            <View style={styles.statRow}>
              <Iconify icon="dashicons:welcome-learn-more" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
              <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                {t('chapters.learned', 'Learned')}: {chapterProgress.learned}
              </Text>
            </View>

            {/* Total */}
            <View style={styles.statRow}>
              <Iconify icon="ri:stack-fill" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
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
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      enablePanDownToClose
    >
      <View style={{ maxHeight: Math.round(SCREEN_HEIGHT * 0.75) }}>
      {/* --- SABİT HEADER BÖLÜMÜ --- */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={24} color={colors.buttonColor} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.title2, { color: colors.text }]}>
              {t('chapterCards.selectChapter', 'Bölüm Seç')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => bottomSheetModalRef.current?.dismiss()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
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
        style={{ flexGrow: 0, flexShrink: 1 }}
      />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
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
    paddingBottom: 24,
  },
  chapterItem: {
    flexDirection: 'column',
    padding: 20,
    borderRadius: 28, // 40'tan biraz küçülttüm, daha modern durması için
    marginBottom: 16,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chapterTitle: {
    fontSize: fontSizes.bodyLarge,
    fontFamily: fonts.semibold,
  },
  chapterDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
    opacity: 0.3,
  },
  chapterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  progressContainer: {
    marginRight: 8,
  },
  statsContainer: {
    flex: 1,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: fontSizes.body,
  },
  emptyChapters: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyChaptersText: {
    fontSize: fontSizes.body,
  },
});