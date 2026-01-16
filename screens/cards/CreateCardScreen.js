import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import CreateButton from '../../components/tools/CreateButton';
import UndoButton from '../../components/tools/UndoButton';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import HowToCreateCardModal from '../../components/modals/HowToCreateCardModal';
import CsvUploadModal from '../../components/modals/CsvUploadModal';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function AddCardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { deck } = route.params;
  const { colors, isDarkMode } = useTheme();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [example, setExample] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState('');
  const [imageChanged, setImageChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [isHowToCreateCardModalVisible, setHowToCreateCardModalVisible] = useState(false);
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();

  useEffect(() => {
    if (route.params?.openCsvModal) {
      setCsvModalVisible(true);
      navigation.setParams({ openCsvModal: false });
    }
  }, [route.params?.openCsvModal]);

  const handleCardSaved = (card) => {
    showSuccess(t('common.addCardSuccess', 'Kart eklendi!'));
    setTimeout(() => {
      navigation.goBack();
    }, 500);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

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
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const handleRemoveImage = () => {
    setImage('');
    setImageChanged(true);
  };

  const handleCreateCard = async () => {
    if (!question.trim() || !answer.trim()) {
      showError(t('common.questionAndAnswerRequired', 'Soru ve cevap zorunludur.'));
      return;
    }
    setLoading(true);
    let imageUrl = '';
    try {
      if (imageChanged && image) {
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
      }
      // Kartı ekle
      const { data, error } = await supabase
        .from('cards')
        .insert({
          deck_id: deck.id,
          question: question.trim(),
          answer: answer.trim(),
          example: example.trim() || null,
          note: note.trim() || null,
          image: imageUrl || null,
        })
        .select();
      if (error) throw error;
      handleCardSaved(data[0]);
    } catch (e) {
      showError(e.message || t('common.addCardError', 'Kart eklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setQuestion('');
    setAnswer('');
    setExample('');
    setNote('');
    setImage('');
    setImageChanged(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CsvUploadModal
        isVisible={csvModalVisible}
        onClose={() => setCsvModalVisible(false)}
        deck={deck}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.formContainer, { backgroundColor: colors.background }]}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={verticalScale(120)}
      >
          {/* Header Card */}
          <View style={[styles.headerCard, styles.headerCardContainer, { borderRadius: moderateScale(28), backgroundColor: colors.cardBackground || colors.cardBackgroundTransparent || (isDarkMode ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.1)') }]}>
            <View style={[styles.headerCardContent, styles.headerContent]}>
              <View style={styles.headerTitleContainer}>
                <Iconify icon="hugeicons:file-add" size={moderateScale(26)} color="#F98A21" style={{ marginRight: scale(6) }} />
                <Text style={[typography.styles.h2, { color: colors.text}]}>
                  {t('addCard.title', 'Kart Oluştur')}
                </Text>
              </View>
              <View style={styles.headerBottomRow}>
                <View style={styles.headerTextColumn}>
                  <Text style={[typography.styles.caption, { color: colors.muted, lineHeight: verticalScale(22), flex: 1, alignSelf: 'flex-start' }]}>
                    {t('addCard.motivationText', 'Bilgini pekiştirmek için soru-cevap kartları oluştur ve öğrenme sürecini hızlandır.')}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.howToCreateButton, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}
                    activeOpacity={0.7}
                    onPress={() => setHowToCreateCardModalVisible(true)}
                  >
                    <Iconify icon="material-symbols:info-outline" size={moderateScale(16)} color={colors.secondary} style={{ marginRight: scale(4) }} />
                    <Text style={[typography.styles.caption, { color: colors.secondary, fontWeight: '600', textDecorationLine: 'underline' }]}>
                      {t('addCard.howToCreate', 'Nasıl Oluşturulur?')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.headerImageContainer}>
                  <Image
                    source={require('../../assets/create-card-item.png')}
                    style={styles.headerImage}
                    resizeMode="contain"
                  />
                </View>
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
                <Iconify icon="mage:image-fill" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.image", "Kart Görseli")}</Text>
              </View>
            {image ? (
              <View style={{ alignItems: 'center', marginBottom: verticalScale(8) }}>
                <Image source={{ uri: image }} style={styles.cardImage} />
                <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageButton}>
                  <Text style={styles.removeImageButtonText}>{t("addCard.removeImage", "Görseli Kaldır")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={styles.addImageButton}>
                <Iconify icon="ic:round-plus" size={moderateScale(24)} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("addCard.addImage", "Fotoğraf Ekle")}</Text>
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
                <Iconify icon="uil:comment-alt-question" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.question", "Soru")} *</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: question?.length > 0 ? scale(48) : scale(12)}]}
                  placeholder={t("addCard.questionPlaceholder", "Kartın sorusu")}
                  placeholderTextColor={colors.muted}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                />
                {question?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setQuestion('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                    style={{ position: 'absolute', right: scale(12), top: verticalScale(12), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
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
                <Iconify icon="uil:comment-alt-check" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.answer", "Cevap")} *</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: answer?.length > 0 ? scale(48) : scale(12)}]}
                  placeholder={t("addCard.answerPlaceholder", "Kartın cevabı")}
                  placeholderTextColor={colors.muted}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                />
                {answer?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setAnswer('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                    style={{ position: 'absolute', right: scale(12), top: verticalScale(12), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
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
                <Iconify icon="lucide:lightbulb" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.example", "Örnek")}</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: example?.length > 0 ? scale(48) : scale(12)}]}
                  placeholder={t("addCard.examplePlaceholder", "Örnek cümle (opsiyonel)")}
                  placeholderTextColor={colors.muted}
                  value={example}
                  onChangeText={setExample}
                  multiline
                />
                {example?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setExample('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                    style={{ position: 'absolute', right: scale(12), top: verticalScale(12), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
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
                <Iconify icon="material-symbols-light:stylus-note" size={moderateScale(24)} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.note", "Not")}</Text>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, typography.styles.body, {color: colors.text, paddingRight: note?.length > 0 ? scale(48) : scale(12)}]}
                  placeholder={t("addCard.notePlaceholder", "Not (opsiyonel)")}
                  placeholderTextColor={colors.muted}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                {note?.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setNote('')}
                    accessibilityLabel={t('common.clear', 'Temizle')}
                    hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
                    style={{ position: 'absolute', right: scale(12), top: verticalScale(12), padding: moderateScale(6), borderRadius: moderateScale(12), backgroundColor: colors.iconBackground }}
                  >
                    <Iconify icon="material-symbols:close-rounded" size={moderateScale(18)} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.buttonRowModern}>
            <UndoButton
              onPress={handleResetForm}
              disabled={loading}
              text={t("addCard.undo", "Geri Al")}
            />
            <CreateButton
              onPress={handleCreateCard}
              disabled={loading}
              loading={loading}
              text={t("addCard.createCard", "Kartı Oluştur")}
            />
          </View>
        </KeyboardAwareScrollView>

      <HowToCreateCardModal
        isVisible={isHowToCreateCardModalVisible}
        onClose={() => setHowToCreateCardModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: scale(16),
    paddingTop: verticalScale(8),
  },
  headerCard: {
    width: '100%',
    marginBottom: verticalScale(12),
    marginTop: verticalScale(8),
  },
  headerCardContainer: {
    borderRadius: moderateScale(28),
    overflow: 'hidden',
    marginHorizontal: scale(10),
    marginVertical: verticalScale(8),
    paddingVertical: verticalScale(10),
  },
  headerCardContent: {
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    minHeight: verticalScale(180),
  },
  headerContent: {
    paddingVertical: verticalScale(8),
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextColumn: {
    flex: 1,
    marginRight: scale(12),
  },
  howToCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(20),
    borderWidth: moderateScale(1),
    marginTop: verticalScale(12),
  },
  headerImageContainer: {
    width: scale(120),
    height: scale(120),
    marginLeft: scale(12),
  },
  headerImage: {
    width: scale(140),
    height: scale(140),
    alignSelf: 'flex-end',
    top: '-10%',
  },
  inputCard: {
    width: '100%',
    maxWidth: scale(440),
    borderRadius: moderateScale(28),
    padding: moderateScale(20),
    marginBottom: verticalScale(11),
    shadowOffset: { width: scale(4), height: verticalScale(6)},
    shadowOpacity: 0.10,
    shadowRadius: moderateScale(10),
    elevation: 5,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  labelIcon: {
    marginRight: scale(8),
  },
  label: {
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
  input: {
    borderWidth: moderateScale(0.15),
    borderColor: '#eee',
    borderRadius: moderateScale(8),
    padding: scale(12),
    marginBottom: 0,
    fontSize: moderateScale(16),
  },
  cardImage: {
    width: scale(120),
    height: verticalScale(160),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(8),
    resizeMode: 'cover',
    backgroundColor: '#f2f2f2',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(28),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(18),
    borderWidth: moderateScale(1),
    borderColor: '#F98A21',
    marginTop: verticalScale(6),
  },
  addImageButtonText: {
    color: '#F98A21',
    fontWeight: 'bold',
    fontSize: moderateScale(15),
    marginLeft: scale(6),
  },
  removeImageButton: {
    backgroundColor: '#F98A21',
    borderWidth: moderateScale(1),
    borderColor: '#F98A21',
    borderRadius: moderateScale(28),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(18),
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  removeImageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(15),
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: scale(20),
    marginTop: verticalScale(24),
    marginBottom: verticalScale(32),
  },
});
