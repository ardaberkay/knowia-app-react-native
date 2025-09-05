import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';

export default function CardListItem({
  question,
  answer,
  onPress,
  onToggleFavorite,
  isFavorite,
  onDelete,
  canDelete,
}) {
  const { colors } = useTheme();
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
          <Text style={[styles.answer, typography.styles.body, { color: colors.cardAnswerText }]} numberOfLines={1}>
            {answer}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.iconBackground }]}
            onPress={onToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Iconify
              icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
              size={22}
              color={isFavorite ? '#F98A21' : '#B0B0B0'}
            />
          </TouchableOpacity>
          {canDelete ? (
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: colors.iconBackground }]}
              onPress={onDelete}
            >
              <Iconify icon="mdi:garbage" size={22} color="#E74C3C" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardItem: {
    width: '100%',
    minHeight: 110,
    borderRadius: 30,
    marginBottom: 12,
    padding: 20,
    borderWidth: 1,
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
    maxWidth: 320,
  },
  question: {
    fontWeight: '600',
    fontSize: 17,
    marginBottom: 8,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  divider: {
    height: 2,
    alignSelf: 'stretch',
    marginVertical: 8,
    borderRadius: 2,
  },
  answer: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  deleteBtn: {
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
  },
});


