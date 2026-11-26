import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Keyboard } from 'react-native';
import { Text, TextInput } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormScrollView from '../../components/layout/FormScrollView';
import { useAuth } from '../../contexts/AuthContext';
import { createCard } from '../../services/CardService';
import { uploadCardImage } from '../../services/StorageService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import * as FileSystem from 'expo-file-system/legacy';
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
import BadgeText from '../../components/tools/BadgeText';
import { triggerHaptic } from '../../lib/hapticManager';

export default function AddCardScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
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
    setQuestion('');
    setAnswer('');
    setExample('');
    setNote('');
    setImage('');
    setImageChanged(false);
  };


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
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const handleRemoveImage = () => {
    setImage('');
    setImageChanged(true);
  };

  const handleCreateCard = async () => {
    Keyboard.dismiss();
    const MAX_QUESTION_LENGTH = 400;
    const MAX_ANSWER_LENGTH = 300;
    const MAX_EXAMPLE_LENGTH = 200;
    const MAX_NOTE_LENGTH = 200;
    if (!question.trim() || !answer.trim()) {
      showError(t('common.questionAndAnswerRequired', 'Soru ve cevap zorunludur.'));
      return;
    }
    if (question.trim().length > MAX_QUESTION_LENGTH) {
      showError(t('addCard.questionTooLong', `Soru en fazla ${MAX_QUESTION_LENGTH} karakter olabilir.`));
      return;
    }
    if (answer.trim().length > MAX_ANSWER_LENGTH) {
      showError(t('addCard.answerTooLong', `Cevap en fazla ${MAX_ANSWER_LENGTH} karakter olabilir.`));
      return;
    }
    if (example.trim().length > MAX_EXAMPLE_LENGTH) {
      showError(t('addCard.exampleTooLong', `Örnek en fazla ${MAX_EXAMPLE_LENGTH} karakter olabilir.`));
      return;
    }
    if (note.trim().length > MAX_NOTE_LENGTH) {
      showError(t('addCard.noteTooLong', `Not en fazla ${MAX_NOTE_LENGTH} karakter olabilir.`));
      return;
    }
    setLoading(true);
    let imageUrl = '';
    try {
      if (imageChanged && image) {
        const base64 = await FileSystem.readAsStringAsync(image, { encoding: FileSystem.EncodingType.Base64 });
        const buffer = Buffer.from(base64, 'base64');
        imageUrl = await uploadCardImage(deck.id, userId, buffer);
      }
      const newCard = await createCard(deck.id, {
        question: question.trim(),
        answer: answer.trim(),
        example: example.trim() || null,
        note: note.trim() || null,
        image: imageUrl || null,
      });
      handleCardSaved(newCard);
    } catch (e) {
      showError(e.message || t('common.addCardError', 'Kart eklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    Keyboard.dismiss();
    setQuestion('');
    setAnswer('');
    setExample('');
    setNote('');
    setImage('');
    setImageChanged(false);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <CsvUploadModal
        isVisible={csvModalVisible}
        onClose={() => setCsvModalVisible(false)}
        deck={deck}
      />
      <FormScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.formContainer]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={[styles.headerCard, styles.headerCardContainer, { borderRadius: 44, backgroundColor: colors.cardBackground, borderColor: colors.cardBorder, borderWidth: 1 }]}>
          <View style={[styles.headerCardContent, styles.headerContent]}>
            <View style={styles.headerTitleContainer}>
              <Iconify icon="hugeicons:file-add" size={26} color="#F98A21" style={{ marginRight: 6 }} />
              <Text style={[typography.styles.title2, { color: colors.text }]}>
                {t('addCard.title', 'Kart Oluştur')}
              </Text>
            </View>
            <View style={styles.headerBottomRow}>
              <View style={styles.headerTextColumn}>
                <Text style={[typography.styles.subhead, { color: colors.muted, lineHeight: 22, flex: 1, alignSelf: 'flex-start' }]}>
                  {t('addCard.motivationText', 'Bilgini pekiştirmek için soru-cevap kartları oluştur ve öğrenme sürecini hızlandır.')}
                </Text>
                <TouchableOpacity
                  style={[styles.howToCreateButton, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('selection');
                    requestAnimationFrame(() => {
                      setHowToCreateCardModalVisible(true);
                    });
                  }}
                >
                  <Iconify icon="material-symbols:info-outline" size={16} color={colors.secondary} style={{ marginRight: 4 }} />
                  <Text style={[typography.styles.subhead, { color: colors.secondary, fontFamily: fonts.semibold}]}>
                    {t('addCard.howToCreate', 'Nasıl Oluşturulur?')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.headerImageContainer}>
                <Image
                  source={require('../../assets/create_card_item.webp')}
                  style={styles.headerImage}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </View>
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
                <Iconify icon="mage:image-fill" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t("addCard.image", "Kart Görseli")}</Text>
              </View>
              <View>
                <BadgeText required={false} />
              </View>
            </View>
            {image ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: image }} style={styles.cardImage} />
                <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageButton}>
                  <Text style={styles.removeImageButtonText}>{t("addCard.removeImage", "Görseli Kaldır")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={styles.addImageButton}>
                <Iconify icon="ic:round-plus" size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("addCard.addImage", "Fotoğraf Ekle")}</Text>
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
              <Iconify icon="uil:comment-alt-question" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t("addCard.question", "Soru")}</Text>
              </View>
              <View>
                <BadgeText required={true} />
              </View>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, typography.styles.body, { color: colors.text, paddingRight: question?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
                <Iconify icon="uil:comment-alt-check" size={24} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t("addCard.answer", "Cevap")}</Text>
              </View>
              <View>
                <BadgeText required={true} />
              </View>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, typography.styles.body, { color: colors.text, paddingRight: answer?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
              <Iconify icon="lucide:lightbulb" size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t("addCard.example", "Örnek")}</Text>
              </View>
              <View>
                <BadgeText required={false} />
              </View>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, typography.styles.body, { color: colors.text, paddingRight: example?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
                placeholder={t("addCard.examplePlaceholder", "Örnek cümle")}
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
              <Iconify icon="material-symbols-light:stylus-note" size={24} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, { fontSize: fontSizes.body }, { color: colors.text }]}>{t("addCard.note", "Not")}</Text>
              </View>
              <View>
                <BadgeText required={false} />
              </View>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, typography.styles.body, { color: colors.text, paddingRight: note?.length > 0 ? 48 : 12, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground}]}
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
      </FormScrollView>

      <HowToCreateCardModal
        isVisible={isHowToCreateCardModalVisible}
        onClose={() => setHowToCreateCardModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingTop: 4,
  },
  headerCard: {
    width: '100%',
    marginBottom: 12,
  },
  headerCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    marginHorizontal: 10,
    marginVertical: 8,
    paddingVertical: 10,
  },
  headerCardContent: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 6,
    minHeight: 160,
  },
  headerContent: {
    paddingVertical: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextColumn: {
    flex: 1,
    marginRight: 12,
  },
  howToCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  headerImageContainer: {
    width: 120,
    height: 120,
    marginLeft: 12,
  },
  headerImage: {
    width: 140,
    height: 140,
    alignSelf: 'flex-end',
    top: '-10%',
  },
  inputCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 20,
    marginBottom: 11,
    shadowOffset: { width: 4, height: 6 },
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
    borderRadius: 24,
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
