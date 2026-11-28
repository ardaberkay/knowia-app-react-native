import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Image } from '../ui/AppImage';
import { Text, TextInput } from '../ui/AppText';
import FormScrollView from './FormScrollView';
import { updateCard } from '../../services/CardService';
import { uploadCardImage, removeUnusedCardImages } from '../../services/StorageService';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import CreateButton from '../tools/CreateButton';
import UndoButton from '../tools/UndoButton';
import BadgeText from '../tools/BadgeText';
import { CommonActions } from '@react-navigation/native';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';

/**
 * "Kartı Düzenle" page (route EditCard), opened from the card detail sheet.
 * params: { card, deck, returnKey } — returnKey is the cards screen's route
 * key; the saved card is handed back to it as its `editedCard` param, then
 * the page closes.
 */
export function EditCardScreen({ route, navigation }) {
  const { card, deck, returnKey } = route.params || {};
  const handleSave = (updatedCard) => {
    if (returnKey) {
      navigation.dispatch({ ...CommonActions.setParams({ editedCard: updatedCard }), source: returnKey });
    }
    navigation.goBack();
  };
  return <AddEditCardInlineForm card={card} deck={deck} onSave={handleSave} onCancel={() => navigation.goBack()} />;
}

export default function AddEditCardInlineForm({ card, deck, onSave, onCancel }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
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
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: 'webp' }
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
    const MAX_QUESTION_LENGTH = 400;
    const MAX_ANSWER_LENGTH = 300;
    const MAX_EXAMPLE_LENGTH = 200;
    const MAX_NOTE_LENGTH = 200;
    if (!question.trim() || !answer.trim()) {
      Alert.alert(t('common.error', 'Hata'), t('common.requiredFields', 'Soru ve cevap zorunludur.'));
      return;
    }
    if (question.trim().length > MAX_QUESTION_LENGTH) {
      Alert.alert(t('common.error', 'Hata'), t('addCard.questionTooLong', `Soru en fazla ${MAX_QUESTION_LENGTH} karakter olabilir.`));
      return;
    }
    if (answer.trim().length > MAX_ANSWER_LENGTH) {
      Alert.alert(t('common.error', 'Hata'), t('addCard.answerTooLong', `Cevap en fazla ${MAX_ANSWER_LENGTH} karakter olabilir.`));
      return;
    }
    if (example.trim().length > MAX_EXAMPLE_LENGTH) {
      Alert.alert(t('common.error', 'Hata'), t('addCard.exampleTooLong', `Örnek en fazla ${MAX_EXAMPLE_LENGTH} karakter olabilir.`));
      return;
    }
    if (note.trim().length > MAX_NOTE_LENGTH) {
      Alert.alert(t('common.error', 'Hata'), t('addCard.noteTooLong', `Not en fazla ${MAX_NOTE_LENGTH} karakter olabilir.`));
      return;
    }
    setLoading(true);
    let imageUrl = card?.image || '';
    let uploadedUrl = null;
    try {
      if (imageChanged) {
        if (image) {
          const base64 = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
          const buffer = Buffer.from(base64, 'base64');
          imageUrl = await uploadCardImage(deck.id, userId, buffer);
          uploadedUrl = imageUrl;
        } else {
          imageUrl = null;
        }
      }
      const updatedCard = await updateCard(card.id, {
        question: question.trim(),
        answer: answer.trim(),
        example: example.trim() || null,
        note: note.trim() || null,
        image: imageUrl || null,
      });
      onSave(updatedCard);
    } catch (e) {
      // Kayıt başarısız: yeni yüklenen görsel boşta kalmasın (eski görsel yerinde)
      if (uploadedUrl) removeUnusedCardImages([uploadedUrl]);
      Alert.alert(t('common.error', 'Hata'), e.message || t('common.cardNotSaved', 'Kart güncellenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScrollView contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.formContainer, { backgroundColor: colors.background }]}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={24}
      showsVerticalScrollIndicator={false}
    >
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackground,
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
                <View style={styles.labelTextContainer}>
                  <PhosphorIcon icon={ICONS.image} size={24} color="#F98A21" style={styles.labelIcon} />
                  <Text style={[styles.label, { fontSize: fontSizes.body }, {color: colors.text}]}>{t("cardDetail.image", "Kart Görseli")}</Text>
                </View>
                <View>
                  <BadgeText required={false} />
                </View>
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
                <PhosphorIcon icon={ICONS.add} size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("cardDetail.addImage", "Fotoğraf Ekle")}</Text>
              </TouchableOpacity>
            )}
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackground,
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
                <View style={styles.labelTextContainer}>
                <PhosphorIcon icon={ICONS.question} size={24} color="#F98A21" />
                <Text style={[styles.label, { fontSize: fontSizes.body }, {color: colors.text}]}>{t("cardDetail.question", "Soru")}</Text>
                </View>
                <View>
                  <BadgeText required={true} />
                </View>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: question?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
                    <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackground,
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
                <View style={styles.labelTextContainer}>
                <PhosphorIcon icon={ICONS.answer} size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, {color: colors.text}]}>{t("cardDetail.answer", "Cevap")}</Text>
                </View>
                <View>
                  <BadgeText required={true} />
                </View>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: answer?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
                    <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackground,
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
                <View style={styles.labelTextContainer}>
                <PhosphorIcon icon={ICONS.hint} size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, {color: colors.text}]}>{t("cardDetail.example", "Örnek")}</Text>
                </View>
                <View>
                  <BadgeText required={false} />
                </View>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: example?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
                    <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.inputCard, { 
            backgroundColor: colors.cardBackground,
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
                <View style={styles.labelTextContainer}>
                <PhosphorIcon icon={ICONS.note} size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, {color: colors.text}]}>{t("cardDetail.note", "Not")}</Text>
                </View>
                <View>
                  <BadgeText required={false} />
                </View>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: note?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
                    <PhosphorIcon icon={ICONS.close} size={18} color={colors.muted} />
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
    </FormScrollView>
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
    justifyContent: 'space-between',
    marginBottom: 12,

  },
  labelTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
  },
  input: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    fontSize: fontSizes.body,
  },
  cardImage: {
    width: '100%',
    height: 160,
    borderRadius: 18,
    marginBottom: 8,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
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
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
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
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 24,
    marginBottom: 52,
  },
}); 