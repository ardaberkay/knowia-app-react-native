import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Iconify } from 'react-native-iconify';

export default function CardActionMenu({ 
  visible, 
  onClose, 
  card, 
  deck, 
  currentUserId, 
  isFavorite, 
  onToggleFavorite, 
  onEdit, 
  onDelete,
  favLoading = false 
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleDelete = () => {
    Alert.alert(
      t("cardDetail.deleteConfirmation", "Kart Silinsin mi?"), 
      t("cardDetail.deleteConfirm", "Kartı silmek istediğinize emin misiniz?"), 
      [
        { text: t("cardDetail.cancel", "İptal"), style: 'cancel' },
        {
          text: t('cardDetail.delete', 'Sil'), 
          style: 'destructive', 
          onPress: onDelete
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'transparent' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={{ 
        position: 'absolute', 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: colors.background, 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30, 
        paddingTop: 12, 
        paddingBottom: 32, 
        paddingHorizontal: 24, 
        elevation: 16 
      }}>
        <View style={{ 
          width: 40, 
          height: 5, 
          borderRadius: 3, 
          backgroundColor: colors.border, 
          alignSelf: 'center', 
          marginBottom: 16 
        }} />
        
        {/* Kartı Düzenle sadece kendi kartıysa */}
        {currentUserId && deck.user_id === currentUserId && (
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingVertical: 16, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.border 
            }}
            onPress={() => { 
              onClose(); 
              onEdit(); 
            }}
          >
            <Iconify 
              icon="akar-icons:edit" 
              size={22} 
              color={colors.text} 
              style={{ marginRight: 12 }} 
            />
            <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>
              {t("cardDetail.edit", "Kartı Düzenle")}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Favorilere Ekle/Çıkar */}
        <TouchableOpacity 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingVertical: 16, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.border 
          }}
          onPress={onToggleFavorite}
          disabled={favLoading}
        >
          <Iconify
            icon={isFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
            size={22}
            color={isFavorite ? '#F98A21' : colors.text}
            style={{ marginRight: 12 }}
          />
          <Text style={[typography.styles.body, { 
            fontSize: 16, 
            fontWeight: '500', 
            color: isFavorite ? '#F98A21' : colors.text 
          }]}>
            {isFavorite ? t("cardDetail.removeFavorite", "Favorilerden Çıkar") : t("cardDetail.addFavorite", "Favorilere Ekle")}
          </Text>
        </TouchableOpacity>
        
        {/* Kartı Sil sadece kendi kartıysa */}
        {currentUserId && deck.user_id === currentUserId && (
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingVertical: 16, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.border 
            }}
            onPress={handleDelete}
          >
            <Iconify 
              icon="mdi:garbage" 
              size={22} 
              color="#E74C3C" 
              style={{ marginRight: 12 }} 
            />
            <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: '#E74C3C' }]}>
              {t("cardDetail.deleteDeck", "Kartı Sil")}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} 
          onPress={onClose}
        >
          <Iconify 
            icon="material-symbols:close-rounded" 
            size={22} 
            color={colors.text} 
            style={{ marginRight: 12 }} 
          />
          <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>
            {t("cardDetail.close", "Kapat")}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
