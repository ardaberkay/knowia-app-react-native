import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import * as SvgLib from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { moderateScale } from '../../lib/scaling';

const { Svg, Circle, Defs, LinearGradient, Stop } = SvgLib;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// İZOLE SAYACI: JS Thread'i boğmaz, takılma yapmaz, garantili çalışır.
const ProgressText = ({ progress, duration, colors, textStyle }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    
    // JS Thread'i 60fps ile boğmak yerine ~30fps ile güncelliyoruz (çok daha akıcı hissettirir)
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let currentProgress = elapsed / duration;

      if (currentProgress >= 1) {
        currentProgress = 1;
        clearInterval(timer);
      }

      // Reanimated'in Easing.out(Easing.cubic) formülünün birebir aynısı
      // Bu sayede çember yavaşladığında metin de aynı hızda yavaşlar, senkron kopmaz
      const easeOut = 1 - Math.pow(1 - currentProgress, 3);
      setCount(Math.round(easeOut * progress * 100));
      
    }, 30); // 30ms'de bir tık (Kasma yapması teknik olarak imkansız)

    return () => clearInterval(timer);
  }, [progress, duration]);

  return (
    <Text
      style={[
        typography.styles.body,
        {
          fontSize: moderateScale(32),
          fontWeight: 'bold',
          color: colors.cardQuestionText || '#333',
          textAlign: 'center',
        },
        textStyle
      ]}
    >
      {count}%
    </Text>
  );
};

const CircularProgress = ({ 
  progress = 0, 
  size = 120, 
  strokeWidth = 8, 
  showText = true,
  textStyle = {},
  containerStyle = {},
  shouldAnimate = true,
  fullCircle = false,
}) => {
  const { colors } = useTheme();
  const normalizedProgress = useMemo(() => Math.max(0, Math.min(1, progress)), [progress]);
  
  const { radius, circumference } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = (fullCircle ? 2 * Math.PI : Math.PI) * r;
    return { radius: r, circumference: c };
  }, [size, strokeWidth, fullCircle]);

  const animatedProgress = useSharedValue(0);
  const ANIMATION_DURATION = 1200; // İki tarafın da ortak süresi

  useEffect(() => {
    if (!shouldAnimate) {
      animatedProgress.value = normalizedProgress;
      return;
    }

    animatedProgress.value = 0;
    
    // ÇEMBER: Sadece Reanimated kontrolünde (Ekran kartında akar)
    animatedProgress.value = withTiming(normalizedProgress, {
      duration: ANIMATION_DURATION, 
      easing: Easing.out(Easing.cubic), 
    });

  }, [normalizedProgress, shouldAnimate, animatedProgress]);

  const animatedCircleProps = useAnimatedProps(() => {
    const offset = fullCircle 
      ? circumference * (1 - animatedProgress.value) 
      : (circumference / 2) + circumference * (1 - animatedProgress.value);
      
    return { strokeDashoffset: offset };
  });

  const bgColor = colors.progressBackground || '#e0e0e0';

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <Svg 
        width={size} 
        height={fullCircle ? size : (size / 2 + strokeWidth / 2)} 
        viewBox={`0 0 ${size} ${fullCircle ? size : (size / 2 + strokeWidth / 2)}`}
      >
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFD700" />
            <Stop offset="50%" stopColor="#F98A21" />
            <Stop offset="100%" stopColor="#DC143C" />
          </LinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={fullCircle ? 0 : circumference / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedCircleProps} 
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      {showText && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressText 
            progress={shouldAnimate ? normalizedProgress : progress} 
            duration={ANIMATION_DURATION}
            colors={colors}
            textStyle={textStyle}
          />
        </View>
      )}
    </View>
  );
};

export default React.memo(CircularProgress);