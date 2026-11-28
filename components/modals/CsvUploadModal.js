import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, TouchableWithoutFeedback, Pressable, Platform } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { typography, fontSizes, fonts } from '../../theme/typography';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { uploadCardImage, removeUnusedCardImages } from '../../services/StorageService';
import { importCards } from '../../services/CardService';
import { CARD_LIMITS, CSV_LIMITS, CARD_IMAGE } from '../../lib/limits';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbarHelpers } from '../ui/Snackbar';
import PhosphorIcon from '../ui/PhosphorIcon';
import { ICONS } from '../../theme/icons';
import { GuideSteps, GuideTip } from './HowToGuideSheet';


// A native menu (SwiftUI Menu / Material DropdownMenu) laid over a trigger of
// any size: the trigger draws itself and a same-sized transparent anchor takes
// the taps, so the OS places the menu.
function MenuOverlay({ actions, onPressAction, children }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return (
    <View>
      <View pointerEvents="none" onLayout={onLayout}>{children}</View>
      <MenuView actions={actions} onPressAction={onPressAction} style={StyleSheet.absoluteFill}>
        <View style={size} />
      </MenuView>
    </View>
  );
}

export default function CsvUploadModal({
  isVisible,
  onClose,
  onImported, // "Tamam" after cards were added: the parent goes back to the deck
  deck
}) {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { showSuccess, showError } = useSnackbarHelpers();
  
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageIds, setImageIds] = useState([]);
  const [imageIdMap, setImageIdMap] = useState({});
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  // While importing: { phase: 'images' | 'cards', done, total }. After: the result.
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const importingRef = useRef(false);
  const isImporting = importProgress != null;
  const scrollViewRef = useRef(null);

  // Native sheet: SwiftUI sheet on iOS, Material ModalBottomSheet on Android.
  const sheetRef = useRef(null);
  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;
  useEffect(() => {
    if (isVisible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [isVisible]);
  // Swipe/backdrop dismiss tells the parent; skipped when the parent closed it.
  const handleSheetDismiss = () => {
    if (visibleRef.current) handleClose();
  };


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
    const tooLong = (field, type, key, fallback) => {
      if (card[field] && card[field].trim().length > CARD_LIMITS[field]) {
        errors.push({ type, row: rowNumber, message: t(key, fallback) });
      }
    };
    tooLong('question', 'QUESTION_TOO_LONG', 'addCard.questionTooLong', `Soru en fazla ${CARD_LIMITS.question} karakter olabilir`);
    tooLong('answer', 'ANSWER_TOO_LONG', 'addCard.answerTooLong', `Cevap en fazla ${CARD_LIMITS.answer} karakter olabilir`);
    tooLong('example', 'EXAMPLE_TOO_LONG', 'addCard.exampleTooLong', `Örnek en fazla ${CARD_LIMITS.example} karakter olabilir`);
    tooLong('note', 'NOTE_TOO_LONG', 'addCard.noteTooLong', `Not en fazla ${CARD_LIMITS.note} karakter olabilir`);
    if (!card.question || card.question.trim() === '') {
      errors.push({ type: 'EMPTY_QUESTION', row: rowNumber, message: t("addCard.emptyQuestion", "Soru alanı boş olamaz") });
    }
    if (!card.answer || card.answer.trim() === '') {
      errors.push({ type: 'EMPTY_ANSWER', row: rowNumber, message: t("addCard.emptyAnswer", "Cevap alanı boş olamaz") });
    }
    return { isValid: errors.length === 0, errors: errors };
  };

  // Separator from the header line: Excel saves with ";" in Turkish, German,
  // French… and with "," in English; tab is accepted too.
  const detectDelimiter = (text) => {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
      else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
    }
    if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
    if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
    return ',';
  };

  // Whole-text CSV parser: a quoted cell may contain the separator, "" and
  // line breaks (a line break inside a cell no longer splits the row).
  const parseCsvRows = (text, delimiter) => {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((cells) => cells.map((v) => v.trim()));
  };

  const parseCSV = (csvContent) => {
    const text = String(csvContent || '').replace(/^\uFEFF/, '');
    const rows = parseCsvRows(text, detectDelimiter(text)).filter((cells) => cells.some((v) => v !== ''));
    if (rows.length < 2) return { validCards: [], errors: [], ignoredColumns: [], totalRows: Math.max(rows.length - 1, 0) };

    const headers = rows[0].map(h => h.toLowerCase());
    const { columnMap, ignoredColumns } = processHeaders(headers);

    if (columnMap.question === undefined || columnMap.answer === undefined) {
      return {
        validCards: [],
        errors: [{ type: 'MISSING_REQUIRED_HEADERS', message: t('common.missingRequiredHeaders', 'Soru ve cevap sütunları gerekli') }],
        ignoredColumns: ignoredColumns,
        totalRows: rows.length - 1
      };
    }

    const validCards = [];
    const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const card = {};
      Object.keys(columnMap).forEach(field => {
        card[field] = values[columnMap[field]] || '';
      });
      const validation = validateCard(card, i + 1);
      if (validation.isValid) { validCards.push(card); }
      else { errors.push(...validation.errors); }
    }
    return { validCards, errors, ignoredColumns, totalRows: rows.length - 1 };
  };

  const handleDownloadTemplate = async () => {
    const csvContent = 'soru,cevap,ornek,not,görsel\nBook,Kitap,i am reading a book,Buk seklinde okunur,book\nKnowledge,Bilgi,Knowledge is power.,Bilgi guctur,https://flagcdn.com/w1280/it.png';
    const fileUri = FileSystem.documentDirectory + 'ornek_kartlar.csv';
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      showError(t('addCard.errorUpload', 'Paylaşım desteklenmiyor'));
    }
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

  // One key per distinct image (file name, web link or Supabase link): an
  // image used by several cards is processed and uploaded once.
  const imageKeyOf = (card) => (typeof card?.image === 'string' && card.image.trim()) || null;
  // Images this import has to upload (Supabase links are reused as they are).
  const needsUpload = (key) => {
    const type = getImageType(key);
    return type === 'file_name' || type === 'local_file' || (type === 'external_url' && !isSvgUrl(key));
  };

  // Resized and saved as real WebP (the file was JPEG with a .webp name before).
  const toWebp = async (uri) => (await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: CARD_IMAGE.width } }],
    { compress: CARD_IMAGE.compress, format: ImageManipulator.SaveFormat.WEBP }
  )).uri;

  const uploadImageFile = async (uri) => {
    if (!userId) throw new Error('no user');
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return uploadCardImage(deck.id, userId, Buffer.from(base64, 'base64'));
  };

  // → { url } or { error: 'svg' | 'download' | 'tooLarge' | 'unmatched' | 'upload' }
  const prepareImage = async (key) => {
    const type = getImageType(key);
    if (type === 'supabase_url') return { url: key };
    if (type === 'external_url') {
      if (isSvgUrl(key)) return { error: 'svg' };
      const tmp = `${FileSystem.cacheDirectory}csv_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;
      try {
        const res = await FileSystem.downloadAsync(key, tmp);
        if (!res?.uri || (res.status && res.status >= 400)) return { error: 'download' };
        const info = await FileSystem.getInfoAsync(res.uri);
        if (info?.size && info.size > CSV_LIMITS.maxUrlImageBytes) return { error: 'tooLarge' };
        try { return { url: await uploadImageFile(await toWebp(res.uri)) }; }
        catch { return { error: 'upload' }; }
      } catch {
        return { error: 'download' };
      } finally {
        FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
      }
    }
    // file name in the CSV → the picked photo the user matched to it
    const picked = imageIdMap[key];
    if (!picked) return { error: 'unmatched' };
    try { return { url: await uploadImageFile(await toWebp(picked.uri)) }; }
    catch { return { error: 'upload' }; }
  };

  // Runs worker over items with at most `limit` at the same time (memory and
  // storage rate limits: not every image at once).
  const runPool = async (items, limit, worker) => {
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    });
    await Promise.all(runners);
  };

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: CSV_LIMITS.maxImages,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const assetsWithOriginalNames = result.assets.map((img) => {
          const originalFileName = img.name || img.fileName || img.uri?.split('/').pop() || img.uri?.split('\\').pop() || '';
          return { ...img, originalFileName: originalFileName };
        });
        setSelectedImages(assetsWithOriginalNames);
        showSuccess(`${result.assets.length} ${t('addCard.imagesSelected', 'görsel seçildi')}`);
      }
    } catch (error) {
      showError(t('common.imageNotSelected', 'Fotoğraf seçilemedi.'));
    }
  };

  const readPickedCsvAsString = async (sourceUri) => {
    const b64Enc = FileSystem.EncodingType?.Base64 ?? 'base64';

    const readAsBase64 = async (uri) => {
      return await FileSystem.readAsStringAsync(uri, { encoding: b64Enc });
    };

    let base64;
    try {
      base64 = await readAsBase64(sourceUri);
    } catch {
      const tempUri = `${FileSystem.cacheDirectory}csv_import_${Date.now()}.csv`;
      try {
        await FileSystem.copyAsync({ from: sourceUri, to: tempUri });
        base64 = await readAsBase64(tempUri);
      } finally {
        FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
    }

    const fileBuffer = Buffer.from(base64, 'base64');

    if (fileBuffer[0] === 0xEF && fileBuffer[1] === 0xBB && fileBuffer[2] === 0xBF) {
      return fileBuffer.slice(3).toString('utf8');
    }

    const utf8Text = fileBuffer.toString('utf8');
    if (utf8Text.includes('\uFFFD') || utf8Text.includes('\u0000')) {
      return decodeWindows1254(fileBuffer);
    }

    return utf8Text;
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
        if (file.size && file.size > CSV_LIMITS.maxFileBytes) {
          showError(t('addCard.csvTooLarge', 'CSV dosyası en fazla 5 MB olabilir.'));
          return;
        }
        const csvContent = await readPickedCsvAsString(file.uri);

        const { validCards, errors, ignoredColumns, totalRows } = parseCSV(csvContent);
        if (validCards.length > CSV_LIMITS.maxCards) {
          showError(t('addCard.csvTooManyCards', { count: CSV_LIMITS.maxCards, defaultValue: `Bir CSV'de en fazla ${CSV_LIMITS.maxCards} kart olabilir.` }));
          return;
        }
        const uploadKeys = new Set(validCards.map(imageKeyOf).filter((key) => key && needsUpload(key)));
        if (uploadKeys.size > CSV_LIMITS.maxImages) {
          showError(t('addCard.csvTooManyImages', { count: CSV_LIMITS.maxImages, defaultValue: `Bir CSV'de en fazla ${CSV_LIMITS.maxImages} farklı görsel olabilir.` }));
          return;
        }
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

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 200);

        setImageIds(uniqueImageIds);
        setImageIdMap({});

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
    if (importingRef.current) return;
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

    importingRef.current = true;
    const cards = csvPreview.allValidCards;
    const keys = [...new Set(cards.map(imageKeyOf).filter(Boolean))];
    const urlByKey = {};
    const uploaded = [];       // uploaded by this import, removed again if unused
    const imageFailures = [];  // { key, reason }
    try {
      // 1) every distinct image once, a few at a time
      let doneImages = 0;
      setImportProgress({ phase: 'images', done: 0, total: keys.length });
      await runPool(keys, CSV_LIMITS.imageConcurrency, async (key) => {
        const res = await prepareImage(key);
        if (res.url) {
          urlByKey[key] = res.url;
          if (getImageType(key) !== 'supabase_url') uploaded.push(res.url);
        } else {
          imageFailures.push({ key, reason: res.error });
        }
        doneImages += 1;
        setImportProgress({ phase: 'images', done: doneImages, total: keys.length });
      });

      // 2) cards in batches
      const rows = cards.map((card) => ({
        question: card.question?.trim() || '',
        answer: card.answer?.trim() || '',
        example: card.example?.trim() || null,
        note: card.note?.trim() || null,
        image: urlByKey[imageKeyOf(card)] || null,
      }));
      setImportProgress({ phase: 'cards', done: 0, total: rows.length });
      const { inserted, failedRows } = await importCards(deck.id, rows, {
        batchSize: CSV_LIMITS.insertBatchSize,
        onProgress: (done) => setImportProgress({ phase: 'cards', done, total: rows.length }),
      });

      // images no card uses (failed batches) don't stay in storage
      if (failedRows.length && uploaded.length) await removeUnusedCardImages(uploaded);

      setImportResult({
        inserted,
        failed: failedRows.length,
        skipped: csvPreview.allErrors.length,
        withoutImage: rows.filter((row, i) => imageKeyOf(cards[i]) && !row.image).length,
        imageFailures,
      });
    } catch (e) {
      if (__DEV__) console.warn('CSV import failed:', e?.message || e);
      if (uploaded.length) await removeUnusedCardImages(uploaded);
      setImportResult({
        inserted: 0,
        failed: cards.length,
        skipped: csvPreview.allErrors.length,
        withoutImage: 0,
        imageFailures,
        fatal: true,
      });
    } finally {
      importingRef.current = false;
      setImportProgress(null);
    }
  };

  const handleImageSelect = (imageId, img, idx) => {
    setImageIdMap(prev => ({ ...prev, [imageId]: { ...img, selectionIndex: idx + 1 } }));
  };

  const handleClose = () => {
    if (importingRef.current) return; // the import keeps running: stay open
    setImportResult(null);
    setCsvPreview(null);
    setSelectedImages([]);
    setImageIds([]);
    setImageIdMap({});
    onClose();
  };

  const handleResultDone = () => {
    const added = (importResult?.inserted || 0) > 0;
    handleClose();
    if (added) onImported?.();
  };

  const imageFailureText = (reason) => ({
    svg: t('addCard.imageFailSvg', 'SVG desteklenmiyor'),
    download: t('addCard.imageFailDownload', 'İndirilemedi'),
    tooLarge: t('addCard.imageFailTooLarge', "2 MB'tan büyük"),
    unmatched: t('addCard.imageFailUnmatched', 'Eşleşen fotoğraf yok'),
    upload: t('addCard.imageFailUpload', 'Yüklenemedi'),
  }[reason] || t('addCard.imageFailUpload', 'Yüklenemedi'));

  const progressLabel = importProgress
    ? (importProgress.phase === 'images'
      ? t('addCard.importingImages', { done: importProgress.done, total: importProgress.total, defaultValue: `Görseller hazırlanıyor ${importProgress.done}/${importProgress.total}` })
      : t('addCard.importingCards', { done: importProgress.done, total: importProgress.total, defaultValue: `Kartlar ekleniyor ${importProgress.done}/${importProgress.total}` }))
    : '';
  const progressRatio = importProgress && importProgress.total > 0 ? importProgress.done / importProgress.total : 0;

  const renderResult = () => {
    const res = importResult;
    const ok = !res.fatal && res.failed === 0;
    const rows = [
      res.failed > 0 && { key: 'failed', color: '#D32F2F', text: t('addCard.resultFailed', { count: res.failed, defaultValue: `${res.failed} kart eklenemedi` }) },
      res.skipped > 0 && { key: 'skipped', color: '#B7791F', text: t('addCard.resultSkipped', { count: res.skipped, defaultValue: `${res.skipped} satır hatalı olduğu için atlandı` }) },
      res.withoutImage > 0 && { key: 'noimg', color: '#B7791F', text: t('addCard.resultWithoutImage', { count: res.withoutImage, defaultValue: `${res.withoutImage} kart görselsiz eklendi` }) },
    ].filter(Boolean);
    return (
      <View style={styles.resultWrap}>
        <View style={[styles.resultIconCircle, { backgroundColor: (ok ? '#27AE60' : '#B7791F') + '22' }]}>
          <PhosphorIcon icon={ok ? ICONS.valid : ICONS.info} size={40} color={ok ? '#27AE60' : '#B7791F'} />
        </View>
        <Text style={[styles.resultCount, { color: colors.text }]}>{res.inserted}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {res.fatal
            ? t('addCard.resultFatal', 'İçe aktarma tamamlanamadı')
            : t('addCard.resultAdded', 'kart desteye eklendi')}
        </Text>
        {rows.length > 0 && (
          <View style={[styles.resultList, { backgroundColor: isDarkMode ? '#222' : '#F4F6F8' }]}>
            {rows.map((row) => (
              <View key={row.key} style={styles.resultRow}>
                <View style={[styles.resultDot, { backgroundColor: row.color }]} />
                <Text style={[styles.resultRowText, { color: colors.text }]}>{row.text}</Text>
              </View>
            ))}
            {res.imageFailures.slice(0, 5).map((f) => (
              <Text key={f.key} style={[styles.resultFailText, { color: colors.muted }]} numberOfLines={1}>
                {f.key} · {imageFailureText(f.reason)}
              </Text>
            ))}
            {res.imageFailures.length > 5 && (
              <Text style={[styles.resultFailText, { color: colors.muted }]}>
                {t('addCard.resultMoreImages', { count: res.imageFailures.length - 5, defaultValue: `+${res.imageFailures.length - 5} görsel daha` })}
              </Text>
            )}
          </View>
        )}
        <TouchableOpacity
          onPress={handleResultDone}
          style={[styles.resultDoneBtn, { backgroundColor: colors.buttonColor || '#007AFF' }]}
        >
          <Text style={styles.btnImportText}>{t('common.done', 'Tamam')}</Text>
        </TouchableOpacity>
      </View>
    );
  };


  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleSheetDismiss}
      enablePanDownToClose={!isImporting}
      backgroundStyle={Platform.OS === 'android' ? { backgroundColor: colors.background } : undefined /* iOS: system Liquid Glass */}
      snapPoints={['100%']}
    >
      <BottomSheetView style={styles.sheetContent}>

          <View style={styles.headerRow}>
            <Text style={[typography.styles.title2, { color: colors.text }]}>
              {t('addCard.csvUpload', 'CSV ile Yükle')}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isImporting}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={[styles.closeBtnWrapper, isImporting && { opacity: 0.3 }]}
            >
              <PhosphorIcon icon={ICONS.close} size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {importResult ? renderResult() : (
          <>
          <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>

            <Text style={[styles.description, { color: colors.muted }]}>
              {t('addCard.csvUploadDescriptionMain', 'Kartlarınızı Excel veya Google Sheets\'te hazırlayın ve CSV olarak kaydedin. CSV dosyanızı yükleyin ve kartlarınız hazır!')}
            </Text>
            {/* TABLO NASIL OLUŞTURULUR REHBERİ: the same numbered steps as the "how to" guides */}
            <View style={styles.guideSection}>
              <View style={styles.guideHeading}>
                <PhosphorIcon icon={ICONS.info} size={22} color={colors.primary || '#007AFF'} style={{ marginRight: 10 }} />
                <Text style={[styles.guideHeadingText, { color: colors.text }]}>
                  {t('addCard.howToCreateTable', 'Tablo Nasıl Oluşturulur?')}
                </Text>
              </View>

              <GuideSteps
                animate={false}
                steps={[
                  {
                    icon: ICONS.csvFile,
                    title: t('addCard.tableStructureTitle', 'CSV Formatı'),
                    description: t('addCard.tableStructure', 'Tablo 2 zorunlu 3 opsiyonel olmak üzere 5 sütundan oluşabilir. Sütunlar:'),
                    required: true,
                    children: (
                      <>
                        <View style={[styles.codeBadge, { backgroundColor: isDarkMode ? '#111' : '#F0F0F0', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                          <Text style={[styles.codeBadgeText, { color: colors.primary || '#ffffff' }]}>
                            {t('addCard.tableColumnsText', 'soru, cevap, ornek, not, gorsel')}
                          </Text>
                        </View>
                        <View style={styles.alertInline}>
                          <PhosphorIcon icon={ICONS.required} size={20} color={colors.secondary || '#F39C12'} style={{ marginRight: 6 }} />
                          <Text style={[styles.alertInlineText, { color: colors.secondary || '#F39C12' }]}>
                            {t('addCard.requiredColumnsOnly', 'soru ve cevap sütunları zorunludur!')}
                          </Text>
                        </View>
                        <Text style={[styles.guideText, { color: colors.muted, marginLeft: 26 }]}>
                          {t('addCard.optionalColumns', 'ornek, not, gorsel sütunları isteğe bağlıdır.')}
                        </Text>
                      </>
                    ),
                  },
                  {
                    icon: ICONS.image,
                    title: t('addCard.tableImageInstructionsTitle', 'Görsel Ekleme'),
                    description: t('addCard.imageInstructionsLead', 'Görsel eklemek istediğin satırın görsel sütununu iki şekilde doldurabilirsin:'),
                    required: false,
                    children: (
                      <View style={styles.guideBullets}>
                        {[
                          t('addCard.imageWayName', "Bir görsel ismi yaz (Ör: 'kitap'). CSV'yi yükledikten sonra görselleri seç ve menüden eşleştir."),
                          t('addCard.imageWayUrl', 'Ya da görselin URL adresini yaz (Ör: https://example.com/image.png), yüklemeyi bize bırak.'),
                        ].map((line, i) => (
                          <View key={i} style={styles.guideBulletRow}>
                            <View style={[styles.guideBulletDot, { backgroundColor: colors.secondary || '#F98A21' }]} />
                            <Text style={[styles.guideText, { color: colors.text, flex: 1 }]}>{line}</Text>
                          </View>
                        ))}
                        <Text style={[styles.guideText, { color: colors.muted, fontStyle: 'italic' }]}>
                          {t('addCard.svgNote', 'Not: SVG formatı desteklenmemektedir.')}
                        </Text>
                      </View>
                    ),
                  },
                  {
                    icon: ICONS.upload,
                    title: t('addCard.saveAndUploadTitle', 'Kaydet ve Yükle'),
                    description: t('addCard.saveAndUpload', "Tabloyu CSV olarak kaydet ve aşağıdaki butonla yükle. Örnek tablo:"),
                    children: (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setImageModalVisible(true)} style={styles.imagePreviewWrapper}>
                        <Image
                          source={require('../../assets/images/examtable.png')}
                          style={styles.exampleTableImage}
                          resizeMode="contain"
                        />
                        <View style={styles.zoomIconBadge}>
                          <PhosphorIcon icon={ICONS.zoom} size={22} color="#FFF" />
                        </View>
                      </TouchableOpacity>
                    ),
                  },
                ]}
              />
              <GuideTip
                text={t('addCard.csvLimitsShort', {
                  cards: CSV_LIMITS.maxCards,
                  images: CSV_LIMITS.maxImages,
                  defaultValue: `Tek seferde en fazla ${CSV_LIMITS.maxCards} kart ve ${CSV_LIMITS.maxImages} görsel yükleyebilirsin. Virgül (,) ya da noktalı virgül (;) ile ayrılmış dosyalar kabul edilir.`,
                })}
              />

              {/* Büyütülmüş Resim Modalı - Core Modal'a taşındı */}
              <Modal
                visible={isImageModalVisible}
                transparent={true}
                animationType="fade"
                statusBarTranslucent={true}
                onRequestClose={() => setImageModalVisible(false)}
              >
                <Pressable 
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }} 
                  onPress={() => setImageModalVisible(false)}
                >
                  <TouchableOpacity style={styles.fullScreenCloseBtn} onPress={() => setImageModalVisible(false)}>
                    <PhosphorIcon icon={ICONS.close} size={24} color="white" />
                  </TouchableOpacity>

                  {/* Görsele tıklayınca modalın kapanmaması için TouchableWithoutFeedback */}
                  <TouchableWithoutFeedback>
                    <Image
                      source={require('../../assets/images/examtable.png')}
                      style={{ width: '90%', height: '70%' }}
                      resizeMode="contain"
                    />
                  </TouchableWithoutFeedback>
                </Pressable>
              </Modal>
            </View>

            {/* ÖNİZLEME (PREVIEW) EKRANI */}
            {csvPreview && (
              <View style={styles.previewSection}>

                {/* Dosya Adı Barı */}
                <View style={[styles.fileNameBar, { backgroundColor: isDarkMode ? '#222' : '#F4F6F8' }]}>
                  <PhosphorIcon icon={ICONS.csvFile} size={22} color={colors.primary || '#007AFF'} />
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
                    <PhosphorIcon icon={ICONS.info} size={24} color="#B7791F" style={{ marginRight: 10 }} />
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
                      <PhosphorIcon icon={ICONS.info} size={20} color="#D32F2F" style={{ marginRight: 8 }} />
                      <Text style={styles.alertBoxTitleError}>{t('addCard.errors', 'Hatalar (İlk 5)')}</Text>
                    </View>
                    {csvPreview.errors.map((err, idx) => (
                      <Text key={idx} style={styles.alertBoxTextError}>
                        <Text style={{ fontFamily: fonts.bold }}>Satır {err.row}: </Text>{err.message}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Görsel Eşleştirme Alanı */}
                {csvPreview.hasLocalImageFiles && (
                  <View style={[styles.imageMapSection, { backgroundColor: isDarkMode ? '#222' : '#F9FAFB', borderColor: colors.border }]}>

                    <View style={styles.imageMapHeader}>
                      <View style={{ flex: 2 }}>
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
                        <PhosphorIcon icon={ICONS.image} size={18} color="#FFF" style={{ marginRight: 6 }} />
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

                              <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={[styles.imgIdLabel, { color: colors.muted }]} numberOfLines={1}>{imageId}</Text>
                              </View>

                              <MenuOverlay
                                actions={selectedImages.map((img, idx) => ({
                                  id: String(idx),
                                  title: `${t('addCard.chooseImages', 'Seçim')} ${idx + 1}`,
                                  state: imageIdMap[imageId]?.uri === img.uri ? 'on' : 'off',
                                }))}
                                onPressAction={({ nativeEvent }) => {
                                  const idx = Number(nativeEvent.event);
                                  if (selectedImages[idx]) handleImageSelect(imageId, selectedImages[idx], idx);
                                }}
                              >
                                <View style={[styles.dropdownTrigger, { borderColor: selectedImg ? (colors.primary || '#007AFF') : colors.border, backgroundColor: isDarkMode ? '#111' : '#FFF' }]}>
                                  {selectedImg ? (
                                    <View style={styles.dropdownSelectedInner}>
                                      <Image source={{ uri: selectedImg.uri }} style={styles.dropdownTriggerThumb} />
                                      <Text style={[styles.dropdownTriggerText, { color: colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>
                                        {t('addCard.chooseImages', 'Seçim')} {selectedImg.selectionIndex}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text style={[styles.dropdownTriggerPlaceholder, { color: colors.muted }]}>{t('addCard.matchImages', 'Eşleştir')}</Text>
                                  )}
                                  <PhosphorIcon icon={ICONS.dropdown} size={16} color={colors.text} style={{ marginLeft: 6 }} />
                                </View>
                              </MenuOverlay>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Aksiyon Butonları (İçeridekiler) / içe aktarma sürerken ilerleme */}
                {isImporting ? (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressLabel, { color: colors.text }]}>{progressLabel}</Text>
                      <Text style={[styles.progressPercent, { color: colors.muted }]}>{Math.round(progressRatio * 100)}%</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                      <View style={[styles.progressFill, { width: `${Math.max(4, progressRatio * 100)}%`, backgroundColor: colors.buttonColor || '#007AFF' }]} />
                    </View>
                    <Text style={[styles.progressHint, { color: colors.muted }]}>
                      {t('addCard.importKeepOpen', 'Bitene kadar bu ekranı kapatma.')}
                    </Text>
                  </View>
                ) : (
                <View style={styles.previewActionButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      setCsvPreview(null); // LayoutAnimation kalıntısı temizlendi
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
                )}

              </View>
            )}

          </ScrollView>

          {/* Aksiyon Butonları (Sabit Alt Kısım - Önizleme Yokken) */}
          {!csvPreview && (
            <View style={styles.bottomActions}>
              <TouchableOpacity onPress={handleDownloadTemplate} style={styles.btnDownloadTemplate}>
                <PhosphorIcon icon={ICONS.download} size={20} color="#F98A21" style={{ marginRight: 8 }} />
                <Text style={styles.btnDownloadTemplateText}>{t('addCard.downloadTemplate', 'Örnek CSV İndir')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePickCSV}
                style={[styles.btnPickCsv, { backgroundColor: colors.primary || '#007AFF' }]}
                disabled={csvLoading}
              >
                <PhosphorIcon icon={ICONS.upload} size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.btnPickCsvText}>
                  {csvLoading ? t('addCard.loading', 'Yükleniyor...') : t('addCard.selectCSV', 'CSV Yükle')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          </>
          )}

      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  progressWrap: { marginTop: 24, marginBottom: 32, gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressLabel: { fontSize: fontSizes.body, fontFamily: fonts.semibold },
  progressPercent: { fontSize: fontSizes.footnote, fontFamily: fonts.medium },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressHint: { fontSize: fontSizes.footnote, fontFamily: fonts.regular },
  resultWrap: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 8 },
  resultIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultCount: { fontSize: fontSizes.display, fontFamily: fonts.bold, lineHeight: 46 },
  resultTitle: { fontSize: fontSizes.bodyLarge, fontFamily: fonts.medium, marginTop: 2, marginBottom: 24, textAlign: 'center' },
  resultList: { alignSelf: 'stretch', borderRadius: 16, padding: 16, gap: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultDot: { width: 8, height: 8, borderRadius: 4 },
  resultRowText: { flex: 1, fontSize: fontSizes.subhead, fontFamily: fonts.medium },
  resultFailText: { fontSize: fontSizes.footnote, fontFamily: fonts.regular, marginLeft: 18 },
  resultDoneBtn: { alignSelf: 'stretch', marginTop: 'auto', marginBottom: 32, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtnWrapper: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 6,
    borderRadius: 99,
  },
  scrollView: {
    flex: 1,
  },
  description: {
    fontSize: fontSizes.subhead,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },

  // --- REHBER KISMI ---
  guideSection: {
    marginBottom: 16,
  },
  guideHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  guideHeadingText: {
    fontSize: fontSizes.body,
    fontFamily: fonts.bold,
  },
  guideBullets: {
    gap: 8,
    marginTop: 2,
  },
  guideBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  guideText: {
    fontSize: fontSizes.footnote,
    lineHeight: 18,
  },
  codeBadge: {
    marginTop: 4,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  codeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.footnote,
    letterSpacing: 0.5,
  },
  alertInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertInlineText: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.semibold,
  },
  imagePreviewWrapper: {
    marginTop: 4,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  exampleTableImage: {
    width: '100%',
    height: 100,
  },
  zoomIconBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 99,
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    top: 80,
    right: 24,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 99,
  },

  // --- ÖNİZLEME (PREVIEW) KISMI ---
  previewSection: {
    paddingTop: 8,
    gap: 16,
  },
  fileNameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  fileNameText: {
    fontSize: fontSizes.subhead,
    fontFamily: fonts.semibold,
    marginLeft: 10,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.semibold,
    marginBottom: 4,
  },
  statValue: {
    fontSize: fontSizes.title3,
    fontFamily: fonts.bold,
  },

  // --- UYARI & HATA KUTULARI ---
  alertBoxWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF08A30',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  alertBoxTitleWarning: {
    color: '#B7791F',
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
    marginBottom: 2,
  },
  alertBoxTextWarning: {
    color: '#B7791F',
    fontSize: fontSizes.caption,
    lineHeight: 16,
  },
  alertBoxError: {
    backgroundColor: '#FEE2E250',
    borderColor: '#EF4444',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertBoxTitleError: {
    color: '#D32F2F',
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
  },
  alertBoxTextError: {
    color: '#D32F2F',
    fontSize: fontSizes.caption,
    marginBottom: 2,
  },

  // --- EŞLEŞTİRME KISMI ---
  imageMapSection: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  imageMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  imageMapTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
    marginBottom: 2,
  },
  imageMapSub: {
    fontSize: fontSizes.caption,
  },
  pickImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  pickImgBtnText: {
    color: '#FFF',
    fontFamily: fonts.bold,
    fontSize: fontSizes.caption,
  },
  dropdownsList: {
    gap: 10,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  badgeText: {
    fontSize: fontSizes.caption,
    fontFamily: fonts.bold,
  },
  imgIdLabel: {
    fontSize: fontSizes.footnote,
    fontFamily: fonts.medium,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: 130,
  },
  dropdownTriggerPlaceholder: {
    fontSize: fontSizes.footnote,
    flex: 1,
  },
  dropdownSelectedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownTriggerThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 6,
  },
  dropdownTriggerText: {
    fontSize: fontSizes.footnote,
    flex: 1,
  },

  // Dropdown Menu Styles
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownImageThumbnail: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginRight: 10,
  },
  dropdownListItemText: {
    fontSize: fontSizes.subhead,
  },

  // --- İÇ AKSİYON BUTONLARI (İPTAL / İÇE AKTAR) ---
  previewActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCancelText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
  },
  btnImport: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnImportText: {
    color: '#FFF',
    fontFamily: fonts.bold,
    fontSize: fontSizes.subhead,
  },

  // --- SABİT ALT AKSİYON BUTONLARI (İLK EKRAN) ---
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btnDownloadTemplate: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249, 138, 33, 0.15)', // Çok tatlı bir turuncu transparan
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F98A21',
  },
  btnDownloadTemplateText: {
    color: '#F98A21',
    fontFamily: fonts.bold,
    fontSize: fontSizes.footnote,
    flexShrink: 1,
  },
  btnPickCsv: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  btnPickCsvText: {
    color: '#FFF',
    fontFamily: fonts.bold,
    fontSize: fontSizes.footnote,
    flexShrink: 1,
  },
});