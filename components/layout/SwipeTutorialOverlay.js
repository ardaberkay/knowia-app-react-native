import React from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/AppText';
import { typography, fonts } from '../../theme/typography';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

/**
 * First-run coachmarks on the swipe screen. Dims everything except the
 * target (the top card or the interval buttons) and shows a step card.
 * Target layouts are measured by the screen relative to its root view.
 */
export default function SwipeTutorialOverlay({
  steps,
  stepIndex,
  onStepChange,
  onComplete,
  cardTargetLayout,
  intervalTargetLayout,
  colors,
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const activeStep = steps[stepIndex] || steps[0];
  if (!activeStep) return null;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const isCardTarget = activeStep.target === 'card';
  const targetLayout = isCardTarget ? cardTargetLayout : intervalTargetLayout;
  const targetPadding = isCardTarget ? 10 : 6;
  const targetRadius = isCardTarget ? 26 : 12;
  const hasValidTargetLayout =
    targetLayout &&
    Number.isFinite(targetLayout.x) &&
    Number.isFinite(targetLayout.y) &&
    Number.isFinite(targetLayout.width) &&
    Number.isFinite(targetLayout.height) &&
    targetLayout.width > 0 &&
    targetLayout.height > 0;
  const spotlightLeft = hasValidTargetLayout ? Math.max(0, targetLayout.x - targetPadding) : 0;
  const spotlightTop = hasValidTargetLayout ? Math.max(0, targetLayout.y - targetPadding) : 0;
  const spotlightWidth = hasValidTargetLayout
    ? Math.min(width - spotlightLeft, targetLayout.width + targetPadding * 2)
    : 0;
  const spotlightHeight = hasValidTargetLayout
    ? Math.min(height - spotlightTop, targetLayout.height + targetPadding * 2)
    : 0;
  const shouldUseSpotlight =
    hasValidTargetLayout &&
    spotlightWidth > 0 &&
    spotlightHeight > 0 &&
    spotlightLeft + spotlightWidth <= width + 1 &&
    spotlightTop + spotlightHeight <= height + 1;
  const spotlightRadius = shouldUseSpotlight
    ? Math.min(targetRadius, spotlightWidth / 2, spotlightHeight / 2)
    : targetRadius;
  const cornerCoverRadius = isCardTarget ? Math.min(spotlightRadius, 10) : spotlightRadius;
  const targetFrameStyle = hasValidTargetLayout ? {
    top: spotlightTop,
    left: spotlightLeft,
    width: spotlightWidth,
    height: spotlightHeight,
    borderRadius: spotlightRadius,
  } : null;
  const coachmarkPositionStyle = isCardTarget
    ? {
      top: targetLayout ? Math.max(54, targetLayout.y - 156) : 74,
      left: 18,
      right: 18,
    }
    : {
      left: 18,
      right: 18,
      bottom: targetFrameStyle
        ? Math.max(24, height - targetFrameStyle.top - 60)
        : 144 + insets.bottom,
    };
  const swipeDirectionHintPositionStyle = activeStep.showSwipeHint
    ? {
      top: (coachmarkPositionStyle.top ?? 74) + 340,
      left: 24,
      right: 24,
    }
    : null;

  return (
    <View style={styles.swipeTutorialOverlay} pointerEvents="auto" onTouchStart={() => { }}>
      {shouldUseSpotlight ? (
        <>
          <View style={[styles.swipeTutorialDimLayer, { top: 0, left: 0, right: 0, height: spotlightTop }]} />
          <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop, left: 0, width: spotlightLeft, height: spotlightHeight }]} />
          <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop, left: spotlightLeft + spotlightWidth, right: 0, height: spotlightHeight }]} />
          <View style={[styles.swipeTutorialDimLayer, { top: spotlightTop + spotlightHeight, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop, left: spotlightLeft, width: cornerCoverRadius, height: cornerCoverRadius, borderBottomRightRadius: cornerCoverRadius }]} />
          <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop, left: spotlightLeft + spotlightWidth - cornerCoverRadius, width: cornerCoverRadius, height: cornerCoverRadius, borderBottomLeftRadius: cornerCoverRadius }]} />
          <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop + spotlightHeight - cornerCoverRadius, left: spotlightLeft, width: cornerCoverRadius, height: cornerCoverRadius, borderTopRightRadius: cornerCoverRadius }]} />
          <View style={[styles.swipeTutorialCornerCover, { top: spotlightTop + spotlightHeight - cornerCoverRadius, left: spotlightLeft + spotlightWidth - cornerCoverRadius, width: cornerCoverRadius, height: cornerCoverRadius, borderTopLeftRadius: cornerCoverRadius }]} />
        </>
      ) : (
        <View style={styles.swipeTutorialFullDimLayer} />
      )}
      {targetFrameStyle && (
        <View pointerEvents="none" style={[styles.swipeTutorialTargetFrame, targetFrameStyle]} />
      )}
      <View style={[styles.swipeTutorialCoachmarkGroup, coachmarkPositionStyle]}>
        <View style={[styles.swipeTutorialCard, styles.swipeTutorialCardInGroup, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.swipeTutorialStepPill}>
            <Text style={styles.swipeTutorialStepText}>{stepIndex + 1}/{steps.length}</Text>
          </View>
          <View style={styles.swipeTutorialTitleRow}>
            <PhosphorIcon icon={activeStep.icon} size={20} color="#F98A21" />
            <Text style={[styles.swipeTutorialTitle, { color: colors.text }]}>{activeStep.title}</Text>
          </View>
          <Text style={[styles.swipeTutorialDescription, { color: colors.muted }]}>{activeStep.description}</Text>
          {isCardTarget ? <View style={styles.swipeTutorialArrowUp} /> : <View style={styles.swipeTutorialArrowDown} />}
          <View style={styles.swipeTutorialActions}>
            <Pressable onPress={onComplete} style={styles.swipeTutorialGhostButton}>
              <Text style={[styles.swipeTutorialGhostText, { color: colors.muted }]}>{t('swipeDeck.tutorial.skip', 'Geç')}</Text>
            </Pressable>
            <View style={styles.swipeTutorialNavActions}>
              <Pressable
                disabled={isFirstStep}
                onPress={() => onStepChange((step) => Math.max(0, step - 1))}
                style={[styles.swipeTutorialBackButton, { borderColor: colors.cardBorder }, isFirstStep && styles.swipeTutorialDisabledButton]}
              >
                <Text style={[styles.swipeTutorialBackText, { color: colors.text }]}>{t('swipeDeck.tutorial.back', 'Geri')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isLastStep) {
                    onComplete();
                  } else {
                    onStepChange((step) => Math.min(steps.length - 1, step + 1));
                  }
                }}
                style={styles.swipeTutorialNextButton}
              >
                <Text style={styles.swipeTutorialNextText}>
                  {isLastStep ? t('swipeDeck.tutorial.done', 'Anladım') : t('swipeDeck.tutorial.next', 'İleri')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      {activeStep.showSwipeHint && swipeDirectionHintPositionStyle && (
        <View pointerEvents="none" style={[styles.swipeTutorialSwipeHint, swipeDirectionHintPositionStyle]}>
          <View style={[styles.swipeTutorialSwipeBadge, styles.swipeTutorialSwipeBadgeLeft]}>
            <View style={[styles.swipeTutorialSwipeBadgeGlow, styles.swipeTutorialSwipeBadgeGlowLeft]} />
            <View style={[styles.swipeTutorialSwipeBadgeContent, styles.swipeTutorialSwipeBadgeContentLeft]}>
              <PhosphorIcon icon={ICONS.swipeLeft} size={16} color="#FFFFFF" />
              <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintLeft', 'Tekrar Et')}</Text>
            </View>
          </View>
          <View style={[styles.swipeTutorialSwipeBadge, styles.swipeTutorialSwipeBadgeRight]}>
            <View style={[styles.swipeTutorialSwipeBadgeGlow, styles.swipeTutorialSwipeBadgeGlowRight]} />
            <View style={[styles.swipeTutorialSwipeBadgeContent, styles.swipeTutorialSwipeBadgeContentRight]}>
              <Text style={styles.swipeTutorialSwipeHintText}>{t('swipeDeck.tutorial.swipeHintRight', 'Öğrendim')}</Text>
              <PhosphorIcon icon={ICONS.swipeRight} size={16} color="#FFFFFF" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  swipeTutorialOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },
  swipeTutorialFullDimLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialDimLayer: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialCornerCover: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 0,
    elevation: 0,
  },
  swipeTutorialTargetFrame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#F98A21',
    backgroundColor: 'transparent',
    shadowColor: '#F98A21',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
    elevation: 10000,
  },
  swipeTutorialCoachmarkGroup: {
    position: 'absolute',
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialCard: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialCardInGroup: {
    position: 'relative',
  },
  swipeTutorialStepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(249,138,33,0.14)',
    marginBottom: 10,
  },
  swipeTutorialStepText: {
    ...typography.styles.subhead,
    color: '#F98A21',
    fontFamily: fonts.bold,
  },
  swipeTutorialTitle: {
    ...typography.styles.bodyLarge,
    fontFamily: fonts.bold,
    flex: 1,
  },
  swipeTutorialTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  swipeTutorialDescription: {
    ...typography.styles.body,
    lineHeight: 21,
  },
  swipeTutorialSwipeHint: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 10,
    zIndex: 2,
    elevation: 10001,
  },
  swipeTutorialSwipeBadge: {
    width: 148,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F98A21',
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  swipeTutorialSwipeBadgeLeft: {
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 26,
    transform: [{ skewX: '-5deg' }],
  },
  swipeTutorialSwipeBadgeRight: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 26,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 10,
    transform: [{ skewX: '5deg' }],
  },
  swipeTutorialSwipeBadgeGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  swipeTutorialSwipeBadgeGlowLeft: {
    left: -12,
    top: -8,
  },
  swipeTutorialSwipeBadgeGlowRight: {
    right: -12,
    top: -8,
  },
  swipeTutorialSwipeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  swipeTutorialSwipeBadgeContentLeft: {
    transform: [{ skewX: '5deg' }],
  },
  swipeTutorialSwipeBadgeContentRight: {
    transform: [{ skewX: '-5deg' }],
  },
  swipeTutorialSwipeHintText: {
    ...typography.styles.subhead,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
  swipeTutorialArrowDown: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F98A21',
  },
  swipeTutorialArrowUp: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#F98A21',
    transform: [{ rotate: '45deg' }],
  },
  swipeTutorialActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  swipeTutorialGhostButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  swipeTutorialGhostText: {
    ...typography.styles.headline,
    fontFamily: fonts.bold,
  },
  swipeTutorialNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipeTutorialBackButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  swipeTutorialDisabledButton: {
    opacity: 0.42,
  },
  swipeTutorialBackText: {
    ...typography.styles.headline,
    fontFamily: fonts.bold,
  },
  swipeTutorialNextButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F98A21',
  },
  swipeTutorialNextText: {
    ...typography.styles.headline,
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
});
