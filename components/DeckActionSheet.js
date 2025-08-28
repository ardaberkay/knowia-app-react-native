import React from 'react';
import { Modal, View, TouchableOpacity, Text } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';

export default function DeckActionSheet({
  visible,
  deck,
  colors,
  typography,
  isFavorite,
  canEdit,
  onClose,
  onEdit,
  onToggleFavorite,
  onDelete,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'transparent' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />

        {deck ? (
          <>
            {canEdit ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={onEdit}
              >
                <Iconify icon="akar-icons:edit" size={22} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>{t('home.edit', 'Düzenle')}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={onToggleFavorite}
            >
              <Iconify
                icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={22}
                color={isFavorite ? '#F98A21' : colors.text}
                style={{ marginRight: 12 }}
              />
              <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: isFavorite ? '#F98A21' : colors.text }]}>
                {isFavorite ? t('home.removeFavorite', 'Favorilerden Çıkar') : t('home.addFavorite', 'Favorilere Ekle')}
              </Text>
            </TouchableOpacity>

            {canEdit ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={onDelete}
              >
                <Iconify icon="mdi:garbage" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: '#E74C3C' }]}>{t('home.deleteDeck', 'Desteyi Sil')}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={onClose}>
              <Iconify icon="ic:round-plus" size={22} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>{t('home.close', 'Kapat')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </Modal>
  );
}


