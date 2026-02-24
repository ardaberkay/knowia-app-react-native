import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Animated, Easing } from 'react-native';
import PagerView from 'react-native-pager-view';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { scale, moderateScale, verticalScale, useWindowDimensions, getIsTablet } from '../../lib/scaling';
import { OnboardingFinishContext } from '../../contexts/OnboardingFinishContext';
import { Iconify } from 'react-native-iconify';

const SLIDE_COUNT = 4;

export default function OnboardingScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { colors, isDarkMode } = useTheme();
  const pagerRef = useRef(null);
  const lottieCardRef = useRef(null);
  const lottieHintRef = useRef(null);
  const [page, setPage] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const previewHintAnim = useRef(new Animated.Value(1)).current;
  const { width, height } = useWindowDimensions();
  const isTablet = getIsTablet();

  const onFinishFromContext = React.useContext(OnboardingFinishContext);
  const previewMode = route?.params?.previewMode === true;
  const onFinish = previewMode ? null : onFinishFromContext;

  const lightOverlayColors = useMemo(() => {
    if (isDarkMode) {
      return ['rgba(249,138,33,0.07)', 'transparent', 'transparent', 'rgba(249,138,33,0.04)'];
    }
    return [
      'rgba(255,248,240,0.4)',
      'rgba(255,248,240,0.1)',
      'transparent',
      'transparent',
      'rgba(249,138,33,0.07)',
    ];
  }, [isDarkMode]);

  const slides = useMemo(
    () => [
      {
        key: 'focus',
        title: t('onboarding.screen1.title', 'Oyunlaştırılmış, Kalıcı Öğrenme'),
        subtitle: t(
          'onboarding.screen1.subtitle',
          'Kartları kaydır, öğrenme hızını belirle ve algoritmamız sayesinde asla unutma.'
        ),
        type: 'lottie',
      },
      {
        key: 'content',
        title: t('onboarding.screen2.title', 'Asla Sıfırdan Başlama'),
        subtitle: t(
          'onboarding.screen2.subtitle',
          "Knowia'nın uzman desteleriyle hemen öğrenmeye başla veya topluluğun paylaştığı binlerce desteyi keşfet."
        ),
        type: 'image',
        source: require('../../assets/onboarding.png'),
      },
      {
        key: 'create',
        title: t('onboarding.screen3.title', 'Kendi Dünyanı Yarat'),
        subtitle: t(
          'onboarding.screen3.subtitle',
          'Kendi destelerini oluştur, ister kendine sakla ister tüm dünyayla paylaşarak topluluğa katkı sağla.'
        ),
        type: 'image',
        source: require('../../assets/shared.png'),
      },
      {
        key: 'start',
        title: t('onboarding.screen4.title', 'Hemen Başla'),
        subtitle: t(
          'onboarding.screen4.subtitle',
          'Öğrenme alışkanlığını bugün başlat. İlk desteğini seç ve kaydırmaya başla.'
        ),
        type: 'image',
        source: require('../../assets/graduation hats-amico.png'),
      },
    ],
    [t]
  );

  const mediaHeight = useMemo(() => {
    if (isTablet) return Math.min(height * 0.45, verticalScale(420));
    return Math.min(height * 0.38, verticalScale(320));
  }, [height, isTablet]);

  const mediaContainerHeight = useMemo(() => {
    if (isTablet) return verticalScale(420);
    return verticalScale(380);
  }, [isTablet]);

  // Lottie senkronu: aynı anda başlat, döngü sürelerini eşitle (swipeCard ~100/60s, swipeHint 59/30s → aynı süre için hızlar)
  useEffect(() => {
    if (page !== 0) return;
    const t = setTimeout(() => {
      lottieCardRef.current?.play();
      lottieHintRef.current?.play();
    }, 50);
    return () => clearTimeout(t);
  }, [page]);

  // Süre seçenekleri: "ileride tıklanacak" hissi – belirgin pulse + hafif büyüme
  useEffect(() => {
    if (page !== 0) return;
    previewHintAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(previewHintAnim, {
          toValue: 0.66,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(previewHintAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [page, previewHintAnim]);

  const goTo = (nextIndex) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, nextIndex));
    pagerRef.current?.setPage(clamped);
    setPage(clamped);
  };

  const handleSkip = async () => {
    if (previewMode) {
      navigation.goBack();
      return;
    }
    if (typeof onFinish === 'function') {
      await onFinish();
    }
    // Navigator re-renders and shows auth stack; no need to replace
  };

  const handleNext = () => {
    if (page >= SLIDE_COUNT - 1) return;
    Animated.timing(scrollAnim, {
      toValue: page + 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      goTo(page + 1);
    });
  };

  const onPageScroll = useRef((e) => {
    const { position, offset } = e.nativeEvent;
    scrollAnim.setValue(position + offset);
  }).current;
  const onPageSelected = useRef((e) => {
    setPage(e.nativeEvent.position);
  }).current;

  const handleGetStarted = async () => {
    if (previewMode) {
      navigation.goBack();
      return;
    }
    if (typeof onFinish === 'function') {
      await onFinish();
    }
    // Navigator re-renders and shows auth stack; no need to replace
  };

  const renderMedia = (slide) => {
    if (slide.type === 'lottie') {
      const cardHeight = verticalScale(300);
      return (
        <View style={[styles.mediaContainer, { height: mediaContainerHeight }]}>
          <View style={styles.lottieSlideColumn}>
            <LottieView
              ref={lottieCardRef}
              source={require('../../assets/swipeCard.json')}
              loop
              speed={0.95}
              style={{ width: Math.min(width * 0.92, scale(360)), height: cardHeight }}
            />
            <Animated.View
              style={[
                styles.previewButtonsRow,
                { backgroundColor: colors.buttonColor },
                {
                  opacity: previewHintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                  transform: [{
                    scale: previewHintAnim.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] }),
                  }],
                },
              ]}
            >
              {[
                { label: t('swipeDeck.minutes', '15 dk'), icon: 'material-symbols:repeat-rounded' },
                { label: t('swipeDeck.hours', '1 sa'), icon: 'mingcute:time-line' },
                { label: t('swipeDeck.days', '1 gün'), icon: 'solar:calendar-broken' },
                { label: t('swipeDeck.sevenDays', '7 gün'), icon: 'solar:star-broken' },
              ].map(({ label, icon }, i) => (
                <View
                  key={i}
                  style={[
                    styles.previewButton,
                    i < 3 && styles.previewButtonDivider,
                  ]}
                >
                  <Iconify icon={icon} size={moderateScale(18)} color={colors.buttonText} style={{ marginRight: scale(4) }} />
                  <Text style={[styles.previewButtonText, { color: colors.buttonText }]}>{label}</Text>
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.mediaContainer, { height: mediaContainerHeight }]}>
        <Image
          source={slide.source}
          resizeMode="contain"
          style={{ width: Math.min(width * 0.88, scale(340)), height: mediaHeight }}
        />
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={lightOverlayColors}
        locations={lightOverlayColors.length === 4 ? [0, 0.4, 0.6, 1] : [0, 0.2, 0.5, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}
      >
        {slides.map((slide, index) => (
          <Animated.View
            key={slide.key}
            style={[
              styles.page,
              {
                opacity: scrollAnim.interpolate({
                  inputRange: [index - 1, index, index + 1],
                  outputRange: [0, 1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <View style={styles.pageInner}>
              <View style={styles.slideContent}>
                {renderMedia(slide)}
              </View>
              <View style={styles.textBlock}>
                <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                <Text style={[styles.subtitle, { color: colors.subtext }]}>{slide.subtitle}</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </PagerView>

      <View style={[styles.bottomArea, { backgroundColor: 'transparent' }]}>
        <View style={styles.dotsRow} accessible accessibilityRole="adjustable">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? colors.buttonColor : colors.border, width: i === page ? scale(18) : scale(8) },
              ]}
            />
          ))}
        </View>

        <View style={styles.bottomActionsRow}>
          {page < SLIDE_COUNT - 1 ? (
            <TouchableOpacity
              onPress={handleSkip}
              style={[styles.skipButton, { borderColor: colors.border }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.skipText, { color: colors.subtext }]}>{t('onboarding.skip', 'Atla')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipButtonPlaceholder} />
          )}
          {page < SLIDE_COUNT - 1 ? (
            <TouchableOpacity style={styles.primaryButtonWrapper} onPress={handleNext} activeOpacity={0.9}>
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>{t('onboarding.next', 'İleri')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButtonWrapper} onPress={handleGetStarted} activeOpacity={0.9}>
              <LinearGradient
                colors={['#F98A21', '#FF6B35']}
                locations={[0, 0.99]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>{t('onboarding.getStarted', 'Başla')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === 'android' ? <View style={{ height: verticalScale(10) }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(50),
    alignItems: 'center',
  },
  pageInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  slideContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(320),
  },
  mediaContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    paddingTop: verticalScale(16),
    width: '100%',
  },
  title: {
    ...typography.styles.h2,
    fontSize: moderateScale(22),
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: verticalScale(8),
  },
  subtitle: {
    ...typography.styles.body,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(21),
    textAlign: 'center',
    maxWidth: scale(320),
    alignSelf: 'center',
  },
  bottomArea: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(4),
    paddingBottom: verticalScale(18),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(36),
    gap: scale(8),
  },
  dot: {
    height: scale(8),
    borderRadius: scale(8),
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(16),
  },
  skipButtonPlaceholder: {
    width: scale(80),
  },
  skipButton: {
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(20),
    minWidth: scale(80),
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.styles.body,
    fontSize: moderateScale(14),
    fontFamily: 'Inter-SemiBold',
  },
  primaryButtonWrapper: {
    flex: 1,
    borderRadius: 99,
    overflow: 'hidden',
    maxWidth: scale(260),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: 1,
  },
  primaryButtonGradient: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: moderateScale(17),
    color: '#FFFFFF',
  },
  lottieSlideColumn: {
    width: '100%',
    alignItems: 'center',
  },
  hintBelowCard: {
    marginTop: verticalScale(-40),
    alignSelf: 'center',
  },
  previewButtonsRow: {
    width: '100%',
    height: verticalScale(44),
    borderRadius: moderateScale(14),
    flexDirection: 'row',
    overflow: 'hidden',
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  previewButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: moderateScale(16),
  },
});
