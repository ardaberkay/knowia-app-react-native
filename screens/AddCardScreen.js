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
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    }
  };

  const handleRemoveImage = () => {
    setImage('');
    setImageChanged(false);
  };

  const handleCreateCard = async () => {
    if (!question.trim() || !answer.trim()) {
      Alert.alert('Hata', 'Soru ve cevap zorunludur.');
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
      Alert.alert('Başarılı', 'Kart eklendi!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert('Hata', e.message || 'Kart eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  // CSV şablonunu indirme fonksiyonu
  const handleDownloadTemplate = async () => {
    const csvContent = 'Soru,Cevap,Örnek,Not\n"Book","Kitap","i am reading a book","Buk şeklinde okunur"\n"Knowledge","Bilgi","Knowledge is power.","Bilgi güçtür."';
    const fileUri = FileSystem.documentDirectory + 'ornek_kartlar.csv';
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert('Paylaşım desteklenmiyor', 'Dosya yolu: ' + fileUri);
    }
  };

  // CSV dosyası seçme fonksiyonu (şimdilik sadece alert)
  const handlePickCSV = async () => {
    Alert.alert('CSV Yükleme', 'CSV yükleme fonksiyonu burada çalışacak.');
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
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text, textAlign: 'center' }}>CSV ile Toplu Kart Yükleme</Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginBottom: 18, textAlign: 'center' }}>
            Kartlarınızı Excel veya Google Sheets'te aşağıdaki gibi hazırlayın ve CSV olarak kaydedin. Sadece ilk iki sütun zorunludur:
            {'\n'}
            <Text style={{ fontWeight: 'bold', color: colors.text }}>Soru, Cevap, Örnek (opsiyonel), Not (opsiyonel)</Text>
            {'\n'}
            Her satır bir kartı temsil eder. Boş satırlar veya eksik zorunlu alanlar atlanır.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleDownloadTemplate}
              style={{ backgroundColor: '#F98A21', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, marginRight: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Örnek CSV İndir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickCSV}
              style={{ backgroundColor: colors.blurView, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>CSV Dosyası Seç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer}>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="image" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>Kart Görseli</Text>
            </View>
            {image ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: image }} style={styles.cardImage} />
                <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageButton}>
                  <Text style={styles.removeImageButtonText}>Kaldır</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage} style={styles.addImageButton}>
                <Ionicons name="add" size={24} color="#F98A21" />
                <Text style={styles.addImageButtonText}>Fotoğraf Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="help-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>Soru *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder="Kartın sorusu"
              placeholderTextColor={colors.muted}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>Cevap *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder="Kartın cevabı"
              placeholderTextColor={colors.muted}
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="bulb-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>Örnek</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder="Örnek cümle (opsiyonel)"
              placeholderTextColor={colors.muted}
              value={example}
              onChangeText={setExample}
              multiline
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text-outline" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>Not</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text, borderColor: colors.border}]}
              placeholder="Not (opsiyonel)"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.startButtonModern, loading && { opacity: 0.7 }]}
              onPress={handleCreateCard}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, typography.styles.button]}>{loading ? 'Ekleniyor...' : 'Kartı Oluştur'}</Text>
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
    color: '#fff',
  },
}); 