import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
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
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const textScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Progress 0-1 arasında olmalı
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  
  // Daire için radius ve circumference hesaplama (yarım veya tam)
  const radius = (size - strokeWidth) / 2;
  const circumference = (fullCircle ? 2 * Math.PI : Math.PI) * radius;
  
  // Progress'e göre stroke-dasharray hesaplama
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (normalizedProgress * circumference);
  
  // Progress'e göre renk koyulaştırma (0-100% arasında)
  const progressPercent = normalizedProgress * 100;
  
  // Renk interpolasyonu - progress arttıkça koyulaşır (ana tema turuncu çevresinde)
  const getProgressColor = () => {
    if (progressPercent === 0) return colors.progressBar || '#F1F1F1';
    if (progressPercent < 25) return '#FFD700'; // Altın sarısı
    if (progressPercent < 50) return '#FFA500'; // Turuncu
    if (progressPercent < 75) return '#F98A21'; // Ana tema turuncu
    if (progressPercent < 100) return '#FF4500'; // Kırmızı-turuncu
    return '#DC143C'; // Koyu kırmızı
  };
  
  const progressColor = getProgressColor();

  // Progress dolum animasyonu
  useEffect(() => {
    if (shouldAnimate) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: normalizedProgress,
        duration: 900,
        useNativeDriver: false,
      }).start();
      // Yüzdelik metin için boing (spring) animasyonu
      textScaleAnim.setValue(0.7);
      Animated.spring(textScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 14,
        speed: 12,
      }).start();
    }
  }, [normalizedProgress, shouldAnimate]);

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
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={[Animated.multiply(progressAnim, circumference), circumference]}
          strokeDashoffset={fullCircle ? 0 : circumference / 2}
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
              transform: [{ scale: shouldAnimate ? textScaleAnim : 1 }],
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

export default CircularProgress;
