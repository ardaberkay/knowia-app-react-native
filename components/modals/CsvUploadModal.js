import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Platform, Modal as RNModal, TouchableWithoutFeedback } from 'react-native';
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

export default function CsvUploadModal({
  isVisible,
  onClose,
  deck
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbarHelpers();
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageIds, setImageIds] = useState([]); // CSV'deki görsel ID'leri
  const [imageIdMap, setImageIdMap] = useState({}); // Görsel ID -> Seçilen görsel eşleştirmesi
  const [dropdownOpen, setDropdownOpen] = useState({}); // Dropdown açık/kapalı durumları
  const [dropdownPos, setDropdownPos] = useState({}); // Dropdown pozisyonları (her imageId için)
  const dropdownRefs = useRef({}); // Dropdown referansları (her imageId için)
  const [tableGuideExpanded, setTableGuideExpanded] = useState(false); // Tablo rehberi genişletilmiş durumu

  // Türkçe karakterleri normalize et (encoding sorunlarını çözmek için)
  const normalizeTurkishChars = (str) => {
    if (!str) return '';
    // Önce tüm Türkçe karakterleri normalize et
    let normalized = str
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C');

    // Bozuk encoding karakterlerini de normalize et (ASCII olmayan karakterler)
    // "görsel" -> "grsel" gibi durumlar için
    normalized = normalized.replace(/[^\x00-\x7F]/g, 'o');

    return normalized;
  };

  // Header mapping sistemi
  const VALID_FIELDS = {
    'question': ['soru', 'question', 'q', 'sorular', 'soru metni', 'Soru', 'S', 'SORU', 'Question'],
    'answer': ['cevap', 'answer', 'a', 'cevaplar', 'cevap metni', 'Cevap', 'C', 'CEVAP', 'Answer'],
    'example': ['örnek', 'ornek', 'example', 'e', 'örnekler', 'ornekler', 'örnek cümle', 'ornek cumle', 'Örnek', 'Ornek', 'Ö', 'O', 'ÖRNEK', 'ORNEK', 'Example'],
    'note': ['not', 'note', 'n', 'notlar', 'açıklama', 'aciklama', 'Not', 'N', 'NOT', 'Note'],
    'image': ['görsel', 'gorsel', 'grsel', 'image', 'img', 'resim', 'picture', 'pic', 'Görsel', 'Gorsel', 'G', 'GÖRSEL', 'GORSEL', 'Image']
  };
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  // Header işleme
  const processHeaders = (headers) => {
    const columnMap = {};
    const ignoredColumns = [];
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      const normalizedHeader = normalizeTurkishChars(cleanHeader);
      let matchedField = null;

      Object.keys(VALID_FIELDS).forEach(field => {
        // Hem orijinal hem normalize edilmiş versiyonu kontrol et
        const fieldValues = VALID_FIELDS[field].map(v => v.toLowerCase());
        const normalizedFieldValues = VALID_FIELDS[field].map(v => normalizeTurkishChars(v.toLowerCase()));

        // Orijinal header ile orijinal field değerlerini karşılaştır
        if (fieldValues.includes(cleanHeader)) {
          matchedField = field;
          return;
        }

        // Normalize edilmiş header ile normalize edilmiş field değerlerini karşılaştır
        if (normalizedFieldValues.includes(normalizedHeader)) {
          matchedField = field;
          return;
        }

        // Normalize edilmiş header ile orijinal field değerlerinin normalize edilmiş versiyonlarını karşılaştır
        if (fieldValues.some(v => normalizeTurkishChars(v) === normalizedHeader)) {
          matchedField = field;
          return;
        }
      });

      // Eğer hala eşleşme yoksa, özel durumlar için kontrol et
      if (!matchedField) {
        // "grsel" gibi bozuk encoding'leri "gorsel" ile eşleştir
        const veryNormalized = normalizedHeader.replace(/[^a-z0-9]/g, '');
        if (veryNormalized === 'grsel' || veryNormalized === 'gorsel' || veryNormalized.startsWith('gorsel') || veryNormalized.startsWith('grsel')) {
          matchedField = 'image';
        }
      }

      if (matchedField) {
        columnMap[matchedField] = index;
        console.log(`Header matched: "${header}" -> "${cleanHeader}" (normalized: "${normalizedHeader}") -> field: "${matchedField}"`);
      } else {
        ignoredColumns.push({
          column: header,
          index: index + 1,
          reason: t('common.unDefinedField', 'Tanımlanmamış alan')
        });
        console.log(`Header ignored: "${header}" -> "${cleanHeader}" (normalized: "${normalizedHeader}") (no match in VALID_FIELDS)`);
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
    // Header'ları parse et (orijinal header'ları koru, sadece trim ve lowercase yap)
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
      if (validation.isValid) {
        validCards.push(card);
      } else {
        errors.push(...validation.errors);
      }
    }
    return { validCards, errors, ignoredColumns, totalRows: lines.length - 1 };
  };

  // CSV şablonunu indirme fonksiyonu
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

  // Dosya adından uzantıyı temizle (eşleştirme için)
  const getFileNameWithoutExtension = (fileName) => {
    if (!fileName) return '';
    // URI'den dosya adını çıkar (eğer URI ise)
    let name = fileName;
    if (fileName.includes('/')) {
      name = fileName.split('/').pop() || fileName;
    }
    if (name.includes('\\')) {
      name = name.split('\\').pop() || name;
    }
    // Query string'leri kaldır
    if (name.includes('?')) {
      name = name.split('?')[0];
    }
    return name.replace(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i, '').toLowerCase().trim();
  };

  // Görsel tipini belirle (yerel dosya, Supabase URL, harici URL)
  const getImageType = (imageValue) => {
    if (!imageValue || typeof imageValue !== 'string' || imageValue.trim() === '') return null;
    const trimmed = imageValue.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Supabase URL kontrolü
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && trimmed.includes(supabaseUrl)) {
        return 'supabase_url';
      }
      return 'external_url';
    }
    if (trimmed.startsWith('file://')) {
      return 'local_file';
    }
    // Dosya adı olarak kabul et (uzantı olabilir veya olmayabilir)
    return 'file_name';
  };

  // URL'nin SVG olup olmadığını kontrol et
  const isSvgUrl = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.svg') || url.toLowerCase().includes('.svg?');
  };

  // Harici URL'den görseli indir ve WebP'ye çevir
  const downloadAndConvertImage = async (url) => {
    try {
      // SVG dosyalarını direkt URL olarak kullan (bitmap'e çevrilemez)
      if (isSvgUrl(url)) {
        console.log('SVG dosyası tespit edildi, direkt URL kullanılacak:', url);
        return null; // null döndür, direkt URL kullanılacak
      }

      // Görseli indir
      const downloadResult = await FileSystem.downloadAsync(
        url,
        FileSystem.cacheDirectory + `temp_image_${Date.now()}.tmp`
      );

      if (!downloadResult.uri) {
        throw new Error('Görsel indirilemedi');
      }

      // WebP'ye çevir
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

  // Görseli Supabase'e yükle
  const uploadImageToSupabase = async (imageUri) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Kullanıcı bulunamadı');

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const filePath = `card_${deck.id}_${user.id}_${Date.now()}.webp`;
      const buffer = Buffer.from(base64, 'base64');

      const { error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Supabase yükleme hatası:', error);
      return null;
    }
  };

  // Görseli işle (yerel dosya, URL, vb.)
  const processImage = async (imageValue, imageIndex = null) => {
    const imageType = getImageType(imageValue);

    if (!imageType) return null;

    try {
      switch (imageType) {
        case 'supabase_url':
          // Zaten Supabase'de, direkt kullan
          return imageValue.trim();

        case 'external_url':
          // Harici URL'den indir, WebP'ye çevir, Supabase'e yükle
          // SVG dosyaları desteklenmiyor
          if (isSvgUrl(imageValue.trim())) {
            console.log('SVG dosyası desteklenmiyor, atlanıyor:', imageValue.trim());
            return null; // SVG'ler desteklenmiyor, null döndür (görselsiz eklenecek)
          }

          const downloadedUri = await downloadAndConvertImage(imageValue.trim());
          if (!downloadedUri) {
            // İndirme/çevirme başarısız oldu, direkt URL'yi kullan
            console.log('Görsel indirilemedi, direkt URL kullanılıyor:', imageValue.trim());
            return imageValue.trim();
          }
          return await uploadImageToSupabase(downloadedUri);

        case 'local_file':
        case 'file_name':
          // Yerel dosya veya dosya adı - seçilen görsellerden eşleştir
          const fileName = imageValue.trim();
          const fileNameWithoutExt = getFileNameWithoutExtension(fileName);

          let matchedImage = null;

          // Önce dosya adına göre eşleştirmeyi dene
          matchedImage = selectedImages.find(img => {
            const imgName = img.name || img.fileName || img.uri?.split('/').pop() || img.uri?.split('\\').pop() || '';
            const selectedName = getFileNameWithoutExtension(imgName);
            return selectedName === fileNameWithoutExt;
          });

          // Eğer dosya adına göre eşleşme yoksa, sıralı eşleştirme yap
          if (!matchedImage && imageIndex !== null && imageIndex < selectedImages.length) {
            console.log('Dosya adı eşleşmedi, sıralı eşleştirme kullanılıyor:', {
              imageIndex,
              fileNameWithoutExt,
              selectedImageFileName: selectedImages[imageIndex]?.fileName
            });
            matchedImage = selectedImages[imageIndex];
          }

          console.log('Yerel dosya eşleştirme:', {
            fileName,
            fileNameWithoutExt,
            imageIndex,
            selectedImagesCount: selectedImages.length,
            matched: !!matchedImage,
            matchedImageFileName: matchedImage?.fileName
          });

          if (matchedImage) {
            console.log('Görsel işleniyor:', matchedImage.uri);
            // Görseli WebP'ye çevir ve Supabase'e yükle
            const manipResult = await ImageManipulator.manipulateAsync(
              matchedImage.uri,
              [{ resize: { width: 512 } }],
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            const uploadedUrl = await uploadImageToSupabase(manipResult.uri);
            console.log('Görsel yüklendi:', uploadedUrl);
            return uploadedUrl;
          }

          console.log('Eşleşme bulunamadı:', {
            fileNameWithoutExt,
            imageIndex,
            selectedImagesNames: selectedImages.map(img => getFileNameWithoutExtension(img.name || img.fileName || img.uri?.split('/').pop() || ''))
          });
          // Eşleşme bulunamadı, görmezden gel
          return null;

        default:
          return null;
      }
    } catch (error) {
      console.error('Görsel işleme hatası:', error);
      return null;
    }
  };

  // Görselleri seç (çoklu seçim)
  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Her asset için orijinal dosya adını sakla
        const assetsWithOriginalNames = result.assets.map((img) => {
          // Önce name property'sini kontrol et (genellikle orijinal dosya adı)
          // Eğer yoksa fileName'i kullan (cache'deki ad)
          const originalFileName = img.name || img.fileName || img.uri?.split('/').pop() || img.uri?.split('\\').pop() || '';
          return {
            ...img,
            originalFileName: originalFileName,
          };
        });

        console.log('Seçilen görseller:', assetsWithOriginalNames.map(img => ({
          name: img.name,
          fileName: img.fileName,
          originalFileName: img.originalFileName,
          uri: img.uri?.substring(0, 50),
          type: img.type,
        })));

        setSelectedImages(assetsWithOriginalNames);
        showSuccess(`${result.assets.length} ${t('addCard.imagesSelected', 'görsel seçildi')}`);
      }
    } catch (error) {
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
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
          showError(t('common.pleaseSelectCSV', 'Lütfen bir CSV dosyası seçin.'));
          setCsvLoading(false);
          return;
        }
        const csvContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const { validCards, errors, ignoredColumns, totalRows } = parseCSV(csvContent);

        // CSV'de görsel sütunu var mı kontrol et
        const hasImageColumn = validCards.some(card => card.image && typeof card.image === 'string' && card.image.trim() !== '');
        const hasLocalImageFiles = hasImageColumn && validCards.some(card => {
          if (!card.image || typeof card.image !== 'string') return false;
          const imageType = getImageType(card.image);
          return imageType === 'file_name' || imageType === 'local_file';
        });

        // CSV'deki görsel ID'lerini çıkar (benzersiz değerler)
        const uniqueImageIds = Array.from(
          new Set(
            validCards
              .map(card => card.image)
              .filter(img => img && typeof img === 'string' && img.trim() !== '')
              .map(img => img.trim())
          )
        ).filter(imgId => {
          // Sadece yerel dosya adlarını al (file_name veya local_file tipinde)
          const imageType = getImageType(imgId);
          return imageType === 'file_name' || imageType === 'local_file';
        });

        // SVG URL'leri olan kartları tespit et
        const cardsWithSvg = validCards.filter(card => {
          if (!card.image || typeof card.image !== 'string') return false;
          return isSvgUrl(card.image.trim());
        });

        console.log('CSV Parse Debug:', {
          totalCards: validCards.length,
          hasImageColumn,
          hasLocalImageFiles,
          imageIds: uniqueImageIds,
          sampleCard: validCards[0],
          allCardsWithImages: validCards.filter(c => c.image !== undefined),
          imageColumnMap: validCards.filter(c => c.image !== undefined).map(c => ({ question: c.question, image: c.image, imageType: getImageType(c.image) }))
        });

        setCsvPreview({
          fileName: file.name,
          totalRows: totalRows,
          validCards: validCards.slice(0, 3), // İlk 3 kartı önizleme
          errors: errors.slice(0, 5), // İlk 5 hatayı göster
          allValidCards: validCards,
          allErrors: errors,
          ignoredColumns: ignoredColumns,
          hasImageColumn: hasImageColumn,
          hasLocalImageFiles: hasLocalImageFiles,
          cardsWithSvg: cardsWithSvg
        });

        // Görsel ID'lerini set et
        setImageIds(uniqueImageIds);
        // Eşleştirmeleri sıfırla
        setImageIdMap({});
        // Dropdown durumlarını sıfırla
        setDropdownOpen({});
        setDropdownPos({});
        dropdownRefs.current = {};

        // SVG URL'leri varsa uyarı göster
        if (cardsWithSvg.length > 0) {
          showError(`${cardsWithSvg.length} ${t('addCard.svgNotSupported', 'kartta SVG görseli bulundu. SVG formatı desteklenmiyor, bu kartlar görselsiz eklenecek.')}`);
        }

        // Eğer yerel dosya adları varsa görselleri sıfırla (yeniden seçilmeli)
        if (hasLocalImageFiles) {
          setSelectedImages([]);
        }
      }
    } catch (error) {
      showError(t('common.csvReadError', 'CSV dosyası okunamadı: ') + error.message);
    } finally {
      setCsvLoading(false);
    }
  };

  // Kartları içe aktarma fonksiyonu
  const handleImportCards = async () => {
    if (!csvPreview.allValidCards.length) {
      showError(t('addCard.noValidCards', 'Geçerli kart yok.'));
      return;
    }

    // Eğer yerel dosya adları varsa ve görsel seçilmemişse uyar
    if (csvPreview.hasLocalImageFiles && selectedImages.length === 0) {
      showError(t('addCard.selectImagesFirst', 'Lütfen önce görselleri seçin.'));
      return;
    }

    // Eğer görsel ID'leri varsa ve hepsi eşleştirilmemişse uyar
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

            // Yerel dosya adları için imageIdMap'ten eşleştirilmiş görseli al
            if (imageType === 'file_name' || imageType === 'local_file') {
              const matchedImage = imageIdMap[imageId];
              if (matchedImage) {
                // Görseli WebP'ye çevir ve Supabase'e yükle
                const manipResult = await ImageManipulator.manipulateAsync(
                  matchedImage.uri,
                  [{ resize: { width: 512 } }],
                  { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                imageUrl = await uploadImageToSupabase(manipResult.uri);
              }
            } else {
              // Diğer görsel tipleri için mevcut processImage fonksiyonunu kullan
              imageUrl = await processImage(card.image, null);
            }
          }
          return {
            deck_id: deck.id,
            question: card.question.trim(),
            answer: card.answer.trim(),
            example: card.example.trim() || null,
            note: card.note.trim() || null,
            image: imageUrl || null,
          };
        })
      );

      // Kartları batch'ler halinde ekle
      const batchSize = 50;
      for (let i = 0; i < processedCards.length; i += batchSize) {
        const batch = processedCards.slice(i, i + batchSize);
        const { error } = await supabase
          .from('cards')
          .insert(batch);
        if (error) {
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }
      const message = `${successCount} ${t('addCard.importCompletedMessage', 'kart başarıyla eklendi.')}${errorCount > 0 ? ` ${errorCount} ${t('addCard.importCompletedError', 'kart eklenemedi.')}` : ''}`;
      showSuccess(message);
      setTimeout(() => {
        setCsvPreview(null);
        setSelectedImages([]);
        onClose();
      }, 1500);
    } catch (e) {
      showError(t('addCard.errorImport', 'Kartlar eklenirken bir hata oluştu: ') + e.message);
    } finally {
      setCsvLoading(false);
    }
  };

  // Dropdown açma fonksiyonu (her imageId için)
  const openImageDropdown = (imageId) => {
    const ref = dropdownRefs.current[imageId];
    if (ref && ref.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        setDropdownPos(prev => ({
          ...prev,
          [imageId]: { x, y, width, height }
        }));
        setDropdownOpen(prev => ({ ...prev, [imageId]: true }));
      });
    } else {
      setDropdownOpen(prev => ({ ...prev, [imageId]: true }));
    }
  };

  // Dropdown kapatma fonksiyonu
  const closeImageDropdown = (imageId) => {
    setDropdownOpen(prev => ({ ...prev, [imageId]: false }));
  };

  // Görsel seçme fonksiyonu
  const handleImageSelect = (imageId, img, idx) => {
    setImageIdMap(prev => ({
      ...prev,
      [imageId]: {
        ...img,
        selectionIndex: idx + 1,
      },
    }));

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
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <Text style={[typography.styles.h2, { color: colors.text }]}>
            {t('addCard.csvUpload', 'CSV ile yükle')}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: verticalScale(8), bottom: verticalScale(8), left: scale(8), right: scale(8) }}
          >
            <Iconify icon="material-symbols:close-rounded" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.description, { color: colors.text, marginBottom: verticalScale(16) }]}>
            {t('addCard.csvUploadDescriptionMain', 'Kartlarınızı Excel veya Google Sheets\'te hazırlayın ve CSV olarak kaydedin. CSV dosyanızı yükleyin ve kartlarınız hazır!')}
          </Text>

          {/* Tablo Nasıl Oluşturulur - Expandable */}
          <View style={[styles.expandableSection, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setTableGuideExpanded(!tableGuideExpanded)}
              activeOpacity={0.7}
              style={styles.expandableHeader}
            >
              <Iconify icon="material-symbols:info-outline" size={moderateScale(24)} color={colors.secondary} style={{ marginRight: scale(8) }} />
              <Text style={[styles.expandableHeaderText, { color: colors.text }]}>
                {t('addCard.howToCreateTable', 'Tablo Nasıl Oluşturulur?')} {tableGuideExpanded ? t('common.clickToCollapse', 'Tıkla!') : t('common.clickToExpand', 'Tıkla!')}
              </Text>
              <Iconify
                icon="flowbite:caret-down-solid"
                size={moderateScale(18)}
                color={colors.text}
                style={{ transform: [{ rotate: tableGuideExpanded ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {tableGuideExpanded && (
              <View style={styles.expandableContent}>
                {/* BAŞLIK 1 */}
                <Text style={[styles.headerTitle, { color: colors.text, marginBottom: scale(8) }]}>
                  {t('addCard.tableStructureTitle', 'CSV Formatı: ')}
                </Text>

                {/* İÇERİK 1 - \t yerine marginLeft daha güvenlidir */}
                <Text style={[styles.expandableText, { color: colors.text, marginLeft: scale(16) }]}>
                  {t('addCard.tableStructure', 'Tablo 2 zorunlu 3 opsiyonel olmak üzere 5 sütundan oluşabilir. Sütunlar:')}
                </Text>

                {/* SÜTUNLAR KUTUCUĞU */}
                <View style={[styles.tableColumnsContainer, {
                  borderColor: colors.border,
                  borderWidth: moderateScale(1),
                  borderRadius: moderateScale(10),
                  padding: scale(8),
                  marginVertical: scale(10),
                  alignSelf: 'flex-start' // Kutunun tüm satırı kaplamaması için
                }]}>
                  <Text style={[styles.expandableTextBold, { color: colors.text }]}>
                    {t('addCard.tableColumns', 'soru, cevap, ornek, not, gorsel')}
                  </Text>
                </View>

                {/* UYARI METNİ */}
                <Text style={[styles.expandableText, { color: colors.secondary, marginBottom: scale(16) }]}>
                  {t('addCard.requiredColumns', 'soru ve cevap sütunları zorunludur! ornek, not, gorsel sütunları isteğe bağlıdır.')}
                </Text>

                {/* BAŞLIK 2 */}
                <Text style={[styles.headerTitle, { color: colors.text, marginBottom: scale(8) }]}>
                  {t('addCard.tableImageInstructionsTitle', 'Görsel Ekleme: ')}
                </Text>

                {/* İÇERİK 2 */}
                <Text style={[styles.expandableText, { color: colors.text, marginLeft: scale(16), marginBottom: scale(8) }]}>
                  {t('addCard.imageInstructions', 'Kartlara görsel eklemek için...')}
                </Text>

                {/* SVG NOTU */}
                <Text style={[styles.expandableText, { color: colors.border, fontStyle: 'italic' }]}>
                  {t('addCard.svgNote', 'Not: SVG formatı desteklenmemektedir.')}
                </Text>

                {/* KIRMIZI UYARI */}
                <Text style={[styles.expandableText, { color: '#D32F2F', marginTop: scale(8), marginBottom: scale(16) }]}>
                  {t('addCard.csvUploadDescriptionThird', 'Her satır bir kartı temsil eder. Boş satırlar veya eksik zorunlu alanlar atlanır.')}
                </Text>

                {/* TIKLANABİLİR ÖRNEK TABLO GÖRSELİ */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => { setImageModalVisible(true) }}
                >
                  <Image
                    source={require('../../assets/examtable.png')}
                    style={[styles.exampleTableImage, {
                      width: '100%',
                      height: undefined,
                      aspectRatio: 3.5 // Yatay uzun görseller için (Genişlik / Yükseklik)
                    }]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            )}
            <Modal visible={isImageModalVisible} transparent={true}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', height: '100%' }}>
                <TouchableOpacity
                  style={{ position: 'absolute', top: 50, right: 20, zIndex: 1 }}
                  onPress={() => setImageModalVisible(false)} // Kapat butonu
                >
                  <Iconify icon="mingcute:close-fill" size={24} color="white" />
                </TouchableOpacity>

                <Image
                  source={require('../../assets/examtable.png')}
                  style={{ width: '100%', height: '50%' }}
                  resizeMode="contain"
                />
              </View>
            </Modal>
          </View>

          {csvPreview ? (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Iconify icon="tabler:file-description-filled" size={moderateScale(20)} color="#FFF3CD" style={{ marginRight: scale(8) }} />
                <Text style={[styles.previewTitle, { color: colors.text }]}>
                  {t('addCard.file', 'Dosya: ')} {csvPreview.fileName}
                </Text></View>
              <View style={styles.previewHeader}>
                <Iconify icon="mdi:cards" size={moderateScale(20)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
                <Text style={[styles.previewText, { color: colors.text }]}>
                  {t('addCard.totalRows', 'Toplam satır: ')} {csvPreview.totalRows}
                </Text></View>
              <View style={styles.previewHeader}>
                <Iconify icon="hugeicons:document-validation" size={moderateScale(20)} color="#27AE60" style={{ marginRight: scale(8) }} />
                <Text style={[styles.previewText, { color: colors.text }]}>
                  {t('addCard.validCards', 'Geçerli kart: ')} {csvPreview.allValidCards.length}
                </Text>
              </View>
              <View style={styles.previewHeader}>
                <Iconify icon="icon-park-outline:invalid-files" size={moderateScale(20)} color="#D32F2F" style={{ marginRight: scale(8) }} />
                <Text style={[styles.previewText, { color: colors.text, marginBottom: verticalScale(6) }]}>
                  {t('addCard.invalidCards', 'Geçersiz kart: ')} {csvPreview.allErrors.length}
                </Text>
              </View>


              {csvPreview.cardsWithSvg && csvPreview.cardsWithSvg.length > 0 && (
                <View style={[styles.warningContainer, { backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
                  <Iconify icon="mdi:information-variant" size={moderateScale(20)} color="#856404" style={{ marginRight: scale(8) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.warningTitle, { color: '#856404' }]}>
                      {t('addCard.svgWarning', 'SVG Formatı Desteklenmiyor')}
                    </Text>
                    <Text style={[styles.warningText, { color: '#856404' }]}>
                      {csvPreview.cardsWithSvg.length} {t('addCard.svgWarningMessage', 'kartta SVG görseli bulundu. Bu kartlar görselsiz eklenecek.')}
                    </Text>
                  </View>
                </View>
              )}

              {csvPreview.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  <Text style={[styles.errorsTitle, { color: '#D32F2F' }]}>
                    {t('addCard.errors', 'Hatalar (ilk 5):')}
                  </Text>
                  {csvPreview.errors.map((err, idx) => (
                    <Text key={idx} style={[styles.errorText, { color: '#D32F2F' }]}>
                      • {t('addCard.errorRow', 'Satır ')} {err.row}: {err.message}
                    </Text>
                  ))}
                </View>
              )}

              {csvPreview.hasLocalImageFiles && (
                <View style={styles.imagesContainer}>
                  <Text style={[styles.imagesTitle, { color: colors.text }]}>
                    {t('addCard.selectImages', 'Görselleri Seç')}
                  </Text>
                  <Text style={[styles.imagesDescription, { color: colors.muted }]}>
                    {t('addCard.selectImagesDescription', 'CSV\'de belirttiğiniz görsel isimleri ile seçtiğiniz görselleri eşleştirebilirsiniz.')}
                  </Text>
                  <Text style={[styles.imagesCount, { color: colors.text }]}>
                    {selectedImages.length > 0
                      ? `${selectedImages.length} ${t('addCard.imagesSelected', 'görsel seçildi')}`
                      : t('addCard.noImagesSelected', 'Henüz görsel seçilmedi')}
                  </Text>
                  <TouchableOpacity
                    onPress={handlePickImages}
                    style={[styles.selectImagesButton, {
                      backgroundColor: colors.blurView,
                      borderColor: colors.border
                    }]}
                    disabled={csvLoading}
                  >
                    <Iconify icon="mage:image-fill" size={moderateScale(20)} color={colors.text} style={{ marginRight: scale(8) }} />
                    <Text style={[styles.selectImagesButtonText, { color: colors.text }]}>
                      {t('addCard.pickImages', 'Görselleri Seç')}
                    </Text>
                  </TouchableOpacity>

                  {/* Her görsel ID için dropdown göster */}
                  {imageIds.length > 0 && selectedImages.length > 0 && (
                    <View style={styles.imageMappingContainer}>
                      <Text style={[styles.imageMappingTitle, { color: colors.text }]}>
                        {t('addCard.mapImages', 'Görselleri Eşleştir')}
                      </Text>
                      {imageIds.map((imageId, index) => {
                        const selectedImg = imageIdMap[imageId];
                        const displayName = selectedImg
                          ? (selectedImg.originalFileName || selectedImg.name || selectedImg.fileName || selectedImg.uri.split('/').pop() || '')
                          : '';
                        const fileNameWithoutExt = getFileNameWithoutExtension(displayName);

                        return (
                          <View
                            key={imageId}
                            style={[styles.dropdownContainer, { zIndex: imageIds.length - index }]}
                          >
                            <Text style={[styles.imageIdLabel, { color: colors.text }]}>
                              {index + 1}. {t('addCard.imageId', 'Görsel ID: ')} {imageId}
                            </Text>
                            <TouchableOpacity
                              ref={(ref) => {
                                if (ref) dropdownRefs.current[imageId] = ref;
                              }}
                              collapsable={false}
                              onPress={() => openImageDropdown(imageId)}
                              style={[styles.dropdown, { backgroundColor: colors.blurView, borderColor: colors.border }]}
                              activeOpacity={0.9}
                            >

                              {selectedImg ? (
                                <View style={styles.dropdownSelectedItem}>
                                  <Image
                                    source={{ uri: selectedImg.uri }}
                                    style={styles.dropdownImageThumbnail}
                                    resizeMode="cover"
                                  />
                                  <Text style={[styles.dropdownSelectedItemText, { color: colors.text }]}>
                                    {selectedImg?.selectionIndex
                                      ? `${t('addCard.selection', 'Seçim')} ${selectedImg.selectionIndex}`
                                      : t('addCard.selectImage', 'Görsel seç')}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={[styles.dropdownPlaceholderText, { color: colors.muted }]}>
                                  {t('addCard.selectImage', 'Görsel seç')}
                                </Text>
                              )}

                              <Iconify icon="flowbite:caret-down-solid" size={moderateScale(20)} color={colors.text} />
                            </TouchableOpacity>

                            {/* Dropdown Menu */}
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
                                      backgroundColor: colors.blurView,
                                      borderColor: colors.border,
                                      left: dropdownPos[imageId]?.x || 0,
                                      top: Platform.OS === 'android'
                                        ? (dropdownPos[imageId]?.y || 0) + (dropdownPos[imageId]?.height || 0)
                                        : (dropdownPos[imageId]?.y || 0) + (dropdownPos[imageId]?.height || 0) + verticalScale(4),
                                      minWidth: dropdownPos[imageId]?.width || scale(200),
                                      zIndex: imageIds.length - index + 1000,
                                    }
                                  ]}>
                                    <ScrollView
                                      style={styles.dropdownScrollView}
                                      showsVerticalScrollIndicator={false}
                                    >
                                      {selectedImages.map((img, idx) => {
                                        const imgDisplayName =
                                          img.originalFileName ||
                                          img.name ||
                                          img.fileName ||
                                          img.uri.split('/').pop() ||
                                          `${t('addCard.imageCount', 'Görsel')} ${idx + 1}`;

                                        const imgFileNameWithoutExt = getFileNameWithoutExtension(imgDisplayName);
                                        const isSelected = imageIdMap[imageId]?.uri === img.uri;
                                        const isLastItem = idx === selectedImages.length - 1;

                                        return (
                                          <TouchableOpacity
                                            key={img.uri}
                                            onPress={() => handleImageSelect(imageId, img, idx)} // ✅ idx eklendi
                                            style={[
                                              styles.dropdownListItem,
                                              {
                                                backgroundColor: colors.background,
                                                borderBottomWidth: isLastItem ? moderateScale(0) : moderateScale(1),
                                                borderBottomColor: colors.border,
                                              },
                                              isSelected && { backgroundColor: colors.buttonColor },
                                            ]}
                                            activeOpacity={0.9}
                                          >
                                            <Image
                                              source={{ uri: img.uri }}
                                              style={styles.dropdownImageThumbnail}
                                              resizeMode="cover"
                                            />

                                            <Text
                                              style={[
                                                styles.dropdownListItemText,
                                                {
                                                  color: colors.text,
                                                  fontWeight: isSelected ? '800' : 'normal',
                                                  fontSize: isSelected ? moderateScale(15) : moderateScale(14),
                                                },
                                              ]}
                                            >
                                              {`${t('addCard.selection', 'Seçim')} ${idx + 1}`}
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

              <TouchableOpacity
                onPress={handleImportCards}
                style={[styles.importButton, { backgroundColor: colors.buttonColor || '#007AFF' }]}
                disabled={csvLoading || (csvPreview.hasLocalImageFiles && selectedImages.length === 0) || (imageIds.length > 0 && Object.keys(imageIdMap).length !== imageIds.length)}
              >
                <Text style={styles.importButtonText}>
                  {csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.importCards', 'Kartları İçe Aktar')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCsvPreview(null)}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('common.cancel', 'İptal Et')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                onPress={handleDownloadTemplate}
                style={[styles.downloadButton, { backgroundColor: '#F98A21' }]}
              >
                <Text style={styles.downloadButtonText}>
                  {t('addCard.downloadTemplate', 'Örnek CSV İndir')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickCSV}
                style={[styles.selectButton, {
                  backgroundColor: colors.blurView,
                  borderColor: colors.border
                }]}
                disabled={csvLoading}
              >
                <Text style={[styles.selectButtonText, { color: colors.text }]}>
                  {csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.selectCSV', 'CSV Dosyası Seç')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>

  );
}

const styles = StyleSheet.create({
  modalContainer: {
    borderRadius: moderateScale(32),
    padding: scale(24),
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  scrollView: {
    maxHeight: verticalScale(500),
  },
  description: {
    fontSize: moderateScale(15),
    marginBottom: verticalScale(18),
    textAlign: 'center',
    lineHeight: verticalScale(22),
  },
  descriptionBold: {
    fontWeight: 'bold',
  },
  expandableSection: {
    marginBottom: verticalScale(20),
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    borderBottomWidth: moderateScale(1),

  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(8),
    backgroundColor: 'transparent',
  },
  expandableHeaderText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    flex: 1,
  },
  expandableContent: {
    paddingTop: verticalScale(12),
    paddingHorizontal: scale(16),

  },
  expandableText: {
    fontSize: moderateScale(14),
    lineHeight: verticalScale(20),
    marginBottom: verticalScale(12),
  },
  expandableTextBold: {
    fontWeight: '600',
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: moderateScale(18),
  },
  exampleTableImage: {
    width: '100%',
    borderRadius: moderateScale(25),
  },
  previewContainer: {
    marginTop: verticalScale(8),
  },
  previewHeader: {
    flexDirection: 'row',
    marginBottom: verticalScale(8),
  },
  previewTitle: {
    fontWeight: 'bold',
    fontSize: moderateScale(16),
    marginBottom: verticalScale(4),
  },
  previewText: {
    fontSize: moderateScale(15),
    marginBottom: verticalScale(4),
  },
  errorsContainer: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  errorsTitle: {
    fontWeight: 'bold',
    fontSize: moderateScale(15),
    marginBottom: verticalScale(4),
  },
  errorText: {
    fontSize: moderateScale(14),
    marginBottom: verticalScale(2),
  },
  importButton: {
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    marginTop: verticalScale(10),
  },
  importButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(16),
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: verticalScale(10),
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    backgroundColor: 'transparent',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(18),
  },
  cancelButtonText: {
    fontSize: moderateScale(15),
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(16),
    marginTop: verticalScale(8),
  },
  downloadButton: {
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(18),
    marginRight: scale(8),
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: moderateScale(15),
  },
  selectButton: {
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(18),
    borderWidth: moderateScale(1),
  },
  selectButtonText: {
    fontWeight: 'bold',
    fontSize: moderateScale(15),
  },
  imagesContainer: {
    marginTop: verticalScale(12),
    marginBottom: verticalScale(8),
    padding: scale(12),
    borderRadius: moderateScale(8),
    backgroundColor: 'transparent',
    borderWidth: moderateScale(1),
    borderColor: '#E0E0E0',
  },
  imagesTitle: {
    fontWeight: 'bold',
    fontSize: moderateScale(15),
    marginBottom: verticalScale(4),
  },
  imagesDescription: {
    fontSize: moderateScale(13),
    marginBottom: verticalScale(6),
  },
  imagesCount: {
    fontSize: moderateScale(14),
    marginBottom: verticalScale(8),
  },
  selectImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    borderWidth: moderateScale(1),
  },
  selectImagesButtonText: {
    fontWeight: 'bold',
    fontSize: moderateScale(14),
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: moderateScale(8),
    borderWidth: moderateScale(1),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  warningTitle: {
    fontWeight: 'bold',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(4),
  },
  warningText: {
    fontSize: moderateScale(13),
    lineHeight: verticalScale(18),
  },
  imageMappingContainer: {
    marginTop: verticalScale(16),
  },
  imageMappingTitle: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    marginBottom: verticalScale(12),
  },
  dropdownContainer: {
    marginBottom: verticalScale(12),
  },
  imageIdLabel: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    marginBottom: verticalScale(6),
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: moderateScale(1),
    borderRadius: moderateScale(8),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    marginBottom: verticalScale(8),
  },
  dropdownPlaceholderText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(6),
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(8),
    elevation: 8,
    borderWidth: moderateScale(1),
    maxHeight: verticalScale(200),
  },
  dropdownScrollView: {
    maxHeight: verticalScale(200),
  },
  dropdownImageThumbnail: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(6),
    marginRight: scale(12),
  },
  dropdownListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(8),
  },
  dropdownListItemText: {
    fontSize: moderateScale(14),
    flex: 1,
  },
  dropdownSelectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSelectedItemText: {
    fontSize: moderateScale(14),
    flex: 1,
  },
});
