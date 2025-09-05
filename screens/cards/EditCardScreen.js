import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { useTranslation } from 'react-i18next';

export default function EditCardScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { card } = route.params;
  const [question, setQuestion] = useState(card.question || '');
  const [answer, setAnswer] = useState(card.answer || '');
  const [example, setExample] = useState(card.example || '');
  const [note, setNote] = useState(card.note || '');
  const [image, setImage] = useState(card.image || '');
  const [imageChanged, setImageChanged] = useState(false);
  const [loading, setLoading] = useState(false);

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
    let imageUrl = card.image || '';
    try {
      if (imageChanged) {
        if (image) {
          // Fotoğrafı yükle
          const user = (await supabase.auth.getUser()).data.user;
          const base64 = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
          const filePath = `card_${card.deck_id}_${user.id}_${Date.now()}.webp`;
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
          // Fotoğraf kaldırıldı
          imageUrl = '';
        }
      }
      // Kartı güncelle
      const { error } = await supabase
        .from('cards')
        .update({
          question: question.trim(),
          answer: answer.trim(),
          example: example.trim() || null,
          note: note.trim() || null,
          image: imageUrl || null,
        })
        .eq('id', card.id);
      if (error) throw error;
      Alert.alert(t('common.success', 'Başarılı'), t('common.cardUpdated', 'Kart güncellendi!'), [
        { text: t('common.ok', 'Tamam'), onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('common.cardUpdatedError', 'Kart güncellenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}> 
            <View style={styles.labelRow}>
              <Ionicons name="image" size={20} color="#F98A21" style={styles.labelIcon} />
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
                <Ionicons name="add" size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("cardDetail.addImage", "Fotoğraf Ekle")}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}> 
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.question", "Soru")} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("cardDetail.questionPlaceholder", "Kartın sorusu")}
              placeholderTextColor={colors.muted}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}> 
            <View style={styles.labelRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.answer", "Cevap")} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("cardDetail.answerPlaceholder", "Kartın cevabı")}
              placeholderTextColor={colors.muted}
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}> 
            <View style={styles.labelRow}>
              <Ionicons name="bulb-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.example", "Örnek")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("cardDetail.examplePlaceholder", "Örnek cümle (opsiyonel)")}
              placeholderTextColor={colors.muted}
              value={example}
              onChangeText={setExample}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}> 
            <View style={styles.labelRow}>
              <Ionicons name="document-text-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("cardDetail.note", "Not")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("cardDetail.notePlaceholder", "Not (opsiyonel)")}
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[
                styles.favButtonModern,
                { flex: 1, minWidth: 0, marginRight: 10 },
                loading && { opacity: 0.7 }
              ]}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={[styles.favButtonTextModern, typography.styles.button, { color: '#F98A21' }]}>{t("cardDetail.cancel", "İptal Et")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.startButtonModern,
                { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.buttonBorder || 'transparent' },
                loading && { opacity: 0.7 }
              ]}
              onPress={handleUpdateCard}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.startButtonTextModern, typography.styles.button, { color: '#fff' }]}>{t("cardDetail.save", "Kaydet")}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    marginHorizontal: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    alignSelf: 'center',
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
  input: {
    borderWidth: 1,
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
    resizeMode: 'contain',
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8f0',
    borderRadius: 10,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F98A21',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  removeImageButtonText: {
    color: '#F98A21',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 30,
    marginBottom: 30,
  },
  favButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 5,
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 