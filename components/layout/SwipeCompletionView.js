import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text, MAX_FONT_SIZE_MULTIPLIER } from '../ui/AppText';
import { typography, fontSizes, fonts } from '../../theme/typography';
import PhosphorIcon from '../ui/PhosphorIcon';
import CircularProgress from '../ui/CircularProgress';
import { ICONS } from '../../theme/icons';

// "in 5 min" / "in 2 h" / "in 3 days"; also used by the card detail sheet.
export const formatFutureReview = (dateString, t) => {
  const minutes = Math.max(1, Math.ceil((new Date(dateString).getTime() - Date.now()) / 60000));
  if (minutes < 60) return t('swipeDeck.completion.minutesFromNow', { count: minutes, defaultValue: `${minutes} dk sonra` });
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return t('swipeDeck.completion.hoursFromNow', { count: hours, defaultValue: `${hours} sa sonra` });
  return t('swipeDeck.completion.daysFromNow', { count: Math.ceil(hours / 24), defaultValue: `${Math.ceil(hours / 24)} gün sonra` });
};

const ORANGE = '#F98A21';
const GREEN = '#27AE60';
const BLUE = '#2F80ED';

// Staggered entrance for the blocks (runs once when the screen appears).
const enter = (index) => FadeInDown.duration(420).delay(80 + index * 70);

