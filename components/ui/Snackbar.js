import React, { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react';
import { Snackbar, Portal } from 'react-native-paper';
import { StyleSheet, Animated, View, Text } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

const SnackbarContext = createContext(null);

/**
 * Snackbar Provider - Native snackbar için context provider
 * iOS ve Android'de native görünüm sağlar (react-native-paper kullanır)
 * Üstten gelir ve kenarlardan boşluklu (yapışık değil)
 */
export const SnackbarProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('default'); // 'success', 'error', 'default'
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const showSnackbar = useCallback((text, snackbarType = 'default') => {
    // Önceki timer'ı temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setMessage(text);
    setType(snackbarType);
    setVisible(true);
    translateY.setValue(0);
  }, [translateY]);

  const hideSnackbar = useCallback(() => {
    // Timer'ı temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setVisible(false);
    translateY.setValue(0);
  }, [translateY]);

  // Otomatik kapanma için useEffect
  useEffect(() => {
    if (visible) {
      // 3 saniye sonra otomatik kapat (yukarı kaydırarak)
      timeoutRef.current = setTimeout(() => {
        // Yukarı kaydırma animasyonu ile kapat
        Animated.timing(translateY, {
          toValue: verticalScale(-300),
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          hideSnackbar();
        });
      }, 3000);
      
      // Cleanup function
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [visible, hideSnackbar, translateY]);

  const handleGestureEvent = useCallback((event) => {
    const { translationY } = event.nativeEvent;
    // Sadece yukarı kaydırma (negatif değer)
    if (translationY < 0) {
      translateY.setValue(translationY);
    }
  }, [translateY]);

  const handleGestureStateChange = useCallback((event) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    if (state === State.END) {
      // Yukarı kaydırma eşiği: -50px veya hızlı yukarı kaydırma
      if (translationY < verticalScale(-50) || velocityY < -500) {
        // Yukarı kaydırıldı, snackbar'ı kapat (timer'ı da temizle)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        Animated.timing(translateY, {
          toValue: verticalScale(-300),
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          hideSnackbar();
        });
      } else {
        // Eşik altında, geri dön
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    }
  }, [translateY, hideSnackbar]);

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
      marginTop: insets.top + verticalScale(8),
      marginHorizontal: scale(16),
      borderRadius: moderateScale(15),
      borderWidth: moderateScale(1),
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
      <Portal>
        <View style={styles.wrapper} pointerEvents="box-none">
          {visible && (
            <PanGestureHandler
              onGestureEvent={handleGestureEvent}
              onHandlerStateChange={handleGestureStateChange}
              activeOffsetY={[-5, 5]}
              failOffsetX={[-20, 20]}
            >
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
            </PanGestureHandler>
          )}
        </View>
      </Portal>
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
  snackbarPaperWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 'auto',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    minHeight: verticalScale(48),
  },
  iconContainer: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: moderateScale(16),
    borderWidth: moderateScale(1),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  icon: {
    // Icon stilleri burada
  },
  message: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '500',
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
