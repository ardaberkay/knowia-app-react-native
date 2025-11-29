import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';

const CircularProgress = ({ 
  progress = 0, 
  size = 120, 
  strokeWidth = 8, 
  showText = true,
  textStyle = {},
  containerStyle = {},
  shouldAnimate = false,
  fullCircle = false,
}) => {
  const { colors } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const textScaleAnim = useRef(new Animated.Value(1)).current;
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const hasAnimatedRef = useRef(false);
  const previousProgressRef = useRef(null);
  const previousShouldAnimateRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  
  // Progress 0-1 arasında olmalı
  const normalizedProgress = useMemo(() => Math.max(0, Math.min(1, progress)), [progress]);
  
  // Daire için radius ve circumference hesaplama (yarım veya tam) - memoize edilmiş
  const { radius, circumference } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = (fullCircle ? 2 * Math.PI : Math.PI) * r;
    return { radius: r, circumference: c };
  }, [size, strokeWidth, fullCircle]);

  // Progress dolum animasyonu
  useEffect(() => {
    let listenerId = null;
    
    // İlk render mı kontrol et
    const isFirstRender = isFirstRenderRef.current;
    const progressChanged = previousProgressRef.current !== normalizedProgress;
    const shouldAnimateChanged = previousShouldAnimateRef.current !== shouldAnimate;
    const previousProgress = previousProgressRef.current;
    previousProgressRef.current = normalizedProgress;
    previousShouldAnimateRef.current = shouldAnimate;
    
    // shouldAnimate true ise her zaman animasyon yap
    // İlk render'da progress > 0 ise animasyon yap (flash'ı önlemek için)
    const shouldDoAnimation = shouldAnimate || (isFirstRender && normalizedProgress > 0);
    
    // Animasyon yapılacak durumlar: ilk render, progress değişti, veya shouldAnimate false'tan true'ya geçti
    const shouldTriggerAnimation = shouldDoAnimation && (isFirstRender || progressChanged || (shouldAnimateChanged && shouldAnimate));
    
    if (shouldTriggerAnimation) {
      // Mevcut animasyonu durdur
      progressAnim.stopAnimation();
      
      // İlk animasyon ise veya shouldAnimate false'tan true'ya geçtiyse 0'dan başla
      const startFromZero = isFirstRender || (shouldAnimateChanged && shouldAnimate && previousProgress !== null);
      
      if (startFromZero) {
        progressAnim.setValue(0);
        setAnimatedProgress(0);
        isFirstRenderRef.current = false;
      }
      
      // Animasyon değerini dinle - her frame'de güncelle (maksimum smooth için)
      let lastValue = startFromZero ? 0 : previousProgress || 0;
      setAnimatedProgress(lastValue);
      
      // Throttle olmadan direkt güncelleme - React.memo sayesinde gereksiz render'lar önleniyor
      listenerId = progressAnim.addListener(({ value }) => {
        // Her frame'de güncelle - en smooth animasyon için
        setAnimatedProgress(value);
      });
      
      Animated.timing(progressAnim, {
        toValue: normalizedProgress,
        duration: 900, // Daha responsive için kısaltıldı
        easing: Easing.inOut(Easing.ease), // En smooth easing - doğal ve akıcı
        useNativeDriver: false,
      }).start(() => {
        // Animasyon bittiğinde kesin değeri set et
        setAnimatedProgress(normalizedProgress);
        hasAnimatedRef.current = true;
      });
      
      // Yüzdelik metin için boing (spring) animasyonu - shouldAnimate true ise veya ilk animasyon ise
      if (shouldAnimate || isFirstRender) {
        textScaleAnim.setValue(0.7);
        Animated.spring(textScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 14,
          speed: 12,
        }).start();
      }
    } else if (!shouldAnimate && !isFirstRender) {
      // Animasyon yoksa ve ilk render değilse direkt progress değerini set et
      progressAnim.setValue(normalizedProgress);
      setAnimatedProgress(normalizedProgress);
      hasAnimatedRef.current = false;
    }
    
    // Cleanup: listener'ı kaldır
    return () => {
      if (listenerId !== null) {
        progressAnim.removeListener(listenerId);
      }
    };
  }, [normalizedProgress, shouldAnimate, progressAnim]);

  // Animasyonlu strokeDashoffset hesaplama - memoize edilmiş
  // shouldAnimate true ise her zaman animasyonlu progress kullan
  // shouldAnimate false ise ama ilk render ve progress > 0 ise animasyonlu progress kullan (flash önleme)
  // hasAnimatedRef false ise animasyon devam ediyor demektir
  const isAnimating = shouldAnimate || (!hasAnimatedRef.current && normalizedProgress > 0);
  const currentProgress = isAnimating ? animatedProgress : normalizedProgress;
  
  const strokeDashoffset = useMemo(() => {
    return fullCircle
      ? circumference * (1 - currentProgress)
      : (circumference / 2) + circumference * (1 - currentProgress);
  }, [fullCircle, circumference, currentProgress]);
  
  // Progress'e göre renk koyulaştırma (0-100% arasında) - animasyonlu progress kullan
  const progressPercent = useMemo(() => currentProgress * 100, [currentProgress]);
  
  // Renk interpolasyonu - progress arttıkça koyulaşır (ana tema turuncu çevresinde) - memoize edilmiş
  const progressColor = useMemo(() => {
    if (progressPercent === 0) return colors.progressBar || '#F1F1F1';
    if (progressPercent < 25) return '#FFD700'; // Altın sarısı
    if (progressPercent < 50) return '#FFA500'; // Turuncu
    if (progressPercent < 75) return '#F98A21'; // Ana tema turuncu
    if (progressPercent < 100) return '#FF4500'; // Kırmızı-turuncu
    return '#DC143C'; // Koyu kırmızı
  }, [progressPercent, colors.progressBar]);
  
  // Text scale animasyonu için kontrol - memoize edilmiş
  const shouldScaleText = useMemo(() => {
    return shouldAnimate || (isFirstRenderRef.current && normalizedProgress > 0);
  }, [shouldAnimate, normalizedProgress]);

  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <Svg width={size} height={fullCircle ? size : (size / 2 + strokeWidth / 2)} viewBox={`0 0 ${size} ${fullCircle ? size : (size / 2 + strokeWidth / 2)}`}>
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={progressColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={progressColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.progressBar || '#e0e0e0'}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={fullCircle ? undefined : `${circumference} ${circumference}`}
          strokeDashoffset={fullCircle ? 0 : circumference / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      {/* Progress text */}
      {showText && (
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Animated.Text style={[
            typography.styles.body,
            {
              fontSize: 40,
              fontWeight: 'bold',
              color: colors.cardQuestionText || '#333',
              textAlign: 'center',
              transform: [{ scale: shouldScaleText ? textScaleAnim : 1 }],
            },
            textStyle
          ]}>
            {Math.round(progressPercent)}%
          </Animated.Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default React.memo(CircularProgress);
