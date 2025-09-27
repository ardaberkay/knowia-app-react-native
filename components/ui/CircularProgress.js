import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';

const CircularProgress = ({ 
  progress = 0, 
  size = 120, 
  strokeWidth = 8, 
  showText = true,
  textStyle = {},
  containerStyle = {}
}) => {
  const { colors } = useTheme();
  
  // Progress 0-1 arasında olmalı
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  
  // Yarım daire için radius ve circumference hesaplama
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Yarım daire için π * radius
  
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
  
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <Svg width={size} height={size / 2 + strokeWidth / 2} viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`}>
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={progressColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={progressColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        
        {/* Background circle (yarım daire) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.progressBar || '#e0e0e0'}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        
        {/* Progress circle (yarım daire) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset + circumference / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      {/* Progress text */}
      {showText && (
        <View style={{
          position: 'absolute',
          top: size / 2 - 20,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text style={[
            typography.styles.body,
            {
              fontSize: 18,
              fontWeight: 'bold',
              color: colors.cardQuestionText || '#333',
              textAlign: 'center'
            },
            textStyle
          ]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>
      )}
    </View>
  );
};

export default CircularProgress;
