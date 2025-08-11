import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

export default function CardDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { card: initialCard, isOwner } = route.params;
  const { t } = useTranslation();
  const [card, setCard] = useState(initialCard);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [favLoading, setFavLoading] = useState(false);


  useEffect(() => {
    const fetchUserAndFavoriteStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      if (user) {
        const { data, error } = await supabase
          .from('favorite_cards')
          .select('card_id')
          .eq('user_id', user.id)
          .eq('card_id', card.id)
          .single();
        
        setIsFavorite(!!data);
      }
    };
    fetchUserAndFavoriteStatus();
  }, [card.id]);

  useEffect(() => {
    navigation.setOptions({
      title: t('cardDetail.cardDetail', 'Kart Detayı'),
      headerRight: () => (
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ marginRight: 8 }}>
          <MaterialCommunityIcons name="dots-horizontal" size={28} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.text]);

  const handleToggleFavorite = async () => {
    if (!currentUserId || favLoading) return;
    setFavLoading(true);

    try {
      if (isFavorite) {
        await supabase.from('favorite_cards').delete().match({ user_id: currentUserId, card_id: card.id });
        setIsFavorite(false);
      } else {
        await supabase.from('favorite_cards').insert({ user_id: currentUserId, card_id: card.id });
        setIsFavorite(true);
      }
    } catch (error) {
      // console.error("Favorite toggle error:", error);
    }
    setFavLoading(false);
    setMenuVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      t('cardDetail.deleteCard', 'Kartı Sil'),
      t('cardDetail.deleteCardConfirmation', 'Bu kartı kalıcı olarak silmek istediğinizden emin misiniz?'),
      [
        { text: t('cardDetail.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('cardDetail.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('cards').delete().eq('id', card.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(t('cardDetail.error', 'Hata'), t('cardDetail.deleteCardError', 'Kart silinirken bir hata oluştu.'));
            }
          },
        },
      ]
    );
  };

  const DetailField = ({ label, value, iconName }) => (
    value ? (
      <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
        <View style={styles.labelRow}>
          <Ionicons name={iconName} size={20} color="#F98A21" style={styles.labelIcon} />
          <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{label}</Text>
        </View>
        <Text style={[typography.styles.body, { fontSize: 16, color: colors.text, borderRadius: 8, padding: 12 }]}>{value}</Text>
      </View>
    ) : null
  );

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 18, paddingBottom: 8, flexGrow: 1 }} showsVerticalScrollIndicator={true}>
        {card?.image && (
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="image" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t('cardDetail.image', 'Kart Görseli')}</Text>
            </View>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <Image source={{ uri: card.image }} style={styles.cardImage} />
            </View>
          </View>
        )}
        <DetailField label={t('cardDetail.question', 'Soru')} value={card?.question} iconName="chatbubble-outline" />
        <DetailField label={t('cardDetail.answer', 'Cevap')} value={card?.answer} iconName="checkmark-circle-outline" />
        <DetailField label={t('cardDetail.example', 'Örnek')} value={card?.example} iconName="bulb-outline" />
        <DetailField label={t('cardDetail.note', 'Not')} value={card?.note} iconName="document-text-outline" />
        
        {/* Kartın oluşturulma tarihi - ScrollView içinde en altta */}
        {card?.created_at && (
          <View style={styles.dateContainer}>
            <Text style={[typography.styles.caption, { color: colors.muted, textAlign: 'center', fontSize: 14}]}>
              {t('cardDetail.createdAt', 'Oluşturulma')} {new Date(card.created_at).toLocaleString('tr-TR')}
            </Text>
          </View>
        )}
      </ScrollView>
      
       {/* Menü Modal */}
       <Modal
        visible={menuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'transparent' }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
          
          {isOwner && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('EditCard', { card: card });
              }}
            >
              <MaterialCommunityIcons name="pencil" size={22} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('cardDetail.edit', 'Kartı Düzenle')}</Text>  
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
            onPress={handleToggleFavorite}
            disabled={favLoading}
          >
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#F98A21' : colors.text}
              style={{ marginRight: 12 }}
            />
            <Text style={{ fontSize: 16, fontWeight: '500', color: isFavorite ? '#F98A21' : colors.text }}>
              {isFavorite ? t('cardDetail.removeFavorite', 'Favorilerden Çıkar') : t('cardDetail.addFavorite', 'Favorilere Ekle')}
            </Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => {
                setMenuVisible(false);
                handleDelete();
              }}
            >
              <MaterialCommunityIcons name="delete" size={22} color="#E74C3C" style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '500', color: '#E74C3C' }}>{t('cardDetail.deleteCard', 'Kartı Sil')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }} onPress={() => setMenuVisible(false)}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>{t('cardDetail.close', 'Kapat')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    marginHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    alignSelf: 'auto',
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
    fontWeight: '500',
  },
  cardImage: {
    width: 120,
    height: 160,
    borderRadius: 18,
    marginBottom: 8,
    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
    alignSelf: 'center',
  },
  dateContainer: {
    marginTop: 'auto',
    marginBottom: 12
  },
}); 