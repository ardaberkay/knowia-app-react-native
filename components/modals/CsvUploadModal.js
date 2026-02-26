import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Platform, Modal as RNModal, TouchableWithoutFeedback, Dimensions, LayoutAnimation, UIManager } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { Iconify } from 'react-native-iconify';
import { useTranslation } from 'react-i18next';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { supabase } from '../../lib/supabase';
import { useSnackbarHelpers } from '../ui/Snackbar';

// Android cihazlarda LayoutAnimation'ın çalışması için bu ayar zorunludur
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CsvUploadModal({
  isVisible,
  onClose,
  deck
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const screenHeight = Dimensions.get('screen').height;

  // STATELER (Kesinlikle dokunulmadı)
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageIds, setImageIds] = useState([]);
  const [imageIdMap, setImageIdMap] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState({});
  const [dropdownPos, setDropdownPos] = useState({});
  const dropdownRefs = useRef({});
  const [tableGuideExpanded, setTableGuideExpanded] = useState(false);

  // --- FONKSİYONEL KISIMLAR (HİÇ DOKUNULMADI) ---

  const normalizeTurkishChars = (str) => {
    if (!str) return '';
    let normalized = str
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I')
      .replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C');
    normalized = normalized.replace(/[^\x00-\x7F]/g, 'o');
    return normalized;
  };


  const decodeWindows1254 = (buffer) => {
    const win1254Map = { 0xD0: 'Ğ', 0xDD: 'İ', 0xDE: 'Ş', 0xF0: 'ğ', 0xFD: 'ı', 0xFE: 'ş' };
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (win1254Map[byte] !== undefined) { result += win1254Map[byte]; }
      else { result += String.fromCharCode(byte); }
    }
    return result;
  };

  const VALID_FIELDS = {
    'question': ['soru', 'question', 'q', 'sorular', 'soru metni', 'Soru', 'S', 'SORU', 'Question'],
    'answer': ['cevap', 'answer', 'a', 'cevaplar', 'cevap metni', 'Cevap', 'C', 'CEVAP', 'Answer'],
    'example': ['örnek', 'ornek', 'example', 'e', 'örnekler', 'ornekler', 'örnek cümle', 'ornek cumle', 'Örnek', 'Ornek', 'Ö', 'O', 'ÖRNEK', 'ORNEK', 'Example'],
    'note': ['not', 'note', 'n', 'notlar', 'açıklama', 'aciklama', 'Not', 'N', 'NOT', 'Note'],
    'image': ['görsel', 'gorsel', 'grsel', 'image', 'img', 'resim', 'picture', 'pic', 'Görsel', 'Gorsel', 'G', 'GÖRSEL', 'GORSEL', 'Image']
  };
  const [isImageModalVisible, setImageModalVisible] = useState(false);

  const processHeaders = (headers) => {
    const columnMap = {};
    const ignoredColumns = [];
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      const normalizedHeader = normalizeTurkishChars(cleanHeader);
      let matchedField = null;

      Object.keys(VALID_FIELDS).forEach(field => {
        const fieldValues = VALID_FIELDS[field].map(v => v.toLowerCase());
        const normalizedFieldValues = VALID_FIELDS[field].map(v => normalizeTurkishChars(v.toLowerCase()));

        if (fieldValues.includes(cleanHeader)) { matchedField = field; return; }
        if (normalizedFieldValues.includes(normalizedHeader)) { matchedField = field; return; }
        if (fieldValues.some(v => normalizeTurkishChars(v) === normalizedHeader)) { matchedField = field; return; }
      });

      if (!matchedField) {
        const veryNormalized = normalizedHeader.replace(/[^a-z0-9]/g, '');
        if (veryNormalized === 'grsel' || veryNormalized === 'gorsel' || veryNormalized.startsWith('gorsel') || veryNormalized.startsWith('grsel')) {
          matchedField = 'image';
        }
      }

      if (matchedField) {
        columnMap[matchedField] = index;
        console.log(`Header matched: "${header}" -> "${cleanHeader}" (normalized: "${normalizedHeader}") -> field: "${matchedField}"`);
      } else {
        ignoredColumns.push({ column: header, index: index + 1, reason: t('common.unDefinedField', 'Tanımlanmamış alan') });
        console.log(`Header ignored: "${header}" -> "${cleanHeader}" (normalized: "${normalizedHeader}") (no match in VALID_FIELDS)`);
      }
    });
    return { columnMap, ignoredColumns };
  };

  const validateCard = (card, rowNumber) => {
    const errors = [];
    if (!card.question || card.question.trim() === '') {
      errors.push({ type: 'EMPTY_QUESTION', row: rowNumber, message: t("addCard.emptyQuestion", "Soru alanı boş olamaz") });
    }
    if (!card.answer || card.answer.trim() === '') {
      errors.push({ type: 'EMPTY_ANSWER', row: rowNumber, message: t("addCard.emptyAnswer", "Cevap alanı boş olamaz") });
    }
    if (card.question && card.question.length > 500) {
      errors.push({ type: 'QUESTION_TOO_LONG', row: rowNumber, message: t("addCard.questionTooLong", "Soru 500 karakterden uzun olamaz") });
    }
    return { isValid: errors.length === 0, errors: errors };
  };

  const parseCSV = (csvContent) => {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return { validCards: [], errors: [], ignoredColumns: [] };
    const rawHeaders = lines[0].split(',').map(h => h.trim());
    const headers = rawHeaders.map(h => h.toLowerCase());
    console.log('CSV Headers Debug:', { rawHeaders, headers });
    const { columnMap, ignoredColumns } = processHeaders(headers);
    console.log('CSV ColumnMap Debug:', { columnMap, ignoredColumns });
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
      if (validation.isValid) { validCards.push(card); }
      else { errors.push(...validation.errors); }
    }
    return { validCards, errors, ignoredColumns, totalRows: lines.length - 1 };
  };

  const handleDownloadTemplate = async () => {
    const csvContent = 'soru,cevap,ornek,not,görsel\nBook,Kitap,i am reading a book,Buk seklinde okunur,book\nKnowledge,Bilgi,Knowledge is power.,Bilgi guctur,https://flagcdn.com/w1280/it.png';
    const fileUri = FileSystem.documentDirectory + 'ornek_kartlar.csv';
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      showError(t('addCard.errorUpload', 'Paylaşım desteklenmiyor'));
    }
  };

  const getFileNameWithoutExtension = (fileName) => {
    if (!fileName) return '';
    let name = fileName;
    if (fileName.includes('/')) { name = fileName.split('/').pop() || fileName; }
    if (name.includes('\\')) { name = name.split('\\').pop() || name; }
    if (name.includes('?')) { name = name.split('?')[0]; }
    return name.replace(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i, '').toLowerCase().trim();
  };

  const getImageType = (imageValue) => {
    if (!imageValue || typeof imageValue !== 'string' || imageValue.trim() === '') return null;
    const trimmed = imageValue.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && trimmed.includes(supabaseUrl)) { return 'supabase_url'; }
      return 'external_url';
    }
    if (trimmed.startsWith('file://')) { return 'local_file'; }
    return 'file_name';
  };

  const isSvgUrl = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.svg') || url.toLowerCase().includes('.svg?');
  };

  const downloadAndConvertImage = async (url) => {
    try {
      if (isSvgUrl(url)) {
        console.log('SVG dosyası tespit edildi, direkt URL kullanılacak:', url);
        return null;
      }
      const downloadResult = await FileSystem.downloadAsync(
        url,
        FileSystem.cacheDirectory + `temp_image_${Date.now()}.tmp`
      );
      if (!downloadResult.uri) { throw new Error('Görsel indirilemedi'); }
      const manipResult = await ImageManipulator.manipulateAsync(
        downloadResult.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (error) {
      console.error('Görsel indirme/çevirme hatası:', error);
      return null;
    }
  };

  const uploadImageToSupabase = async (imageUri) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Kullanıcı bulunamadı');
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
      const filePath = `card_${deck.id}_${user.id}_${Date.now()}.webp`;
      const buffer = Buffer.from(base64, 'base64');
      const { error: uploadError } = await supabase.storage.from('images').upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Supabase yükleme hatası:', error);
      return null;
    }
  };

  const processImage = async (imageValue, imageIndex = null) => {
    const imageType = getImageType(imageValue);
    if (!imageType) return null;
    try {
      switch (imageType) {
        case 'supabase_url':
          return imageValue.trim();
        case 'external_url':
          if (isSvgUrl(imageValue.trim())) {
            console.log('SVG dosyası desteklenmiyor, atlanıyor:', imageValue.trim());
            return null;
          }
          const downloadedUri = await downloadAndConvertImage(imageValue.trim());
          if (!downloadedUri) {
            console.log('Görsel indirilemedi, direkt URL kullanılıyor:', imageValue.trim());
            return imageValue.trim();
          }
          return await uploadImageToSupabase(downloadedUri);
        case 'local_file':
        case 'file_name':
          const fileName = imageValue.trim();
          const fileNameWithoutExt = getFileNameWithoutExtension(fileName);
          let matchedImage = null;
          matchedImage = selectedImages.find(img => {
            const imgName = img.name || img.fileName || img.uri?.split('/').pop() || img.uri?.split('\\').pop() || '';
            const selectedName = getFileNameWithoutExtension(imgName);
            return selectedName === fileNameWithoutExt;
          });
          if (!matchedImage && imageIndex !== null && imageIndex < selectedImages.length) {
            console.log('Dosya adı eşleşmedi, sıralı eşleştirme kullanılıyor:', { imageIndex, fileNameWithoutExt, selectedImageFileName: selectedImages[imageIndex]?.fileName });
            matchedImage = selectedImages[imageIndex];
          }
          console.log('Yerel dosya eşleştirme:', { fileName, fileNameWithoutExt, imageIndex, selectedImagesCount: selectedImages.length, matched: !!matchedImage, matchedImageFileName: matchedImage?.fileName });
          if (matchedImage) {
            console.log('Görsel işleniyor:', matchedImage.uri);
            const manipResult = await ImageManipulator.manipulateAsync(
              matchedImage.uri,
              [{ resize: { width: 512 } }],
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            const uploadedUrl = await uploadImageToSupabase(manipResult.uri);
            console.log('Görsel yüklendi:', uploadedUrl);
            return uploadedUrl;
          }
          console.log('Eşleşme bulunamadı:', { fileNameWithoutExt, imageIndex, selectedImagesNames: selectedImages.map(img => getFileNameWithoutExtension(img.name || img.fileName || img.uri?.split('/').pop() || '')) });
          return null;
        default:
          return null;
      }
    } catch (error) {
      console.error('Görsel işleme hatası:', error);
      return null;
    }
  };

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const assetsWithOriginalNames = result.assets.map((img) => {
          const originalFileName = img.name || img.fileName || img.uri?.split('/').pop() || img.uri?.split('\\').pop() || '';
          return { ...img, originalFileName: originalFileName };
        });
        console.log('Seçilen görseller:', assetsWithOriginalNames.map(img => ({ name: img.name, fileName: img.fileName, originalFileName: img.originalFileName, uri: img.uri?.substring(0, 50), type: img.type })));
        setSelectedImages(assetsWithOriginalNames);
        showSuccess(`${result.assets.length} ${t('addCard.imagesSelected', 'görsel seçildi')}`);
      }
    } catch (error) {
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const handlePickCSV = async () => {
    try {
      setCsvLoading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (!file.name.toLowerCase().endsWith('.csv')) {
          showError(t('common.pleaseSelectCSV', 'Lütfen bir CSV dosyası seçin.'));
          setCsvLoading(false);
          return;
        }
        let csvContent = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        if (csvContent.includes('\uFFFD') || csvContent.includes('\u0000')) {
          const base64Content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
          const fileBuffer = Buffer.from(base64Content, 'base64');
          if (fileBuffer[0] === 0xEF && fileBuffer[1] === 0xBB && fileBuffer[2] === 0xBF) {
            csvContent = fileBuffer.slice(3).toString('utf-8');
          } else {
            csvContent = decodeWindows1254(fileBuffer);
          }
        }

        const { validCards, errors, ignoredColumns, totalRows } = parseCSV(csvContent);
        const hasImageColumn = validCards.some(card => card.image && typeof card.image === 'string' && card.image.trim() !== '');
        const hasLocalImageFiles = hasImageColumn && validCards.some(card => {
          if (!card.image || typeof card.image !== 'string') return false;
          const imageType = getImageType(card.image);
          return imageType === 'file_name' || imageType === 'local_file';
        });

        const uniqueImageIds = Array.from(
          new Set(validCards.map(card => card.image).filter(img => img && typeof img === 'string' && img.trim() !== '').map(img => img.trim()))
        ).filter(imgId => {
          const imageType = getImageType(imgId);
          return imageType === 'file_name' || imageType === 'local_file';
        });

        const cardsWithSvg = validCards.filter(card => {
          if (!card.image || typeof card.image !== 'string') return false;
          return isSvgUrl(card.image.trim());
        });

        console.log('CSV Parse Debug:', { totalCards: validCards.length, hasImageColumn, hasLocalImageFiles, imageIds: uniqueImageIds, sampleCard: validCards[0], allCardsWithImages: validCards.filter(c => c.image !== undefined), imageColumnMap: validCards.filter(c => c.image !== undefined).map(c => ({ question: c.question, image: c.image, imageType: getImageType(c.image) })) });

        // LayoutAnimation ekleyerek önizleme ekranının yumuşak açılmasını sağladık
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        setCsvPreview({
          fileName: file.name,
          totalRows: totalRows,
          validCards: validCards.slice(0, 3),
          errors: errors.slice(0, 5),
          allValidCards: validCards,
          allErrors: errors,
          ignoredColumns: ignoredColumns,
          hasImageColumn: hasImageColumn,
          hasLocalImageFiles: hasLocalImageFiles,
          cardsWithSvg: cardsWithSvg
        });

        setImageIds(uniqueImageIds);
        setImageIdMap({});
        setDropdownOpen({});
        setDropdownPos({});
        dropdownRefs.current = {};

        if (cardsWithSvg.length > 0) {
          showError(`${cardsWithSvg.length} ${t('addCard.svgNotSupported', 'kartta SVG görseli bulundu. SVG formatı desteklenmiyor, bu kartlar görselsiz eklenecek.')}`);
        }
        if (hasLocalImageFiles) { setSelectedImages([]); }
      }
    } catch (error) {
      showError(t('common.csvReadError', 'CSV dosyası okunamadı: ') + error.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const handleImportCards = async () => {
    if (!csvPreview.allValidCards.length) {
      showError(t('addCard.noValidCards', 'Geçerli kart yok.'));
      return;
    }
    if (csvPreview.hasLocalImageFiles && selectedImages.length === 0) {
      showError(t('addCard.selectImagesFirst', 'Lütfen önce görselleri seçin.'));
      return;
    }
    if (imageIds.length > 0) {
      const unmatchedIds = imageIds.filter(id => !imageIdMap[id]);
      if (unmatchedIds.length > 0) {
        showError(`${unmatchedIds.length} ${t('addCard.unmatchedImages', 'görsel eşleştirilmemiş. Lütfen tüm görselleri eşleştirin.')}`);
        return;
      }
    }

    let successCount = 0;
    let errorCount = 0;
    setCsvLoading(true);
    try {
      const processedCards = await Promise.all(
        csvPreview.allValidCards.map(async (card) => {
          let imageUrl = null;
          if (card.image && card.image.trim() !== '') {
            const imageType = getImageType(card.image);
            const imageId = card.image.trim();
            if (imageType === 'file_name' || imageType === 'local_file') {
              const matchedImage = imageIdMap[imageId];
              if (matchedImage) {
                const manipResult = await ImageManipulator.manipulateAsync(
                  matchedImage.uri,
                  [{ resize: { width: 512 } }],
                  { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                imageUrl = await uploadImageToSupabase(manipResult.uri);
              }
            } else {
              imageUrl = await processImage(card.image, null);
            }
          }
          return {
            deck_id: deck.id,
            question: card.question?.trim() || '',
            answer: card.answer?.trim() || '',
            example: card.example?.trim() || null,
            note: card.note?.trim() || null,
            image: imageUrl || null,
          };
        })
      );

      for (let i = 0; i < processedCards.length; i++) {
        const card = processedCards[i];
        const { data, error } = await supabase.from('cards').insert(card).select();
        if (error) {
          console.error('Supabase insert hatası:', JSON.stringify(error), 'Kart:', JSON.stringify(card));
          errorCount++;
        } else { successCount++; }
      }
      const message = `${successCount} ${t('addCard.importCompletedMessage', 'kart başarıyla eklendi.')}${errorCount > 0 ? ` ${errorCount} ${t('addCard.importCompletedError', 'kart eklenemedi.')}` : ''}`;
      showSuccess(message);
      setTimeout(() => {
        setCsvPreview(null);
        setSelectedImages([]);
        onClose();
      }, 1500);
    } catch (e) {
      console.error('Import exception:', e);
      showError(t('addCard.errorImport', 'Kartlar eklenirken bir hata oluştu: ') + e.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const openImageDropdown = (imageId) => {
    const ref = dropdownRefs.current[imageId];
    if (ref && ref.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        setDropdownPos(prev => ({ ...prev, [imageId]: { x, y, width, height } }));
        setDropdownOpen(prev => ({ ...prev, [imageId]: true }));
      });
    } else {
      setDropdownOpen(prev => ({ ...prev, [imageId]: true }));
    }
  };

  const closeImageDropdown = (imageId) => {
    setDropdownOpen(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageSelect = (imageId, img, idx) => {
    setImageIdMap(prev => ({ ...prev, [imageId]: { ...img, selectionIndex: idx + 1 } }));
    closeImageDropdown(imageId);
  };

  const handleClose = () => {
    setCsvPreview(null);
    setSelectedImages([]);
    setImageIds([]);
    setImageIdMap({});
    setDropdownOpen({});
    setDropdownPos({});
    setTableGuideExpanded(false);
    dropdownRefs.current = {};
    onClose();
  };

  // Açılır kapanır menü animasyonu (UI)
  const toggleGuide = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTableGuideExpanded(!tableGuideExpanded);
  };

  // --- UI RENDER KISMI ---

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={0}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      statusBarTranslucent={true}
      deviceHeight={screenHeight}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>

        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('addCard.csvUpload', 'CSV ile Yükle')}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={styles.closeBtnWrapper}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

          <Text style={[styles.description, { color: colors.muted }]}>
            {t('addCard.csvUploadDescriptionMain', 'Kartlarınızı Excel veya Google Sheets\'te hazırlayın ve CSV olarak kaydedin. CSV dosyanızı yükleyin ve kartlarınız hazır!')}
          </Text>

          {/* TABLO NASIL OLUŞTURULUR REHBERİ */}
          <View style={[styles.expandableSection, { backgroundColor: isDarkMode ? '#222' : '#F7F7F7' }]}>
            <TouchableOpacity onPress={toggleGuide} activeOpacity={0.7} style={styles.expandableHeader}>
              <View style={styles.expandableHeaderLeft}>
                <Iconify icon="material-symbols:info-outline" size={moderateScale(22)} color={colors.primary || '#007AFF'} style={{ marginRight: scale(10) }} />
                <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                  {t('addCard.howToCreateTable', 'Tablo Nasıl Oluşturulur?')}
                </Text>
              </View>
              <Iconify
                icon="flowbite:caret-down-solid"
                size={moderateScale(18)}
                color={colors.text}
                style={{ transform: [{ rotate: tableGuideExpanded ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {tableGuideExpanded && (
              <View style={styles.expandableContent}>

                <View style={[styles.guideCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF', borderColor: isDarkMode ? '#333' : '#EEE' }]}>
                  <Text style={[styles.guideTitle, { color: colors.text }]}>
                    {t('addCard.tableStructureTitle', 'CSV Formatı')}
                  </Text>
                  <Text style={[styles.guideText, { color: colors.text }]}>
                    {t('addCard.tableStructure', 'Tablo 2 zorunlu, 3 opsiyonel olmak üzere en fazla 5 sütundan oluşabilir:')}
                  </Text>

                  <View style={[styles.codeBadge, { backgroundColor: isDarkMode ? '#111' : '#F0F0F0', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                    <Text style={[styles.codeBadgeText, { color: colors.primary || '#ffffff' }]}>
                      {t('addCard.tableColumnsText', 'soru, cevap, ornek, not, gorsel')}
                    </Text>
                  </View>

                  <View style={styles.alertInline}>
                    <Iconify icon="mdi:required" size={moderateScale(22)} color={colors.secondary || '#F39C12'} style={{ marginRight: scale(6) }} />
                    <Text style={[styles.alertInlineText, { color: colors.secondary || '#F39C12' }]}>
                      {t('addCard.requiredColumns', 'Soru ve Cevap sütunları zorunludur!')}
                    </Text>
                  </View>
                </View>

                <View style={[styles.guideCard, { backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF', borderColor: isDarkMode ? '#333' : '#EEE' }]}>
                  <Text style={[styles.guideTitle, { color: colors.text }]}>
                    {t('addCard.tableImageInstructionsTitle', 'Görsel Ekleme')}
                  </Text>
                  <Text style={[styles.guideText, { color: colors.text }]}>
                    {t('addCard.imageInstructions', 'Görsel sütununa eklemek istediğiniz resmin URL adresini yapıştırabilir veya telefonunuzdan seçeceğiniz görselin dosya ismini yazabilirsiniz.')}
                  </Text>
                  <Text style={[styles.guideText, { color: colors.muted, fontStyle: 'italic', marginTop: verticalScale(4) }]}>
                    {t('addCard.svgNote', 'Not: SVG formatı desteklenmemektedir.')}
                  </Text>
                </View>

                <TouchableOpacity activeOpacity={0.9} onPress={() => setImageModalVisible(true)} style={styles.imagePreviewWrapper}>
                  <Image
                    source={require('../../assets/examtable.png')}
                    style={styles.exampleTableImage}
                    resizeMode="contain"
                  />
                  <View style={styles.zoomIconBadge}>
                    <Iconify icon="fluent:scan-camera-20-regular" size={22} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Büyütülmüş Resim Modalı */}
            <Modal
              isVisible={isImageModalVisible}
              style={{ margin: 0 }}
              backdropOpacity={0.8}
              animationIn="fadeIn"
              animationOut="fadeOut"
              statusBarTranslucent={true}
              deviceHeight={screenHeight}
              hardwareAccelerated={true}
              useNativeDriver={true}
              useNativeDriverForBackdrop={true}
              hideModalContentWhileAnimating={true}
              onBackdropPress={() => setImageModalVisible(false)}
            >
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>

                <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={() => setImageModalVisible(false)}>
                  <Iconify icon="mingcute:close-fill" size={24} color="white" />
                </TouchableOpacity>

                <Image
                  source={require('../../assets/examtable.png')}
                  style={{ width: '90%', height: '70%' }}
                  resizeMode="contain"
                />

              </View>
            </Modal>
          </View>

          {/* ÖNİZLEME (PREVIEW) EKRANI */}
          {csvPreview && (
            <View style={styles.previewSection}>

              {/* Dosya Adı Barı */}
              <View style={[styles.fileNameBar, { backgroundColor: isDarkMode ? '#222' : '#F4F6F8' }]}>
                <Iconify icon="hugeicons:document-validation" size={moderateScale(22)} color={colors.primary || '#007AFF'} />
                <Text style={[styles.fileNameText, { color: colors.text }]} numberOfLines={1}>
                  {csvPreview.fileName}
                </Text>
              </View>

              {/* İstatistik Dashboard Grid'i */}
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#1E2A38' : '#EBF5FF' }]}>
                  <Text style={[styles.statTitle, { color: '#007AFF' }]}>{t('addCard.totalRows', 'Toplam')}</Text>
                  <Text style={[styles.statValue, { color: '#007AFF' }]}>{csvPreview.totalRows}</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#1A3324' : '#E8F5E9' }]}>
                  <Text style={[styles.statTitle, { color: '#27AE60' }]}>{t('addCard.validCards', 'Geçerli')}</Text>
                  <Text style={[styles.statValue, { color: '#27AE60' }]}>{csvPreview.allValidCards.length}</Text>
                </View>

                <View style={[styles.statBox, { backgroundColor: isDarkMode ? '#3B1E1E' : '#FFEBEE' }]}>
                  <Text style={[styles.statTitle, { color: '#D32F2F' }]}>{t('addCard.invalidCards', 'Hatalı')}</Text>
                  <Text style={[styles.statValue, { color: '#D32F2F' }]}>{csvPreview.allErrors.length}</Text>
                </View>
              </View>

              {/* SVG Uyarısı */}
              {csvPreview.cardsWithSvg && csvPreview.cardsWithSvg.length > 0 && (
                <View style={styles.alertBoxWarning}>
                  <Iconify icon="mdi:information-variant" size={moderateScale(24)} color="#B7791F" style={{ marginRight: scale(10) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertBoxTitleWarning}>{t('addCard.svgWarning', 'SVG Desteklenmiyor')}</Text>
                    <Text style={styles.alertBoxTextWarning}>
                      {csvPreview.cardsWithSvg.length} {t('addCard.svgWarningMessage', 'kartta SVG görseli bulundu. Bu kartlar görselsiz eklenecek.')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Hata Listesi */}
              {csvPreview.errors.length > 0 && (
                <View style={styles.alertBoxError}>
                  <View style={styles.errorHeaderRow}>
                    <Iconify icon="mdi:alert-circle" size={moderateScale(20)} color="#D32F2F" style={{ marginRight: scale(8) }} />
                    <Text style={styles.alertBoxTitleError}>{t('addCard.errors', 'Hatalar (İlk 5)')}</Text>
                  </View>
                  {csvPreview.errors.map((err, idx) => (
                    <Text key={idx} style={styles.alertBoxTextError}>
                      <Text style={{ fontWeight: 'bold' }}>Satır {err.row}: </Text>{err.message}
                    </Text>
                  ))}
                </View>
              )}

              {/* Görsel Eşleştirme Alanı */}
              {csvPreview.hasLocalImageFiles && (
                <View style={[styles.imageMapSection, { backgroundColor: isDarkMode ? '#222' : '#F9FAFB', borderColor: colors.border }]}>

                  <View style={styles.imageMapHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.imageMapTitle, { color: colors.text }]}>{t('addCard.selectImages', 'Görselleri Seç ve Eşleştir')}</Text>
                      <Text style={[styles.imageMapSub, { color: colors.muted }]}>
                        {selectedImages.length > 0
                          ? `${selectedImages.length} ${t('addCard.imagesSelected', 'görsel seçildi')}`
                          : t('addCard.noImagesSelected', 'Henüz görsel seçilmedi')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handlePickImages}
                      style={[styles.pickImgBtn, { backgroundColor: colors.primary || '#007AFF', flex: 1 }]}
                      disabled={csvLoading}
                    >
                      <Iconify icon="mage:image-fill" size={moderateScale(18)} color="#FFF" style={{ marginRight: scale(6) }} />
                      <Text style={styles.pickImgBtnText}>{t('addCard.pickImages', 'Seç')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dropdownlar */}
                  {imageIds.length > 0 && selectedImages.length > 0 && (
                    <View style={styles.dropdownsList}>
                      {imageIds.map((imageId, index) => {
                        const selectedImg = imageIdMap[imageId];

                        return (
                          <View key={imageId} style={[styles.dropdownRow, { zIndex: imageIds.length - index }]}>

                            <View style={[styles.badgeContainer, { backgroundColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                              <Text style={[styles.badgeText, { color: colors.text }]}>{index + 1}</Text>
                            </View>

                            <View style={{ flex: 1, paddingRight: scale(10) }}>
                              <Text style={[styles.imgIdLabel, { color: colors.muted }]} numberOfLines={1}>{imageId}</Text>
                            </View>

                            <TouchableOpacity
                              ref={(ref) => { if (ref) dropdownRefs.current[imageId] = ref; }}
                              onPress={() => openImageDropdown(imageId)}
                              style={[styles.dropdownTrigger, { borderColor: selectedImg ? (colors.primary || '#007AFF') : colors.border, backgroundColor: isDarkMode ? '#111' : '#FFF' }]}
                              activeOpacity={0.8}
                            >
                              {selectedImg ? (
                                <View style={styles.dropdownSelectedInner}>
                                  <Image source={{ uri: selectedImg.uri }} style={styles.dropdownTriggerThumb} />
                                  <Text style={[styles.dropdownTriggerText, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                                    {t('addCard.chooseImages', 'Seçim')} {selectedImg.selectionIndex}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={[styles.dropdownTriggerPlaceholder, { color: colors.muted }]}>{t('addCard.matchImages', 'Eşleştir')}</Text>
                              )}
                              <Iconify icon="flowbite:caret-down-solid" size={moderateScale(16)} color={colors.text} style={{ marginLeft: scale(6) }} />
                            </TouchableOpacity>

                            {/* Modal Dropdown Menü (Aynı kaldı) */}
                            <RNModal
                              visible={dropdownOpen[imageId] || false}
                              transparent
                              animationType="fade"
                              onRequestClose={() => closeImageDropdown(imageId)}
                            >
                              <TouchableWithoutFeedback onPress={() => closeImageDropdown(imageId)}>
                                <View style={{ flex: 1 }}>
                                  <View style={[
                                    styles.dropdownMenu,
                                    {
                                      backgroundColor: colors.background,
                                      borderColor: colors.border,
                                      left: dropdownPos[imageId]?.x || 0,
                                      top: Platform.OS === 'android'
                                        ? (dropdownPos[imageId]?.y || 0) + (dropdownPos[imageId]?.height || 0)
                                        : (dropdownPos[imageId]?.y || 0) + (dropdownPos[imageId]?.height || 0) + verticalScale(4),
                                      minWidth: dropdownPos[imageId]?.width || scale(150),
                                      zIndex: imageIds.length - index + 1000,
                                    }
                                  ]}>
                                    <ScrollView style={styles.dropdownScrollView} showsVerticalScrollIndicator={false}>
                                      {selectedImages.map((img, idx) => {
                                        const isSelected = imageIdMap[imageId]?.uri === img.uri;
                                        const isLastItem = idx === selectedImages.length - 1;
                                        return (
                                          <TouchableOpacity
                                            key={img.uri}
                                            onPress={() => handleImageSelect(imageId, img, idx)}
                                            style={[
                                              styles.dropdownListItem,
                                              { borderBottomColor: colors.border, borderBottomWidth: isLastItem ? 0 : 1 },
                                              isSelected && { backgroundColor: isDarkMode ? '#333' : '#F0F9FF' }
                                            ]}
                                          >
                                            <Image source={{ uri: img.uri }} style={styles.dropdownImageThumbnail} />
                                            <Text style={[styles.dropdownListItemText, { color: isSelected ? (colors.primary || '#007AFF') : colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                                              Seçim {idx + 1}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </ScrollView>
                                  </View>
                                </View>
                              </TouchableWithoutFeedback>
                            </RNModal>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Aksiyon Butonları (İçeridekiler) */}
              <View style={styles.previewActionButtons}>
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setCsvPreview(null);
                  }}
                  style={[styles.btnCancel, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}
                >
                  <Text style={[styles.btnCancelText, { color: colors.text }]}>{t('common.cancel', 'İptal')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleImportCards}
                  style={[styles.btnImport, { backgroundColor: colors.buttonColor || '#007AFF', opacity: (csvLoading || (csvPreview.hasLocalImageFiles && selectedImages.length === 0) || (imageIds.length > 0 && Object.keys(imageIdMap).length !== imageIds.length)) ? 0.6 : 1 }]}
                  disabled={csvLoading || (csvPreview.hasLocalImageFiles && selectedImages.length === 0) || (imageIds.length > 0 && Object.keys(imageIdMap).length !== imageIds.length)}
                >
                  <Text style={styles.btnImportText}>
                    {csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.importCards', 'İçe Aktar')}
                  </Text>
                </TouchableOpacity>
              </View>

            </View>
          )}

        </ScrollView>

        {/* Aksiyon Butonları (Sabit Alt Kısım - Önizleme Yokken) */}
        {!csvPreview && (
          <View style={styles.bottomActions}>
            <TouchableOpacity onPress={handleDownloadTemplate} style={styles.btnDownloadTemplate}>
              <Iconify icon="tabler:file-download-filled" size={moderateScale(20)} color="#F98A21" style={{ marginRight: scale(8) }} />
              <Text style={styles.btnDownloadTemplateText}>{t('addCard.downloadTemplate', 'Örnek CSV İndir')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickCSV}
              style={[styles.btnPickCsv, { backgroundColor: colors.primary || '#007AFF' }]}
              disabled={csvLoading}
            >
              <Iconify icon="cuida:upload-outline" size={moderateScale(20)} color="#FFF" style={{ marginRight: scale(8) }} />
              <Text style={styles.btnPickCsvText}>
                {csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.selectCSV', 'CSV Yükle')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(20),
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  scrollView: {
    maxHeight: verticalScale(550),
  },
  description: {
    fontSize: moderateScale(14),
    marginBottom: verticalScale(20),
    textAlign: 'center',
    lineHeight: verticalScale(20),
  },

  // --- REHBER KISMI ---
  expandableSection: {
    marginBottom: verticalScale(16),
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  expandableHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandableHeaderText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  expandableContent: {
    paddingBottom: verticalScale(16),
    paddingHorizontal: scale(16),
    gap: verticalScale(12),
  },
  guideCard: {
    padding: scale(12),
    borderRadius: moderateScale(12),
    borderWidth: 1,
  },
  guideTitle: {
    fontWeight: '700',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(6),
  },
  guideText: {
    fontSize: moderateScale(13),
    lineHeight: verticalScale(18),
  },
  codeBadge: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    alignItems: 'center',
  },
  codeBadgeText: {
    fontWeight: '700',
    fontSize: moderateScale(13),
    letterSpacing: 0.5,
  },
  alertInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertInlineText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  imagePreviewWrapper: {
    marginTop: verticalScale(4),
    position: 'relative',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  exampleTableImage: {
    width: '100%',
    height: verticalScale(100),
  },
  zoomIconBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: moderateScale(6),
    borderRadius: 99,
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    top: verticalScale(80),
    right: scale(24),
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 99,
  },

  // --- ÖNİZLEME (PREVIEW) KISMI ---
  previewSection: {
    paddingTop: verticalScale(8),
    gap: verticalScale(16),
  },
  fileNameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: moderateScale(12),
  },
  fileNameText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginLeft: scale(10),
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  statBox: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  statValue: {
    fontSize: moderateScale(20),
    fontWeight: '800',
  },

  // --- UYARI & HATA KUTULARI ---
  alertBoxWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF08A30',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: scale(12),
    borderRadius: moderateScale(12),
  },
  alertBoxTitleWarning: {
    color: '#B7791F',
    fontWeight: '700',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(2),
  },
  alertBoxTextWarning: {
    color: '#B7791F',
    fontSize: moderateScale(12),
    lineHeight: verticalScale(16),
  },
  alertBoxError: {
    backgroundColor: '#FEE2E250',
    borderColor: '#EF4444',
    borderWidth: 1,
    padding: scale(12),
    borderRadius: moderateScale(12),
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  alertBoxTitleError: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: moderateScale(14),
  },
  alertBoxTextError: {
    color: '#D32F2F',
    fontSize: moderateScale(12),
    marginBottom: verticalScale(2),
  },

  // --- EŞLEŞTİRME KISMI ---
  imageMapSection: {
    padding: scale(14),
    borderRadius: moderateScale(16),
    borderWidth: 1,
  },
  imageMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  imageMapTitle: {
    fontWeight: '700',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(2),
  },
  imageMapSub: {
    fontSize: moderateScale(12),
  },
  pickImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(8),
  },
  pickImgBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: moderateScale(12),
  },
  dropdownsList: {
    gap: verticalScale(10),
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    width: scale(24),
    height: scale(24),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  badgeText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  imgIdLabel: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(10),
    width: scale(130),
  },
  dropdownTriggerPlaceholder: {
    fontSize: moderateScale(13),
    flex: 1,
  },
  dropdownSelectedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownTriggerThumb: {
    width: scale(20),
    height: scale(20),
    borderRadius: moderateScale(4),
    marginRight: scale(6),
  },
  dropdownTriggerText: {
    fontSize: moderateScale(13),
    flex: 1,
  },

  // Dropdown Menu Styles
  dropdownMenu: {
    position: 'absolute',
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    maxHeight: verticalScale(200),
  },
  dropdownScrollView: {
    maxHeight: verticalScale(200),
  },
  dropdownListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
  },
  dropdownImageThumbnail: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(6),
    marginRight: scale(10),
  },
  dropdownListItemText: {
    fontSize: moderateScale(14),
  },

  // --- İÇ AKSİYON BUTONLARI (İPTAL / İÇE AKTAR) ---
  previewActionButtons: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(16),
  },
  btnCancel: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
  },
  btnCancelText: {
    fontWeight: '700',
    fontSize: moderateScale(14),
  },
  btnImport: {
    flex: 2,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
  },
  btnImportText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: moderateScale(14),
  },

  // --- SABİT ALT AKSİYON BUTONLARI (İLK EKRAN) ---
  bottomActions: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: verticalScale(16),
  },
  btnDownloadTemplate: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249, 138, 33, 0.15)', // Çok tatlı bir turuncu transparan
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#F98A21',
  },
  btnDownloadTemplateText: {
    color: '#F98A21',
    fontWeight: '700',
    fontSize: moderateScale(13),
    flexShrink: 1,
  },
  btnPickCsv: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(12),
  },
  btnPickCsvText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: moderateScale(13),
    flexShrink: 1,
  },
});