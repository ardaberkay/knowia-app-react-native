import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import CreateButton from '../tools/CreateButton';
import UndoButton from '../tools/UndoButton';

export default function AddEditCardInlineForm({ card, deck, onSave, onCancel }) {
  const { colors } = useTheme();
  const [question, setQuestion] = useState(card?.question || '');
  const [answer, setAnswer] = useState(card?.answer || '');
  const [example, setExample] = useState(card?.example || '');
  const [note, setNote] = useState(card?.note || '');
  const [image, setImage] = useState(card?.image || '');
  const [imageChanged, setImageChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: 'jpeg' }
        );
        setImage(manipResult.uri);
        setImageChanged(true);
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Hata'), t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const handleRemoveImage = () => {
    setImage('');
    setImageChanged(true);
  };

  const handleUpdateCard = async () => {
    if (!question.trim() || !answer.trim()) {
      Alert.alert(t('common.error', 'Hata'), t('common.requiredFields', 'Soru ve cevap zorunludur.'));
      return;
    }
    setLoading(true);
    let imageUrl = card?.image || '';
    try {
      if (imageChanged) {
        if (image) {
          // Fotoğrafı yükle
          const user = (await supabase.auth.getUser()).data.user;
          const base64 = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
          const filePath = `card_${deck.id}_${user.id}_${Date.now()}.webp`;
          const buffer = Buffer.from(base64, 'base64');
          const { data, error: uploadError } = await supabase
            .storage
            .from('images')
            .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
          if (uploadError) throw uploadError;
          // Public URL al
          const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        } else {
          imageUrl = null;
        }
      }
      // Kartı güncelle
      const { data, error } = await supabase
        .from('cards')
        .update({
          question: question.trim(),
          answer: answer.trim(),
          example: example.trim() || null,
          note: note.trim() || null,
          image: imageUrl || null,
        })
        .eq('id', card.id)
        .select();
      if (error) throw error;
      onSave(data[0]);
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('common.cardNotSaved', 'Kart güncellenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={[styles.formContainer, { backgroundColor: colors.background }]}
      style={{ flex: 1 }}
    >
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Iconify icon="mage:image-fill" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.image", "Kart Görseli")}</Text>
              </View>
            {image ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: image }} style={styles.cardImage} />
                <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageButton}>
                  <Text style={styles.removeImageButtonText}>{t("cardDetail.removeImage", "Görseli Kaldır")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={styles.addImageButton}>
                <Iconify icon="ic:round-plus" size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("cardDetail.addImage", "Fotoğraf Ekle")}</Text>
              </TouchableOpacity>
            )}
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Iconify icon="uil:comment-alt-question" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.question", "Soru")} *</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: question?.length > 0 ? 48 : 12}]}
                  placeholder={t("cardDetail.questionPlaceholder", "Kartın sorusu")}
                  placeholderTextColor={colors.muted}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                />
                {question?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setQuestion('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ position: 'absolute', right: 12, top: 12, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Iconify icon="uil:comment-alt-check" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.answer", "Cevap")} *</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: answer?.length > 0 ? 48 : 12}]}
                  placeholder={t("cardDetail.answerPlaceholder", "Kartın cevabı")}
                  placeholderTextColor={colors.muted}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                />
                {answer?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setAnswer('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ position: 'absolute', right: 12, top: 12, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Iconify icon="lucide:lightbulb" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.example", "Örnek")}</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: example?.length > 0 ? 48 : 12}]}
                  placeholder={t("cardDetail.examplePlaceholder", "Örnek cümle (opsiyonel)")}
                  placeholderTextColor={colors.muted}
                  value={example}
                  onChangeText={setExample}
                  multiline
                />
                {example?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setExample('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ position: 'absolute', right: 12, top: 12, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackgroundTransparent || colors.cardBackground,
            borderColor: colors.cardBorder,
            borderWidth: 1,
            shadowColor: colors.shadowColor,
            shadowOffset: colors.shadowOffset,
            shadowOpacity: colors.shadowOpacity,
            shadowRadius: colors.shadowRadius,
            elevation: colors.elevation,
          }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Iconify icon="material-symbols-light:stylus-note" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.note", "Not")}</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: note?.length > 0 ? 48 : 12}]}
                  placeholder={t("cardDetail.notePlaceholder", "Not (opsiyonel)")}
                  placeholderTextColor={colors.muted}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                {note?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setNote('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ position: 'absolute', right: 12, top: 12, padding: 6, borderRadius: 12, backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.buttonRowModern}>
            <UndoButton
              onPress={onCancel}
              disabled={loading}
              text={t("cardDetail.cancel", "İptal Et")}
            />
            <CreateButton
              onPress={handleUpdateCard}
              disabled={loading}
              loading={loading}
              text={t("cardDetail.save", "Kaydet")}
            />
          </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,

  },
  inputCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 20,
    marginBottom: 11,
    shadowOffset: { width: 4, height: 6},
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 0.15,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    fontSize: 16,
  },
  cardImage: {
    width: 120,
    height: 160,
    borderRadius: 18,
    marginBottom: 8,
    resizeMode: 'cover',
    backgroundColor: '#f2f2f2',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#F98A21',
    marginTop: 6,
  },
  addImageButtonText: {
    color: '#F98A21',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 6,
  },
  removeImageButton: {
    backgroundColor: '#F98A21',
    borderWidth: 1,
    borderColor: '#F98A21',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 4,
    
  },
  removeImageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 24,
    marginBottom: 32,
  },
}); 