/**
 * End of a swipe session.
 *
 * Numbers come from the server summary (swipe_session_summary: cards studied,
 * learned, to review, nearest review). Until it arrives, or if it fails, the
 * screen's own counters are shown (studied = session size, learned = right
 * swipes). Then today's goal + streak, the chapter's progress (chapter
 * sessions) and the actions: next chapter when there is one, done.
 * An empty chapter gets a short "nothing to study right now" version.
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

  const counts = completionSummary?.sessionCounts;
  const studied = counts?.studied || sessionTargetCount || 0;
  const learned = Math.min(counts ? counts.learned : (sessionLearned || 0), studied);
  const toReview = counts ? counts.learning : Math.max(studied - learned, 0);
  const ratio = studied > 0 ? learned / studied : 0;

  const activity = completionSummary?.activity;
  const goal = activity?.daily_goal ?? 0;
  const todaySwipes = activity?.today_swipes ?? 0;
  const goalRatio = goal > 0 ? Math.min(1, todaySwipes / goal) : 0;

  const chapterProgress = completionSummary?.chapterProgress;
  const chapterPercent = chapterProgress?.total
    ? Math.round((chapterProgress.learned / chapterProgress.total) * 100)
    : 0;
  const nextReview = counts?.nextReview || completionSummary?.reviews?.nearest || null;

  const title = ratio >= 0.8
    ? t('swipeDeck.completion.titleGreat', 'Mükemmel!')
    : ratio >= 0.5
      ? t('swipeDeck.completion.titleGood', 'Harika iş!')
      : t('swipeDeck.completion.titleKeepGoing', 'İyi gidiyorsun');

  const actions = (
    <View style={styles.actions}>
      {nextChapter ? (
        <>
          <TouchableOpacity activeOpacity={0.85} style={[styles.primaryBtn, { backgroundColor: colors.buttonColor }]} onPress={onNextChapter}>
            <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>{t('swipeDeck.completion.nextChapter', 'Sonraki Bölüm')}</Text>
            <PhosphorIcon icon={ICONS.arrowRight} size={18} color={colors.buttonText} />
          </TouchableOpacity>
          <Text style={[styles.nextMeta, { color: colors.muted }]}>
            {t('swipeDeck.completion.chapterMeta', { chapter: nextChapter.ordinal, count: nextChapter.totalCards, defaultValue: `Bölüm ${nextChapter.ordinal} • ${nextChapter.totalCards} kart` })}
          </Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.secondaryBtn} onPress={onBack}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{t('swipeDeck.completion.done', 'Bitir')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity activeOpacity={0.85} style={[styles.primaryBtn, { backgroundColor: colors.buttonColor }]} onPress={onBack}>
          <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>{t('swipeDeck.completion.done', 'Bitir')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isEmptyChapter) {
    return (
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.emptyContent}>
          <Reanimated.View entering={enter(0)} style={[styles.emptyIcon, { backgroundColor: ORANGE + '1F' }]}>
            <PhosphorIcon icon={ICONS.time} size={36} color={ORANGE} />
          </Reanimated.View>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} entering={enter(1)} style={[styles.emptyTitle, { color: colors.text }]}>
            {t('swipeDeck.completion.emptyTitle', 'Bu bölümde şu anda çalışılacak kart yok.')}
          </Reanimated.Text>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} entering={enter(2)} style={[styles.emptyText, { color: colors.muted }]}>
            {nextReview
              ? t('swipeDeck.completion.emptyNext', {
                when: formatFutureReview(nextReview.at, t),
                count: nextReview.count,
                defaultValue: `Sıradaki tekrar ${formatFutureReview(nextReview.at, t)}: ${nextReview.count} kart.`,
              })
              : t('swipeDeck.completion.emptyNoReview', 'Bütün kartları öğrendin.')}
          </Reanimated.Text>
        </View>
        <View style={styles.footer}>{actions}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: share of the session's cards now learned */}
        <Reanimated.View entering={enter(0)} style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t('swipeDeck.completion.eyebrow', 'Oturum tamamlandı')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={styles.ring}>
            <CircularProgress progress={ratio} size={156} strokeWidth={14} showText={true} shouldAnimate={true} label={t('swipeDeck.completion.ringLabel', 'öğrenme oranı')} />
          </View>
          <Text style={[styles.heroCaption, { color: colors.muted }]}>
            {t('swipeDeck.completion.heroCaption', { learned, studied, defaultValue: `${studied} karttan ${learned} tanesini öğrendin` })}
          </Text>
        </Reanimated.View>

        {/* Session numbers */}
        <Reanimated.View entering={enter(1)} style={styles.statsRow}>
          {[
            { key: 'studied', icon: ICONS.stack, color: BLUE, value: studied, label: t('swipeDeck.completion.statStudied', 'Çalışılan') },
            { key: 'learned', icon: ICONS.valid, color: GREEN, value: learned, label: t('swipeDeck.completion.statLearned', 'Öğrenildi') },
            { key: 'review', icon: ICONS.time, color: ORANGE, value: toReview, label: t('swipeDeck.completion.statReviewShort', 'Tekrar') },
          ].map((stat) => (
            <View key={stat.key} style={[styles.statTile, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + '22' }]}>
                <PhosphorIcon icon={stat.icon} size={16} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]} numberOfLines={1}>{stat.label}</Text>
            </View>
          ))}
        </Reanimated.View>

        {/* Today's goal + streak */}
        {activity ? (
          <Reanimated.View entering={enter(2)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('swipeDeck.completion.todayGoal', 'Günlük hedef')}</Text>
              <Text style={[styles.cardValue, { color: activity.today_goal_met ? GREEN : colors.muted }]}>
                {todaySwipes}/{goal}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.progressBar }]}>
              <View style={[styles.fill, { width: `${Math.max(goalRatio > 0 ? 3 : 0, goalRatio * 100)}%`, backgroundColor: activity.today_goal_met ? GREEN : ORANGE }]} />
            </View>
            <View style={styles.cardFooterRow}>
              <PhosphorIcon icon={ICONS.fire} size={16} color={activity.current_streak > 0 ? ORANGE : colors.muted} />
              <Text style={[styles.cardFooterText, { color: colors.text }]}>
                {activity.today_goal_met
                  ? t('swipeDeck.completion.streakDays', { count: activity.current_streak, defaultValue: `${activity.current_streak} günlük seri` })
                  : t('swipeDeck.completion.goalLeft', {
                    count: Math.max(goal - todaySwipes, 0),
                    defaultValue: `Günlük hedefe ${Math.max(goal - todaySwipes, 0)} kart kaldı`,
                  })}
              </Text>
            </View>
          </Reanimated.View>
        ) : null}

        {/* Chapter progress (chapter sessions) */}
        {chapterProgress ? (
          <Reanimated.View entering={enter(3)} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <PhosphorIcon icon={ICONS.chapter} size={16} color={ORANGE} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('swipeDeck.completion.chapterProgress', 'Bölüm İlerlemesi')}</Text>
              </View>
              <Text style={[styles.cardValue, { color: ORANGE }]}>%{chapterPercent}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.progressBar }]}>
              <View style={[styles.fill, { width: `${chapterPercent}%`, backgroundColor: ORANGE }]} />
            </View>
            <View style={styles.legendRow}>
              {[
                { key: 'l', color: GREEN, value: chapterProgress.learned, label: t('swipeDeck.completion.legendLearned', 'öğrenildi') },
                { key: 'g', color: ORANGE, value: chapterProgress.learning, label: t('swipeDeck.completion.legendLearning', 'öğreniliyor') },
                { key: 'n', color: colors.muted, value: chapterProgress.new, label: t('swipeDeck.completion.legendNew', 'yeni') },
              ].map((item) => (
                <View key={item.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendText, { color: colors.text }]}>
                    <Text style={{ fontFamily: fonts.bold }}>{item.value}</Text> {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </Reanimated.View>
        ) : null}

        {/* Next review of this session's cards */}
        {nextReview ? (
          <Reanimated.View entering={enter(4)} style={[styles.card, styles.reviewCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View style={[styles.statIcon, styles.reviewIcon, { backgroundColor: BLUE + '22' }]}>
              <PhosphorIcon icon={ICONS.calendar} size={18} color={BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('swipeDeck.completion.nextReviewTitle', { when: formatFutureReview(nextReview.at, t), defaultValue: `Sıradaki tekrar ${formatFutureReview(nextReview.at, t)}` })}
              </Text>
              <Text style={[styles.cardFooterText, { color: colors.muted, marginTop: 2 }]}>
                {t('swipeDeck.completion.cardsReady', { count: nextReview.count, defaultValue: `${nextReview.count} kart hazır` })}
              </Text>
            </View>
          </Reanimated.View>
        ) : null}

        <Reanimated.View entering={enter(5)} style={{ width: '100%' }}>
          {actions}
        </Reanimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, alignItems: 'center', gap: 12 },

  hero: { alignItems: 'center', width: '100%', marginBottom: 8 },
  eyebrow: { fontSize: fontSizes.footnote, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { ...typography.styles.title1, fontFamily: fonts.bold, marginTop: 4 },
  ring: { marginTop: 20, marginBottom: 12 },
  heroCaption: { fontSize: fontSizes.subhead, fontFamily: fonts.medium, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  statTile: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 8, gap: 6, alignItems: 'center' },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: fontSizes.title2, fontFamily: fonts.bold },
  statLabel: { fontSize: fontSizes.caption, fontFamily: fonts.medium, textAlign: 'center' },

  card: { width: '100%', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  cardValue: { fontSize: fontSizes.body, fontFamily: fonts.bold },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFooterText: { fontSize: fontSizes.footnote, fontFamily: fonts.medium },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSizes.footnote, fontFamily: fonts.regular },

  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewIcon: { width: 36, height: 36, borderRadius: 18 },

  actions: { width: '100%', marginTop: 8, alignItems: 'center' },
  primaryBtn: { width: '100%', height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { fontSize: fontSizes.bodyLarge, fontFamily: fonts.bold },
  nextMeta: { fontSize: fontSizes.footnote, fontFamily: fonts.medium, marginTop: 8 },
  secondaryBtn: { height: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryBtnText: { fontSize: fontSizes.body, fontFamily: fonts.semibold },

  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.styles.title2, fontFamily: fonts.bold, textAlign: 'center' },
  emptyText: { fontSize: fontSizes.body, fontFamily: fonts.regular, textAlign: 'center' },
  footer: { paddingHorizontal: 16 },
});
