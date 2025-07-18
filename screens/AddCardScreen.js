import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Buffer } from 'buffer';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';

export default function AddCardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { deck } = route.params;
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [example, setExample] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState('');
  const [imageChanged, setImageChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (route.params?.openCsvModal) {
      setCsvModalVisible(true);
      navigation.setParams({ openCsvModal: false });
    }
  }, [route.params?.openCsvModal]);

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
    setImageChanged(false);
  };

  const handleCreateCard = async () => {
    if (!question.trim() || !answer.trim()) {
      Alert.alert(t('common.error', 'Hata'), t('common.questionAndAnswerRequired', 'Soru ve cevap zorunludur.'));
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
      const { error } = await supabase
        .from('cards')
        .insert({
          deck_id: deck.id,
          question: question.trim(),
          answer: answer.trim(),
          example: example.trim() || null,
          note: note.trim() || null,
          image: imageUrl || null,
        });
      if (error) throw error;
      Alert.alert(t('common.success', 'Başarılı'), t('common.addCardSuccess', 'Kart eklendi!'), [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('common.addCardError', 'Kart eklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  // CSV şablonunu indirme fonksiyonu
  const handleDownloadTemplate = async () => {
    const csvContent = 'soru,cevap,ornek,not\nBook,Kitap,i am reading a book,Buk seklinde okunur\nKnowledge,Bilgi,Knowledge is power.,Bilgi guctur.';
    const fileUri = FileSystem.documentDirectory + 'ornek_kartlar.csv';
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert(t('addCard.errorUpload', 'Paylaşım desteklenmiyor'), t('addCard.fileUri', 'Dosya yolu: ') + fileUri);
    }
  };

  // Header mapping sistemi
  const VALID_FIELDS = {
    'question': ['soru', 'question', 'q', 'sorular', 'soru metni', 'Soru', 'S', 'SORU', 'Question'],
    'answer': ['cevap', 'answer', 'a', 'cevaplar', 'cevap metni', 'Cevap', 'C', 'CEVAP', 'Answer'],
    'example': ['örnek', 'example', 'e', 'örnekler', 'örnek cümle', 'Örnek', 'Ö', 'ÖRNEK', 'ornek', 'Example'],
    'note': ['not', 'note', 'n', 'notlar', 'açıklama', 'Not', 'N', 'NOT', 'Note']
  };

  // Header işleme
  const processHeaders = (headers) => {
    const columnMap = {};
    const ignoredColumns = [];
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      let matchedField = null;
      Object.keys(VALID_FIELDS).forEach(field => {
        if (VALID_FIELDS[field].includes(cleanHeader)) {
          matchedField = field;
        }
      });
      if (matchedField) {
        columnMap[matchedField] = index;
      } else {
        ignoredColumns.push({
          column: header,
          index: index + 1,
          reason: t('common.unDefinedField', 'Tanımlanmamış alan')
        });
      }
    });
    return { columnMap, ignoredColumns };
  };

  // Kart validasyonu
  const validateCard = (card, rowNumber) => {
    const errors = [];
    if (!card.question || card.question.trim() === '') {
      errors.push({
        type: 'EMPTY_QUESTION',
        row: rowNumber,
        message: t("addCard.emptyQuestion", "Soru alanı boş olamaz")
      });
    }
    if (!card.answer || card.answer.trim() === '') {
      errors.push({
        type: 'EMPTY_ANSWER',
        row: rowNumber,
        message: t("addCard.emptyAnswer", "Cevap alanı boş olamaz")
      });
    }
    if (card.question && card.question.length > 500) {
      errors.push({
        type: 'QUESTION_TOO_LONG',
        row: rowNumber,
        message: t("addCard.questionTooLong", "Soru 500 karakterden uzun olamaz")
      });
    }
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  };

  // CSV parse fonksiyonu
  const parseCSV = (csvContent) => {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return { validCards: [], errors: [], ignoredColumns: [] };
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-zçğıöşü0-9]/gi, ''));
    console.log('CSV Header:', headers);
    const { columnMap, ignoredColumns } = processHeaders(headers);
    console.log('Column Map:', columnMap);
    if (columnMap.question === undefined || columnMap.answer === undefined) {
      return {
        validCards: [],
        errors: [{ type: 'MISSING_REQUIRED_HEADERS', message: t('common.missingRequiredHeaders', 'Soru ve cevap sütunları gerekli') }],
        ignoredColumns: ignoredColumns,
        totalRows: lines.length - 1
      };
    }
    const validCards = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/\r$/, ''));
      const card = {};
      Object.keys(columnMap).forEach(field => {
        const valueIndex = columnMap[field];
        card[field] = values[valueIndex] || '';
      });
      const validation = validateCard(card, i + 1);
      if (validation.isValid) {
        validCards.push(card);
      } else {
        errors.push(...validation.errors);
      }
    }
    // Toplam satır sayısı: veri satırı (header hariç)
    return { validCards, errors, ignoredColumns, totalRows: lines.length - 1 };
  };

  // CSV dosyası seçme ve önizleme fonksiyonu
  const handlePickCSV = async () => {
    try {
      setCsvLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (!file.name.toLowerCase().endsWith('.csv')) {
          Alert.alert(t('common.error', 'Hata'), t('common.pleaseSelectCSV', 'Lütfen bir CSV dosyası seçin.'));
          setCsvLoading(false);
          return;
        }
        const csvContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const { validCards, errors, ignoredColumns, totalRows } = parseCSV(csvContent);
        setCsvPreview({
          fileName: file.name,
          totalRows: totalRows,
          validCards: validCards.slice(0, 3), // İlk 3 kartı önizleme
          errors: errors.slice(0, 5), // İlk 5 hatayı göster
          allValidCards: validCards,
          allErrors: errors,
          ignoredColumns: ignoredColumns
        });
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Hata'), t('common.csvReadError', 'CSV dosyası okunamadı: ') + error.message);
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Modal
        visible={csvModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCsvModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'transparent' }}
          activeOpacity={1}
          onPress={() => setCsvModalVisible(false)}
        />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 24, paddingBottom: 32, paddingHorizontal: 24, elevation: 16 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text, textAlign: 'center' }}>{t('addCard.csvUpload', 'CSV ile Toplu Kart Yükleme')}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginBottom: 18, textAlign: 'center' }}>
            {t('addCard.csvUploadDescriptionFirst', 'Kartlarınızı Excel veya Google Sheets\'te aşağıdaki gibi hazırlayın ve CSV olarak kaydedin. Sadece ilk iki sütun zorunludur:')}
            {'\n'}
            <Text style={{ fontWeight: 'bold', color: colors.text }}>{t('addCard.csvUploadDescriptionSecond', 'Soru, Cevap, Örnek (opsiyonel), Not (opsiyonel)')}</Text>
            {'\n'}
            {t('addCard.csvUploadDescriptionThird', 'Her satır bir kartı temsil eder. Boş satırlar veya eksik zorunlu alanlar atlanır.')}
          </Text>
          {csvPreview ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>{t('addCard.file', 'Dosya: ')} {csvPreview.fileName}</Text>
              <Text style={{ color: colors.text, fontSize: 15 }}>{t('addCard.totalRows', 'Toplam satır: ')} {csvPreview.totalRows}</Text>
              <Text style={{ color: colors.text, fontSize: 15 }}>{t('addCard.validCards', 'Geçerli kart: ')} {csvPreview.allValidCards.length}</Text>
              <Text style={{ color: colors.text, fontSize: 15, marginBottom: 6 }}>{t('addCard.invalidCards', 'Geçersiz kart: ')} {csvPreview.allErrors.length}</Text>
              {csvPreview.errors.length > 0 && (
                <View style={{ marginTop: 8, marginBottom: 8 }}>
                  <Text style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>{t('addCard.errors', 'Hatalar (ilk 5):')}</Text>
                  {csvPreview.errors.map((err, idx) => (
                    <Text key={idx} style={{ color: '#D32F2F', fontSize: 14 }}>• {t('addCard.errorRow', 'Satır ')} {err.row}: {err.message}</Text>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={async () => {
                  // Kartları topluca ekle (Supabase)
                  if (!csvPreview.allValidCards.length) {
                    Alert.alert(t('addCard.error', 'Hata'), t('addCard.noValidCards', 'Geçerli kart yok.'));
                    return;
                  }
                  let successCount = 0;
                  let errorCount = 0;
                  setCsvLoading(true);
                  try {
                    const batchSize = 50;
                    for (let i = 0; i < csvPreview.allValidCards.length; i += batchSize) {
                      const batch = csvPreview.allValidCards.slice(i, i + batchSize);
                      const { error } = await supabase
                        .from('cards')
                        .insert(batch.map(card => ({
                          deck_id: deck.id,
                          question: card.question.trim(),
                          answer: card.answer.trim(),
                          example: card.example.trim() || null,
                          note: card.note.trim() || null,
                          image: null,
                        })));
                      if (error) {
                        errorCount += batch.length;
                      } else {
                        successCount += batch.length;
                      }
                    }
                    Alert.alert(
                      t('addCard.importCompleted', 'İçe Aktarma Tamamlandı'),
                      `${successCount} ${t('addCard.importCompletedMessage', 'kart başarıyla eklendi.')}${errorCount > 0 ? ` ${errorCount} ${t('addCard.importCompletedError', 'kart eklenemedi.')}` : ''}`,
                      [
                        { text: t('addCard.ok', 'Tamam'), onPress: () => { setCsvPreview(null); setCsvModalVisible(false); } }
                      ]
                    );
                  } catch (e) {
                    Alert.alert(t('addCard.error', 'Hata'), t('addCard.errorImport', 'Kartlar eklenirken bir hata oluştu: ') + e.message);
                  } finally {
                    setCsvLoading(false);
                  }
                }}
                style={{ backgroundColor: colors.buttonColor || '#007AFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 }}
                disabled={csvLoading}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.importCards', 'Kartları İçe Aktar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCsvPreview(null)}
                style={{
                  alignItems: 'center',
                  marginTop: 10,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  backgroundColor: 'transparent',
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold' }}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleDownloadTemplate}
                style={{ backgroundColor: '#F98A21', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, marginRight: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t('addCard.downloadTemplate', 'Örnek CSV İndir')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickCSV}
                style={{ backgroundColor: colors.blurView, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border }}
                disabled={csvLoading}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>{csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.selectCSV', 'CSV Dosyası Seç')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="image" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.image", "Kart Görseli")}</Text>
            </View>
            {image ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: image }} style={styles.cardImage} />
                <TouchableOpacity onPress={handleRemoveImage} style={[styles.removeImageButton, {backgroundColor: colors.actionButton}]}>
                  <Text style={styles.removeImageButtonText}>{t("addCard.removeImage", "Kaldır")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={[styles.addImageButton, {backgroundColor: colors.actionButton}]}>
                <Ionicons name="add" size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>{t("addCard.addImage", "Fotoğraf Ekle")}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.question", "Soru")} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("addCard.questionPlaceholder", "Kartın sorusu")}
              placeholderTextColor={colors.muted}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.answer", "Cevap")} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("addCard.answerPlaceholder", "Kartın cevabı")}
              placeholderTextColor={colors.muted}
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="bulb-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.example", "Örnek")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("addCard.examplePlaceholder", "Örnek cümle (opsiyonel)")}
              placeholderTextColor={colors.muted}
              value={example}
              onChangeText={setExample}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("addCard.note", "Not")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder={t("addCard.notePlaceholder", "Not (opsiyonel)")}
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.startButtonModern, { backgroundColor: '#fff', marginRight: 10, borderColor: colors.buttonColor || 'transparent' }]}
              onPress={() => {
                setQuestion('');
                setAnswer('');
                setExample('');
                setNote('');
                setImage('');
                setImageChanged(false);
              }}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, { color: colors.buttonColor }, typography.styles.button]}>{t("addCard.undo", "Geri Al")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.startButtonModern, loading && { opacity: 0.7 }, { borderWidth: 1, borderColor: colors.buttonBorder || 'transparent' }]}
              onPress={handleCreateCard}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, typography.styles.button]}>{loading ? t("addCard.creatingCard", "Kart oluşturuluyor...") : t("addCard.createCard", "Kartı Oluştur")}</Text>
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
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
    backgroundColor: '#f2f2f2',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',

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
    borderWidth: 1,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',

  },
}); 