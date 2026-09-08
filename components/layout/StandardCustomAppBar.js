import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import ProfileAvatarButton from './ProfileAvatarButton';

export default function StandardCustomAppBar({
  title,
  showLogo = false,
  isHeroBackground = false,
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
                { color: textColor, fontSize: moderateScale(24), letterSpacing: moderateScale(-1) },
              ]}
            >
              Knowia
            </Text>
          </View>
        ) : (
          <Text style={[typography.styles.subtitle, styles.titleText, { color: textColor, fontSize: moderateScale(22) }]}>
            {title}
          </Text>
        )}

        <View style={styles.headerAvatarAbsolute}>
          <ProfileAvatarButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: scale(14),
    paddingBottom: verticalScale(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    width: '100%',
    minHeight: verticalScale(44),
  },
  logoImage: {
    width: scale(44),
    height: scale(44),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    textAlign: 'center',
    fontWeight: '600',
  },
});