import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Pressable } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function CardListItem({
  question,
  answer,
  onPress,
  onToggleFavorite,
  isFavorite,
  onDelete,
  canDelete,
  isOwner = true,
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[
        styles.cardItem,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
            {question}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
          <Text style={[styles.question, typography.styles.body, { color: colors.cardQuestionText }]} numberOfLines={1}>
            {answer}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.iconBackground }]}
            onPress={onToggleFavorite}
            hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
          >
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={moderateScale(22)}
              color={isFavorite ? '#F98A21' : '#B0B0B0'}
            />
          </TouchableOpacity>
          {canDelete ? (
            isOwner ? (
              <TouchableOpacity
                style={[
                  styles.deleteBtn, 
                  { 
                    backgroundColor: colors.iconBackground,
                  }
                ]}
                onPress={onDelete}
                activeOpacity={0.7}
              >
                <Iconify icon="mdi:garbage-can-empty" size={moderateScale(22)} color="#E74C3C" />
              </TouchableOpacity>
            ) : (
              <Pressable
                style={[
                  styles.deleteBtn, 
                  { 
                    backgroundColor: colors.iconBackground,
                    opacity: 0.5,
                  }
                ]}
                onPress={() => {
                  // Boş fonksiyon - hiçbir şey yapma
                }}
                android_ripple={null}
                pressRetentionOffset={0}
              >
                <Iconify icon="mdi:garbage" size={moderateScale(22)} color="#999" />
              </Pressable>
            )
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardItem: {
    width: '100%',
    minHeight: verticalScale(110),
    borderRadius: moderateScale(30),
    marginBottom: verticalScale(12),
    padding: scale(20),
    borderWidth: moderateScale(1),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  textCol: {
    width: '80%',
    maxWidth: scale(320),
  },
  question: {
    fontWeight: '600',
    fontSize: moderateScale(17),
    marginBottom: verticalScale(8),
    letterSpacing: moderateScale(0.3),
    marginTop: verticalScale(4),
  },
  divider: {
    height: moderateScale(2),
    alignSelf: 'stretch',
    marginVertical: verticalScale(8),
    borderRadius: moderateScale(2),
  },
  answer: {
    fontSize: moderateScale(15),
    marginTop: verticalScale(4),
    fontWeight: '400',
    letterSpacing: moderateScale(0.2),
  },
  iconBtn: {
    padding: moderateScale(8),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(4),
  },
  deleteBtn: {
    marginTop: verticalScale(8),
    padding: moderateScale(8),
    borderRadius: moderateScale(12),
  },
});


