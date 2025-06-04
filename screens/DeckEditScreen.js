import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/theme';

export default function DeckEditScreen() {
  const route = useRoute();
  const { deck } = route.params;
  const [name, setName] = useState(deck.name || '');
  const [toName, setToName] = useState(deck.to_name || '');
  const [description, setDescription] = useState(deck.description || '');
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();

  const resetForm = () => {
    setName(deck.name || '');
    setToName(deck.to_name || '');
    setDescription(deck.description || '');
    setIsShared(deck.is_shared || false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Deste adı zorunludur.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('decks')
        .update({
          name: name.trim(),
          to_name: toName.trim() || null,
          description: description.trim() || null,
          is_shared: isShared,
        })
        .eq('id', deck.id);
      if (error) throw error;
      Alert.alert('Başarılı', 'Deste güncellendi.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Deste güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = () => {
    Alert.alert(
      'Toplulukta Paylaş Ayrıntıları',
      'Bu deste toplulukla paylaşıldığında diğer kullanıcılar tarafından da görüntülenebilir ve kullanılabilir. Paylaşımı istediğin zaman kapatabilirsin.'
    );
  };

  return (
    <LinearGradient
      colors={["#fff8f0", "#ffe0c3", "#f9b97a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.formContainer}>
          <BlurView intensity={90} tint="light" style={styles.inputCard}>
            <View style={styles.labelRow}>
              <Ionicons name="book" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body]}>Deste Adı *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder="Örn: İngilizce"
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </BlurView>
          <BlurView intensity={90} tint="light" style={styles.inputCard}>
            <View style={styles.labelRow}>
              <Ionicons name="swap-horizontal" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body]}>Karşılığı</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> (opsiyonel)</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body]}
              placeholder="Örn: Türkçe"
              value={toName}
              onChangeText={setToName}
            />
          </BlurView>
          <BlurView intensity={90} tint="light" style={styles.inputCard}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body]}>Açıklama</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> (opsiyonel)</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Deste hakkında açıklama..."
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </BlurView>
          <BlurView intensity={90} tint="light" style={[styles.inputCard, styles.switchCard]}>
            <View style={styles.switchRow}>
              <View style={styles.labelRow}>
                <Ionicons name="people" size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body]}>Toplulukla paylaş</Text>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: '#e0e0e0', true: '#5AA3F0' }}
                thumbColor={isShared ? colors.secondary : '#f4f3f4'}
              />
            </View>
          </BlurView>
          <View style={styles.detailsRow}>
            <TouchableOpacity onPress={handleShowDetails} activeOpacity={0.7}>
              <Text style={[styles.detailsText, typography.styles.link, { color: colors.secondary }]}>Ayrıntılar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.favButtonModern]}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={[styles.favButtonTextModern, typography.styles.button]}>Geri Al</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.startButtonModern, loading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, typography.styles.button]}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  switchCard: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 70,
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
    paddingHorizontal: 18,
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F98A21',
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
    marginLeft: 8,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailsRow: {
    alignSelf: 'flex-end',
    paddingRight: 10,
    marginTop: -10,
  },
  detailsText: {
    textDecorationLine: 'underline',
  },
  optional: {
    marginLeft: 4,
    alignSelf: 'flex-end',
  },
}); 