import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../../lib/hapticManager';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

// export default function yerine const ile tanımlıyoruz
const CardListItem = ({
  question,
  answer,
  onPress,
  onToggleFavorite,
  isFavorite, // Üstten gelen asıl değer
  onDelete,
  canDelete,
  isOwner = true,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  
  // 1. İkonun anında değişmesi için lokal bir state oluşturuyoruz
  const [localIsFavorite, setLocalIsFavorite] = useState(isFavorite);

  // 2. Eğer üst bileşenden gelen isFavorite değişirse, lokal state'i de eşitle
  useEffect(() => {
    setLocalIsFavorite(isFavorite);
  }, [isFavorite]);

  // 3. Tıklama fonksiyonumuzu güncelliyoruz
  const handleFavoritePress = () => {
    triggerHaptic('medium'); 
    // Anında UI güncellemesi (Kullanıcı hiç beklemez)
    setLocalIsFavorite(!localIsFavorite); 
    // Arka planda asıl işlemi başlat
    onToggleFavorite(); 
  };

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
          {question ? (
            <Text style={[styles.question, { fontSize: fontSizes.body }, { color: colors.cardQuestionText }]} numberOfLines={1}>
              {question}
            </Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.cardDivider }]} />
          {answer ? (
            <Text style={[styles.question, { fontSize: fontSizes.body }, { color: colors.cardQuestionText }]} numberOfLines={1}>
              {answer}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.iconBackground }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleFavoritePress} // Yeni fonksiyonumuzu buraya bağladık
          >
            <PhosphorIcon
              // Artık üstten geleni değil, kendi anında değişen state'imizi dinliyor
              icon={localIsFavorite ? ICONS.favorite : ICONS.favoriteOff}
              size={22}
              color={localIsFavorite ? '#F98A21' : '#B0B0B0'}
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
                onPress={() => {
                  triggerHaptic('heavy');
                  onDelete();
                }}
                activeOpacity={0.7}
              >
                <PhosphorIcon icon={ICONS.delete} size={22} color="#E74C3C" />
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
                onPress={() => {}}
                android_ripple={null}
                pressRetentionOffset={0}
              >
                <PhosphorIcon icon={ICONS.delete} size={22} color="#999" />
              </Pressable>
            )
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

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
    fontFamily: fonts.semibold,
    fontSize: fontSizes.bodyLarge,
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
    fontSize: fontSizes.body,
    marginTop: 4,
    fontFamily: fonts.regular,
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

export default React.memo(CardListItem);