import React, { useState, useCallback, createContext, useContext, useRef, useMemo } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { Text } from './AppText';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { Iconify } from 'react-native-iconify';
import { triggerHaptic } from '../../lib/hapticManager';
import { fontSizes, fonts } from '../../theme/typography';

const SnackbarContext = createContext(null);

/**
 * Snackbar Provider: top toast, inset from the edges, swipe up to dismiss.
 * Drawn as the last child of the provider (absolute, top layer of the RN root);
 * no third-party portal needed.
 */
export const SnackbarProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('default'); // 'success', 'error', 'default'
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const hideSnackbar = useCallback(() => {
    // Timer'ı temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Önce yukarı doğru (ekran dışına) yumuşakça kaydır
    Animated.timing(translateY, {
      toValue: -300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Animasyon tamamen bittikten sonra DOM'dan kaldır (Titremeyi önler)
      setVisible(false);
    });
  }, [translateY]);

  const showSnackbar = useCallback((text, snackbarType = 'default') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (snackbarType === 'success') {
      triggerHaptic('success');
    } else if (snackbarType === 'error') {
      triggerHaptic('error');
    } else {
      triggerHaptic('light');
    }
    
    setMessage(text);
    setType(snackbarType);
    
    // 1. Önce elementi DOM'a ekle (Şu an translateY -300'de, yani ekranın üstünde gizli)
    setVisible(true); 

    // 2. Hemen ardından ekranın içine doğru (0 noktasına) kaydırarak indir
    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // 3. 3 saniye sonra kapanma fonksiyonunu tetikle
    timeoutRef.current = setTimeout(() => {
      hideSnackbar();
    }, 3000);
  }, [translateY, hideSnackbar]);

  // Swipe up to dismiss; below the threshold it springs back.
  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-5, 5])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY < 0) translateY.setValue(e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < -50 || e.velocityY < -500) {
        hideSnackbar();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    }), [translateY, hideSnackbar]);

  const getIconName = () => {
    if (type === 'success') return 'hugeicons:tick-01';
    if (type === 'error') return 'bitcoin-icons:cross-filled';
    return 'mdi:information-variant';
  };

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const darkenColor = (hex, percent = 20) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const newR = Math.max(0, Math.floor(r * (1 - percent / 100)));
    const newG = Math.max(0, Math.floor(g * (1 - percent / 100)));
    const newB = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const getSnackbarStyle = () => {
    const baseColor = 
      type === 'success' ? (colors.success || '#27AE60') :
      type === 'error' ? (colors.error || '#EB5757') :
      (isDarkMode ? '#2C2C2C' : '#1C1C1C');
    
    const borderColor = darkenColor(baseColor, 30); // Mevcut rengin %20 daha koyusu
    
    return {
      backgroundColor: hexToRgba(baseColor, 0.96), // Düşük opacity arka plan (~15% opacity)
      marginTop: insets.top + 8,
      marginHorizontal: 16,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: borderColor,
    };
  };

  const getIconBorderColor = () => {
    const baseColor = 
      type === 'success' ? (colors.success || '#27AE60') :
      type === 'error' ? (colors.error || '#EB5757') :
      (isDarkMode ? '#2C2C2C' : '#1C1C1C');
    
    return darkenColor(baseColor, 20); // Snackbar border rengi ile aynı
  };

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      {children}
      <View style={styles.wrapper} pointerEvents="box-none">
          {visible && (
            <GestureDetector gesture={panGesture}>
              <Animated.View
                style={[
                  styles.snackbarContainer,
                  {
                    transform: [{ translateY }],
                  },
                ]}
              >
                <View style={[getSnackbarStyle(), styles.snackbarContent]}>
                  <View style={[styles.iconContainer, { 
                    borderColor: getIconBorderColor(),
                    backgroundColor: getIconBorderColor(),
                  }]}>
                    <Iconify 
                      icon={getIconName()} 
                      size={20}
                      color={
                        type === 'success' ? (colors.success || '#27AE60') :
                        type === 'error' ? (colors.error || '#EB5757') :
                        (isDarkMode ? '#FFFFFF' : '#000000')
                      }
                      style={styles.icon}
                    />
                  </View>
                  <Text style={[
                    styles.message,
                    {
                      color: '#FFFFFF'
                    }
                  ]}>
                    {message}
                  </Text>
                </View>
              </Animated.View>
            </GestureDetector>
          )}
        </View>
    </SnackbarContext.Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  snackbarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    // Icon stilleri burada
  },
  message: {
    flex: 1,
    fontSize: fontSizes.subhead,
    fontFamily: fonts.medium,
  },
});

/**
 * Hook to use snackbar
 */
export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
};

/**
 * Helper fonksiyonlar (hook kullanarak)
 */
export const useSnackbarHelpers = () => {
  const showSnackbar = useSnackbar();
  
  return {
    showSuccess: (message) => showSnackbar(message, 'success'),
    showError: (message) => showSnackbar(message, 'error'),
    showInfo: (message) => showSnackbar(message, 'default'),
    showSnackbar,
  };
};
