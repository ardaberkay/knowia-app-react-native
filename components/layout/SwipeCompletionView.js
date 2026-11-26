import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/AppText';
import { typography } from '../../theme/typography';

const formatFutureReview = (dateString, t) => {
  const minutes = Math.max(1, Math.ceil((new Date(dateString).getTime() - Date.now()) / 60000));
  if (minutes < 60) return t('swipeDeck.completion.minutesFromNow', { count: minutes, defaultValue: `${minutes} dk sonra` });
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return t('swipeDeck.completion.hoursFromNow', { count: hours, defaultValue: `${hours} sa sonra` });
  return t('swipeDeck.completion.daysFromNow', { count: Math.ceil(hours / 24), defaultValue: `${Math.ceil(hours / 24)} gün sonra` });
};

/**
 * End of a swipe session: session totals, today's goal, chapter progress,
 * upcoming reviews and back / next-chapter buttons. An empty chapter gets a
 * short "nothing to study right now" version.
 *
 * sessionLearned is the screen's right counter: the backend session summary
 * can lag behind the UI write, and the counter is updated at swipe commit.
 */
export default function SwipeCompletionView({
  isEmptyChapter,
  sessionLearned,
  sessionTargetCount,
  totalSwipeCount,
  completionSummary,
  nextChapter,
  onBack,
  onNextChapter,
  colors,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const sessionPlanned = Math.max(0, sessionTargetCount - sessionLearned);
  const chapterProgress = completionSummary?.chapterProgress;
  const chapterLearned = chapterProgress?.learned || 0;
  const chapterUnfinished = chapterProgress ? chapterProgress.total - chapterLearned : 0;
  const chapterPercent = chapterProgress?.total
    ? Math.round((chapterLearned / chapterProgress.total) * 100)
    : 0;
  const completionActivity = completionSummary?.activity;
  const nearestReview = completionSummary?.reviews?.nearest;
  const farthestReview = completionSummary?.reviews?.farthest;

  const ctaArea = (
    <View style={styles.completionCtaArea}>
      <View style={styles.completionButtonRow}>
        <TouchableOpacity style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, borderWidth: StyleSheet.hairlineWidth }]} onPress={onBack}>
          <Text style={[typography.styles.button, { color: colors.text }]}>{t('swipeDeck.completion.back', 'Geri Dön')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!nextChapter}
          style={[styles.completionButton, styles.completionButtonHalf, { backgroundColor: nextChapter ? colors.buttonColor : colors.cardBackground, borderColor: nextChapter ? 'transparent' : colors.cardBorder, borderWidth: nextChapter ? 0 : StyleSheet.hairlineWidth, opacity: nextChapter ? 1 : 0.55 }]}
          onPress={onNextChapter}
        >
          <Text style={[typography.styles.button, { color: nextChapter ? colors.buttonText : colors.muted }]}>{t('swipeDeck.completion.nextChapter', 'Sonraki Bölüm')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.completionNextMetaRow}>
        <View style={styles.completionNextMetaSpacer} />
        <Text style={[styles.nextChapterMeta, { color: colors.muted }]}>{nextChapter ? t('swipeDeck.completion.chapterMeta', { chapter: nextChapter.ordinal, count: nextChapter.totalCards, defaultValue: `Bölüm ${nextChapter.ordinal} • ${nextChapter.totalCards} kart` }) : t('swipeDeck.completion.noNextChapter', 'Sonraki bölüm yok')}</Text>
      </View>
    </View>
  );

  if (isEmptyChapter) {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <View style={styles.emptyCompletionContent}>
          <Text style={styles.emptyCompletionIcon}>📚</Text>
          <Text style={[typography.styles.h2, styles.emptyCompletionTitle, { color: colors.text }]}>{t('swipeDeck.completion.emptyTitle', 'Bu bölümde şu anda çalışılacak kart yok.')}</Text>
          <View style={[styles.emptyCompletionInfo, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : '—'}</Text>
            <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{nearestReview ? t('swipeDeck.completion.cardsReady', { count: nearestReview.count, defaultValue: `${nearestReview.count} kart hazır` }) : t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
          </View>
          {ctaArea}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom, paddingTop: insets.top + 50 }]}>
      <ScrollView contentContainerStyle={[styles.completionContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.completionHero}>
          <LinearGradient colors={[colors.buttonColor, '#FF6B35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.completionHeroCard, { backgroundColor: colors.buttonColor }]}>
            <View style={styles.completionHeroTitleRow}>
              <Iconify icon="material-symbols:trophy" size={36} color="#FFFFFF" />
              <Text style={[typography.styles.h2, styles.completionTitle, { color: '#FFFFFF' }]}>{t('swipeDeck.completion.title', 'Oturum Tamamlandı!')}</Text>
            </View>
            <View style={styles.completionHeroMetricCircle}>
              <Text style={[styles.completionHeroMetric, { color: '#FFFFFF' }]}>{sessionTargetCount}</Text>
              <Text style={[typography.styles.body, styles.completionHeroLabel, { color: 'rgba(255,255,255,0.88)' }]}>{t('swipeDeck.completion.cardsStudied', 'Kart Çalışıldı')}</Text>
            </View>
            <View style={styles.completionHeroSessionStats}>
              <View style={styles.completionHeroSessionStat}>
                <Text style={styles.completionHeroSessionNumber}>
                  {sessionLearned ?? '—'}
                </Text>
                <Text style={styles.completionHeroSessionLabel}>
                  {t('swipeDeck.completion.learned', 'Öğrenildi')}
                </Text>
              </View>

              <View style={styles.completionHeroSessionDivider} />

              <View style={styles.completionHeroSessionStat}>
                <Text style={styles.completionHeroSessionNumber}>
                  {sessionPlanned ?? '—'}
                </Text>
                <Text style={styles.completionHeroSessionLabel}>
                  {t('swipeDeck.completion.reviewPlanned', 'Tekrar Planlandı')}
                </Text>
              </View>

              <View style={styles.completionHeroSessionDivider} />

              <View style={styles.completionHeroSessionStat}>
                <Text style={styles.completionHeroSessionNumber}>
                  {totalSwipeCount ?? '—'}
                </Text>
                <Text style={styles.completionHeroSessionLabel}>
                  {t('swipeDeck.completion.totalSwipes', 'Toplam Kaydırma')}
                </Text>
              </View>
            </View>
            {completionActivity ? (
              <View style={styles.completionGoalRow}>
                <Iconify
                  icon={completionActivity.today_goal_met ? 'mdi:fire' : 'lets-icons:clock-fill'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.completionGoalText} numberOfLines={2}>
                  {completionActivity.today_goal_met
                    ? t('swipeDeck.completion.goalDone', {
                      count: completionActivity.current_streak,
                      defaultValue: `Günlük hedef tamam! Seri: ${completionActivity.current_streak} gün`,
                    })
                    : t('swipeDeck.completion.goalLeft', {
                      count: Math.max((completionActivity.daily_goal ?? 0) - (completionActivity.today_swipes ?? 0), 0),
                      defaultValue: `Günlük hedefe ${Math.max((completionActivity.daily_goal ?? 0) - (completionActivity.today_swipes ?? 0), 0)} kart kaldı`,
                    })}
                </Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        <View style={[styles.completionChapterCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.completionChapterHeader}>
            <View style={styles.completionChapterTitleRow}>
              <Iconify icon="streamline-flex:module-puzzle-2" size={20} color={colors.buttonColor} />
              <Text style={[typography.styles.subtitle, { color: colors.text }]}>{t('swipeDeck.completion.chapterProgress', 'Bölüm İlerlemesi')}</Text>
            </View>
            <Text style={[styles.completionChapterProgressValue, { color: colors.buttonColor }]}>{chapterProgress ? `%${chapterPercent}` : '--'}</Text>
          </View>
          <View style={[styles.completionChapterProgressTrack, { backgroundColor: colors.progressBarSwipe || colors.border }]}>
            <View style={[styles.completionChapterProgressFill, { width: `${chapterProgress ? chapterPercent : 0}%`, backgroundColor: colors.buttonColor }]} />
          </View>
          <View style={styles.completionChapterMetrics}>
            <Text style={[typography.styles.body, { color: colors.text }]}>{chapterProgress ? `• ${t('swipeDeck.completion.learnedCount', { count: chapterLearned, defaultValue: `${chapterLearned} Öğrenildi` })}` : '—'}</Text>
            <Text style={[typography.styles.body, { color: colors.muted }]}>{chapterProgress ? `• ${t('swipeDeck.completion.learningCount', { count: chapterUnfinished, defaultValue: `${chapterUnfinished} Öğrenme Sürecinde` })}` : '—'}</Text>
          </View>
          <View style={[styles.completionChapterDivider, { backgroundColor: colors.border }]} />
          <View style={styles.completionReviewGrid}>
            <View style={styles.completionReviewItem}>
              <Iconify icon="lets-icons:clock-fill" size={22} color={colors.buttonColor} />
              <View style={styles.completionReviewTextGroup}>
                <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{nearestReview ? formatFutureReview(nearestReview.at, t) : '—'}</Text>
                <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{nearestReview ? t('swipeDeck.completion.cardsReady', { count: nearestReview.count, defaultValue: `${nearestReview.count} kart hazır` }) : t('swipeDeck.completion.nearestReview', 'En yakın tekrar')}</Text>
              </View>
            </View>
            <View style={styles.completionReviewItem}>
              <Iconify icon="solar:calendar-bold" size={22} color={colors.secondary} />
              <View style={styles.completionReviewTextGroup}>
                <Text style={[styles.completionReviewMetric, { color: colors.text }]}>{farthestReview ? formatFutureReview(farthestReview.at, t) : '—'}</Text>
                <Text style={[typography.styles.caption, styles.completionReviewLabel, { color: colors.muted }]}>{t('swipeDeck.completion.farthestReview', 'En uzak tekrar')}</Text>
              </View>
            </View>
          </View>
        </View>

        {ctaArea}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  completionContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  completionHero: {
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
    marginBottom: 22,
  },
  completionGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  completionGoalText: {
    ...typography.styles.button,
    fontSize: 14,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  completionHeroCard: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 30,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  completionHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  completionHeroMetricCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  completionTitle: {
    textAlign: 'center',
    marginBottom: 0,
  },
  completionHeroMetric: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
  },
  completionHeroLabel: {
    fontWeight: '700',
  },
  completionHeroSessionStats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  completionHeroSessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  completionHeroSessionNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  completionHeroSessionLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  completionHeroSessionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  emptyCompletionContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCompletionIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  emptyCompletionTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyCompletionInfo: {
    width: '100%',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },
  emptyCompletionTime: {
    marginTop: 6,
    textAlign: 'center',
  },
  completionChapterCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  completionChapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completionChapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionChapterProgressValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  completionChapterProgressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 16,
  },
  completionChapterProgressFill: {
    height: '100%',
    borderRadius: 6,
  },

  completionChapterMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  completionChapterDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 18,
  },
  completionReviewGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  completionReviewItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completionReviewTextGroup: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  completionReviewMetric: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  completionReviewLabel: {
    marginTop: 1,
    textAlign: 'center',
  },

  completionButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  completionCtaArea: {
    width: '100%',
    marginTop: 4,
    marginBottom: 28,
  },
  completionButtonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  completionButtonHalf: {
    flex: 1,
    width: undefined,
  },

  nextChapterMeta: {
    ...typography.styles.body,
    textAlign: 'center',
    flex: 1,
    marginTop: 6,
  },
  completionNextMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  completionNextMetaSpacer: {
    flex: 1,
  },
});
