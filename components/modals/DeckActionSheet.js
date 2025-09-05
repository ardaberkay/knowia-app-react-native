import React, { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity, Text } from 'react-native';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isDeckOwner, setIsDeckOwner] = useState(false);
  const [favoriteStatus, setFavoriteStatus] = useState(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (deck && currentUserId) {
      // Check if current user is the owner of the deck
      const isOwner = deck.user_id === currentUserId;
      setIsDeckOwner(isOwner);
      
      // Check favorite status
      checkFavoriteStatus();
    }
  }, [deck, currentUserId]);

  const checkFavoriteStatus = async () => {
    if (!deck || !currentUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('favorite_decks')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('deck_id', deck.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking favorite status:', error);
        return;
      }
      
      setFavoriteStatus(!!data);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!deck || !currentUserId) return;
    
    try {
      if (favoriteStatus) {
        // Remove from favorites
        const { error } = await supabase
          .from('favorite_decks')
          .delete()
          .eq('user_id', currentUserId)
          .eq('deck_id', deck.id);
        
        if (error) throw error;
        setFavoriteStatus(false);
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('favorite_decks')
          .insert({
            user_id: currentUserId,
            deck_id: deck.id
          });
        
        if (error) throw error;
        setFavoriteStatus(true);
      }
      
      // Call the parent callback if provided
      if (onToggleFavorite) {
        onToggleFavorite();
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

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
            {isDeckOwner ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={handleEdit}
              >
                <Iconify icon="akar-icons:edit" size={22} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>{t('home.edit', 'Düzenle')}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={handleToggleFavorite}
            >
              <Iconify
                icon={favoriteStatus ? 'solar:heart-bold' : 'solar:heart-broken'}
                size={22}
                color={favoriteStatus ? '#F98A21' : colors.text}
                style={{ marginRight: 12 }}
              />
              <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: favoriteStatus ? '#F98A21' : colors.text }]}>
                {favoriteStatus ? t('home.removeFavorite', 'Favorilerden Çıkar') : t('home.addFavorite', 'Favorilere Ekle')}
              </Text>
            </TouchableOpacity>

            {isDeckOwner ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={handleDelete}
              >
                <Iconify icon="mdi:garbage" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
                <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: '#E74C3C' }]}>{t('home.deleteDeck', 'Desteyi Sil')}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={onClose}>
              <Iconify icon="material-symbols:close-rounded" size={22} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[typography.styles.body, { fontSize: 16, fontWeight: '500', color: colors.text }]}>{t('home.close', 'Kapat')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </Modal>
  );
}


