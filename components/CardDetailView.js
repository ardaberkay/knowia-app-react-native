import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';

export default function CardDetailView({ card, showCreatedAt = true }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!card) return null;

  return (
    <View 
      style={{ flex: 1 }} 
      contentContainerStyle={{ paddingTop: 18, paddingBottom: 8, flexGrow: 1 }} 
      showsVerticalScrollIndicator={false}
    >
      {/* Görsel */}
      {card?.image ? (
        <View style={[styles.inputCard, {maxHeight: 220}, {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        }]}>
          <View style={[styles.labelRow]}>
            <Iconify icon="mage:image-fill" size={20} color="#F98A21" style={styles.labelIcon} />
            <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
              {t("cardDetail.image", "Kart Görseli")}
            </Text>
          </View>
          <View style={{ alignSelf: 'center'}}>
            <Image source={{ uri: card.image }} style={styles.cardImage} />
          </View>
        </View>
      ) : null}

      {/* Soru */}
      <View style={[styles.inputCard, {
        backgroundColor: colors.cardBackground,
        borderColor: colors.cardBorder,
        shadowColor: colors.shadowColor,
        shadowOffset: colors.shadowOffset,
        shadowOpacity: colors.shadowOpacity,
        shadowRadius: colors.shadowRadius,
        elevation: colors.elevation,
      }]}>
        <View style={styles.labelRow}>
          <Iconify icon="uil:comment-alt-question" size={20} color="#F98A21" style={styles.labelIcon} />
          <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
            {t("cardDetail.question", "Soru")}
          </Text>
        </View>
        <ScrollView 
          style={styles.scrollableContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, borderRadius: 8, padding: 12 }]}>
            {card?.question}
          </Text>
        </ScrollView>
      </View>

      {/* Cevap */}
      {card?.answer ? (
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        }]}>
          <View style={styles.labelRow}>
            <Iconify icon="uil:comment-alt-check" size={20} color="#F98A21" style={styles.labelIcon} />
            <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
              {t("cardDetail.answer", "Cevap")}
            </Text>
          </View>
          <ScrollView 
            style={styles.scrollableContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, borderRadius: 8, padding: 12 }]}>
              {card.answer}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Örnek */}
      {card?.example ? (
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        }]}>
          <View style={styles.labelRow}>
            <Iconify icon="lucide:lightbulb" size={20} color="#F98A21" style={styles.labelIcon} />
            <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
              {t("cardDetail.example", "Örnek")}
            </Text>
          </View>
          <ScrollView 
            style={styles.scrollableContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <Text style={[typography.styles.body, { fontSize: 16, color: colors.cardAnswerText, borderRadius: 8, padding: 12 }]}>
              {card.example}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Not */}
      {card?.note ? (
        <View style={[styles.inputCard, {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOffset: colors.shadowOffset,
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: colors.shadowRadius,
          elevation: colors.elevation,
        }]}>
          <View style={styles.labelRow}>
            <Iconify icon="material-symbols-light:stylus-note" size={20} color="#F98A21" style={styles.labelIcon} />
            <Text style={[styles.label, typography.styles.body, {color: colors.cardQuestionText}]}>
              {t("cardDetail.note", "Not")}
            </Text>
          </View>
          <ScrollView 
            style={styles.scrollableContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <Text style={[styles.cardAnswer, typography.styles.body, { color: colors.cardAnswerText }]}>
              {card.note}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Oluşturulma tarihi */}
      {showCreatedAt && card?.created_at ? (
        <View style={{ paddingHorizontal: 18, marginTop: 'auto', marginBottom: 12 }}>
          <Text style={[typography.styles.caption, { color: colors.muted, textAlign: 'center', fontSize: 14 }]}>
            {t("cardDetail.createdAt", "Oluşturulma Tarihi")} {new Date(card.created_at).toLocaleString('tr-TR')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    width: '%90',
    minHeight: 115,
    maxHeight: 115,
    borderRadius: 24,
    marginTop: 12,
    padding: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginHorizontal: 18,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardImage: {
    width: 120,
    height: 160,
    borderRadius: 18,

    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
    alignSelf: 'center',
  },
  cardAnswer: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
    borderRadius: 8,
    padding: 2,
    paddingTop: 0,
    marginTop: 0,
  },
  scrollableContent: {
    flex: 1,
  },
});
