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
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.appbar,
          borderBottomColor: colors.border,
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
                { color: colors.text, fontSize: moderateScale(24), letterSpacing: moderateScale(-1) },
              ]}
            >
              Knowia
            </Text>
          </View>
        ) : (
          <Text style={[typography.styles.h2, styles.titleText, { color: colors.text }]}>
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
    paddingHorizontal: scale(12),
    paddingBottom: verticalScale(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    minHeight: verticalScale(44),
  },
  headerAvatarAbsolute: {
    position: 'absolute',
    right: scale(-24),
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
