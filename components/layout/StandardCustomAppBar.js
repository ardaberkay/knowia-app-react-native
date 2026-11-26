import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text } from '../ui/AppText';
import { Iconify } from 'react-native-iconify';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography, fontSizes, fonts } from '../../theme/typography';
import ProfileAvatarButton from './ProfileAvatarButton';

export default function StandardCustomAppBar({
  title,
  showLogo = false,
  isHeroBackground = false,
  // Optional study streak pill (Home). null = not shown; 0 = shown dimmed.
  streak = null,
  onStreakPress,
  // Home hides it: Profile has its own tab and the streak pill opens it.
  showAvatar = true,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const textColor = isHeroBackground ? '#FFFFFF' : colors.text;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: isHeroBackground ? 'transparent' : colors.appbar,
          borderBottomColor: isHeroBackground ? 'transparent' : colors.border,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.headerContent}>
        {showLogo ? (
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/home_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text
              style={[
                typography.styles.body,
                { color: textColor, fontSize: fontSizes.title2, letterSpacing: -1 },
              ]}
            >
              Knowia
            </Text>
          </View>
        ) : (
          <Text style={[typography.styles.bodyLarge, styles.titleText, { color: textColor, fontSize: fontSizes.title2 }]}>
            {title}
          </Text>
        )}

        <View style={styles.headerRight}>
          {streak != null ? (
            <TouchableOpacity
              onPress={onStreakPress}
              disabled={!onStreakPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              style={[
                styles.streak,
                {
                  // No streak yet: same colours, just dimmer (a grey would
                  // vanish on the orange hero); fully lit once a goal is met.
                  backgroundColor: isHeroBackground
                    ? `rgba(255, 255, 255, ${streak > 0 ? 0.22 : 0.14})`
                    : colors.cardBackground,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: streak > 0 ? 1 : 0.7 }}>
                <Iconify icon="mdi:fire" size={18} color={textColor} />
                <Text style={[styles.streakText, { color: textColor }]}>{streak}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {showAvatar ? <ProfileAvatarButton /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // ~32pt tall: balanced against the 44pt logo, easy to tap.
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  streakText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
  },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    width: '100%',
    minHeight: 44,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    textAlign: 'center',
    fontFamily: fonts.semibold,
  },
});