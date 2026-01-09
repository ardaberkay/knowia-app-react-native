import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import CircularProgress from '../ui/CircularProgress';

export default function ChapterSelector({ 
  isVisible, 
  onClose, 
  chapters = [], 
  selectedChapterId, 
  onSelectChapter,
  progressMap = null // Optional: Map with chapter progress data
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      statusBarTranslucent={true}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('chapterCards.selectChapter', 'Bölüm Seç')}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Iconify icon="material-symbols:close-rounded" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
          {chapters.length === 0 ? (
            <View style={styles.emptyChapters}>
              <Text style={[styles.emptyChaptersText, { color: colors.subtext || colors.muted }]}>
                {t('chapterCards.noChapters', 'Henüz bölüm yok')}
              </Text>
            </View>
          ) : (
            chapters.map((chapter, index) => {
              const isSelected = selectedChapterId === chapter.id;
              const chapterProgress = progressMap?.get(chapter.id) || { total: 0, learned: 0, learning: 0, progress: 0 };
              const learningCount = chapterProgress.learning || 0;
              
              return (
                <TouchableOpacity
                  key={chapter.id?.toString() || index}
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
                  onPress={() => onSelectChapter && onSelectChapter(chapter.id)}
                  activeOpacity={0.8}
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
                        shouldAnimate={false}
                        fullCircle={true}
                        textStyle={{ fontSize: 16, fontWeight: '900', color: colors.text }}
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
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: 32,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chapterItem: {
    flexDirection: 'column',
    padding: 20,
    borderRadius: 40,
    marginBottom: 14,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    fontSize: 15,
  },
  emptyChapters: {
    padding: 40,
    alignItems: 'center',
  },
  emptyChaptersText: {
    fontSize: 14,
  },
});

